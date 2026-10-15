import { applyReport, edgeStatus, mergeBeliefs, newBeliefs, observeEdge, type EdgeStatus } from "./beliefs";
import { CONFIG } from "./config";
import { estimatePeople, findCluster } from "./dedup";
import { cascadeExplanation } from "./explain";
import { createFleet } from "./fleet";
import { dijkstra, edgeBetween, pathTo, type CostFn, type Tree } from "./graph";
import { checkInvariants } from "./invariants";
import { computeKpis } from "./metrics";
import { priority, type PriorityBreakdown } from "./priority";
import { hashUnit, mulberry32, type Rng } from "./rng";
import { scoreRisk } from "./risk";
import { clock, expandScenario, truthLevel } from "./scenario";
import { makeStrategy, type Strategy } from "./strategies";
import type {
  Agent,
  AgentType,
  AreaStatus,
  BeliefStore,
  BidRecord,
  CascadeEntry,
  Commitment,
  Frame,
  Incident,
  InjectEvent,
  Message,
  Need,
  ReasonCode,
  Report,
  Scenario,
  ScenarioEvent,
  ShelterState,
  SimEvent,
  SosSpec,
  StrategyName,
  Task,
  Urgency,
  World,
} from "./types";
import { buildWorld, edgeDepth, nearestNode, nodeDepth, speedKmh } from "./world";

export interface View {
  id: string;
  status(edgeId: string): EdgeStatus;
  level(nbhd: string): number;
}

export interface SimOptions {
  strategy: StrategyName;
  recordFrames?: boolean;
  /** extra events injected before the run (bench "what-if") */
  extraEvents?: ScenarioEvent[];
}

export interface ContradictionRecord {
  id: string;
  edge: string;
  tick: number;
  sources: { source: string; claim: string; confidence: number; tick: number }[];
  resolvedTick?: number;
  resolvedAs?: "open" | "closed";
  lastImpactTick: number;
  wastedTrips: number;
  churn: number;
  verifyTask?: string;
}

const URG_RANK: Record<Urgency, number> = { critical: 3, urgent: 2, needs_help: 1 };

export class Simulation {
  readonly world: World;
  readonly scenario: Scenario;
  readonly strategyName: StrategyName;
  readonly omniscient: boolean;
  readonly strategy: Strategy;
  tick = 0;
  seq = 0;
  agents: Agent[];
  agentById = new Map<string, Agent>();
  tasks = new Map<string, Task>();
  incidents = new Map<string, Incident>();
  sosIndex = new Map<string, string>(); // sosId -> incidentId
  shelters = new Map<string, ShelterState>();
  cop: BeliefStore;
  copAgents = new Map<string, { x: number; y: number; node: number; status: Agent["status"]; t: number; onboard: number }>();
  truthClosed = new Set<string>();
  surges: { nbhds: string[]; delta: number; tick: number; duration: number }[] = [];
  blackouts = new Map<string, number>();
  pending: ScenarioEvent[];
  inbox: { msg: Message; at: number }[] = [];
  sosQueue: { spec: SosSpec; at: number }[] = [];
  log: SimEvent[] = [];
  frames: Frame[] = [];
  cascades: CascadeEntry[] = [];
  contradictions: ContradictionRecord[] = [];
  violations: { tick: number; agent: string; edge: string; why: string }[] = [];
  invariantViolations: { tick: number; id: number; msg: string }[] = [];
  shelterClaims: { tick: number; shelter: string; claimFree: number; source: string; actualFree: number; note?: string }[] = [];
  falseTrips = 0;
  considered = new Set<string>();
  released = new Set<string>();
  criticalAtAlloc = new Set<string>();
  dropChecks: { ok: boolean; msg: string }[] = [];
  series: { tick: number; openSos: number; critical: number; p90: number; idlePct: number; violations: number; fairness: number; rescued: number }[] = [];
  levelsTruth: Record<string, number> = {};
  recordFrames: boolean;
  lastPriority = new Map<string, PriorityBreakdown>();
  nbhdLag: Record<string, number> = {};
  private ids = { task: 0, commit: 0, inc: 0, rep: 0, res: 0, con: 0 };
  private rng: Rng;
  private treeCache = new Map<string, Tree>();
  private cacheOn = false;
  private openCascades: (CascadeEntry & { pendingTasks: Set<string> })[] = [];
  private tickCascade: (CascadeEntry & { pendingTasks: Set<string> }) | null = null;
  private blockedAgents = new Set<string>();
  readonly truthView: View;
  readonly copView: View;

  constructor(scenario: Scenario, opts: SimOptions) {
    this.world = buildWorld();
    this.scenario = scenario;
    this.strategyName = opts.strategy;
    this.omniscient = opts.strategy === "omniscient";
    this.recordFrames = opts.recordFrames ?? true;
    this.rng = mulberry32(scenario.seed);
    for (const n of this.world.nbhds) this.levelsTruth[n.id] = truthLevel(scenario, n.id, 0);
    this.cop = newBeliefs(this.levelsTruth);
    this.agents = createFleet(this.world, this.levelsTruth, scenario.fleet);
    for (const a of this.agents) {
      this.agentById.set(a.id, a);
      this.copAgents.set(a.id, { x: a.x, y: a.y, node: a.node, status: a.status, t: 0, onboard: 0 });
    }
    for (const s of this.world.shelters) this.shelters.set(s.id, { id: s.id, capacity: s.capacity, occupancy: 0, reservations: [], reachable: true });
    this.pending = [...expandScenario(scenario, this.world), ...(opts.extraEvents ?? [])].sort((a, b) => a.tick - b.tick);
    this.strategy = makeStrategy(opts.strategy);

    this.truthView = {
      id: "truth",
      status: (e) => (this.truthClosed.has(e) ? "closed" : "open"),
      level: (nb) => this.levelsTruth[nb] ?? 0,
    };
    this.copView = {
      id: "cop",
      status: (e) => edgeStatus(this.cop, e, this.tick),
      level: (nb) => this.cop.level.get(nb)?.level ?? 0,
    };
    this.emit("SIM_START", `Scenario "${scenario.name}" · strategy ${opts.strategy.toUpperCase()} · seed ${scenario.seed}`);
  }

  // ───────────────────────────── views & routing ─────────────────────────────

  viewFor(a: Agent): View {
    if (this.omniscient) return this.truthView;
    return {
      id: `a:${a.id}`,
      status: (e) => edgeStatus(a.belief, e, this.tick),
      level: (nb) => a.belief.level.get(nb)?.level ?? 0,
    };
  }

  centralView(): View {
    return this.omniscient ? this.truthView : this.copView;
  }

  costFn(view: View, type: AgentType, escort = false): CostFn {
    const w = this.world;
    return (edgeId) => {
      const e = w.edgeById.get(edgeId)!;
      const st = view.status(edgeId);
      if (st === "closed") return Infinity;
      if (st === "contested" && type === "ground") return Infinity;
      const depth = edgeDepth(w, e, (nb) => view.level(nb));
      const sp = speedKmh(type, e.kind, depth, escort);
      if (!sp) return Infinity;
      let m = (e.length / sp) * 60;
      if (st === "unknown") m *= CONFIG.UNKNOWN_COST_MULT;
      if (st === "contested") m *= CONFIG.CONTESTED_BOAT_MULT;
      return m;
    };
  }

  tree(view: View, type: AgentType, from: number, escort = false): Tree {
    const key = `${view.id}|${type}|${escort ? 1 : 0}|${from}`;
    if (this.cacheOn) {
      const hit = this.treeCache.get(key);
      if (hit) return hit;
    }
    const t = dijkstra(this.world, from, this.costFn(view, type, escort));
    if (this.cacheOn) this.treeCache.set(key, t);
    return t;
  }

  travel(view: View, type: AgentType, from: number, to: number, escort = false): number {
    if (from === to) return 0;
    return this.tree(view, type, from, escort).dist[to];
  }

  // ───────────────────────────── logging ─────────────────────────────

  emit(type: string, msg: string, f: Partial<SimEvent> = {}): SimEvent {
    const ev: SimEvent = { seq: this.seq++, tick: this.tick, type, msg, ...f };
    if ((type === "AWARD" || type === "DECOMMIT" || type === "OVERRIDE") && !ev.reason) {
      this.invariantViolations.push({ tick: this.tick, id: 9, msg: `${type} without reason` });
    }
    this.log.push(ev);
    return ev;
  }

  time(t = this.tick) {
    return clock(t);
  }

  // ───────────────────────────── task helpers ─────────────────────────────

  unassigned(t: Task): number {
    if (t.status === "done" || t.status === "cancelled") return 0;
    const open = Math.max(0, t.demand - t.served - t.committed);
    // size-up rule: a large UNVERIFIED claim gets a first wave (≤ FIRST_WAVE people of lift) — never zero, so
    // dispatch is not blocked (invariant 7); the full demand opens once the first unit verifies on site.
    if (t.kind === "RESCUE" && t.incidentId && t.served === 0) {
      const inc = this.incidents.get(t.incidentId);
      if (inc && inc.verification !== "verified" && inc.people > CONFIG.FIRST_WAVE) return Math.max(0, Math.min(open, CONFIG.FIRST_WAVE - t.committed));
    }
    return open;
  }

  waitOf(t: Task): number {
    const inc = t.incidentId ? this.incidents.get(t.incidentId) : undefined;
    const created = inc ? inc.createdTick : t.createdTick;
    return (t.firstServedTick ?? inc?.firstServedTick ?? this.tick) - created;
  }

  computePriority(t: Task): PriorityBreakdown {
    const inc = t.incidentId ? this.incidents.get(t.incidentId) : undefined;
    const nb = this.world.nbhds.find((n) => n.id === t.nbhd);
    const p = priority({
      urgency: t.urgency,
      needs: inc?.needs ?? [],
      people: t.kind === "RESCUE" ? this.unassigned(t) || t.demand : 1,
      nbhdVulnerability: nb?.vulnerability ?? 0.3,
      waitTicks: Math.max(0, this.tick - (inc?.createdTick ?? t.createdTick)),
      verification: inc?.verification ?? "verified",
      escalated: inc?.escalated ?? false,
      nbhdLag: this.nbhdLag[t.nbhd] ?? 0,
    });
    if (t.kind === "VERIFY") {
      const e = t.edgeId ? this.world.edgeById.get(t.edgeId) : undefined;
      p.total = Math.round(p.total * (e?.kind === "bridge" ? 1.6 : 1.1) * 100) / 100;
    }
    return p;
  }

  /** Tasks with unassigned demand, priority-ordered; ties (within 5%) go to the neighbourhood with worse P90 wait. */
  openTasks(): Task[] {
    const p90 = this.nbhdP90();
    const list = [...this.tasks.values()].filter((t) => this.unassigned(t) > 0);
    for (const t of list) {
      const pb = this.computePriority(t);
      t.priority = pb.total;
      this.lastPriority.set(t.id, pb);
    }
    list.sort((a, b) => {
      const hi = Math.max(a.priority, b.priority);
      if (Math.abs(a.priority - b.priority) <= CONFIG.FAIRNESS_TIE * hi) {
        const d = (p90[b.nbhd] ?? 0) - (p90[a.nbhd] ?? 0);
        if (d !== 0) return d;
      }
      return b.priority - a.priority || a.id.localeCompare(b.id);
    });
    return list;
  }

  /** For the central solver: open tasks plus tasks held by still-reassignable commitments (top-K by priority). */
  openTasksIncludingReassignable(k: number): Task[] {
    const ids = new Set(this.openTasks().map((t) => t.id));
    for (const a of this.agents) {
      const last = a.queue[a.queue.length - 1];
      if (last && (last.phase === "queued" || last.phase === "to_site") && last.pickedUp === undefined) ids.add(last.taskId);
    }
    const list = [...ids].map((id) => this.tasks.get(id)!).filter((t) => t.status !== "done" && t.status !== "cancelled");
    for (const t of list) {
      const pb = this.computePriority(t);
      t.priority = pb.total;
      this.lastPriority.set(t.id, pb);
    }
    list.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    // never drop critical work or work released this tick (invariants 5 & 7) because of the top-K cut
    return list.filter((t, i) => i < k || t.urgency === "critical" || this.released.has(t.id));
  }

  nbhdP90(): Record<string, number> {
    const waits: Record<string, number[]> = {};
    for (const inc of this.incidents.values()) {
      if (inc.status === "merged" || inc.status === "false_report") continue;
      (waits[inc.nbhd] ??= []).push((inc.firstServedTick ?? this.tick) - inc.createdTick);
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(waits)) {
      v.sort((a, b) => a - b);
      out[k] = v[Math.min(v.length - 1, Math.floor(0.9 * v.length))];
    }
    return out;
  }

  capable(a: Agent, t: Task): string | null {
    if (a.status === "failed") return "agent failed";
    if (a.type !== t.mode) return t.mode === "boat" ? "boat-only task" : "ground-only task";
    for (const s of t.skills) if (!a.skills.includes(s)) return `lacks skill ${s}`;
    if (a.status === "refuelling" || a.status === "returning") return "refuelling";
    if (a.vetoed.has(t.id)) return "vetoed by control room";
    return null;
  }

  /** CNP message channel — deterministic hash-based loss, independent of strategy call order. */
  canReceive(a: Agent, key: string): boolean {
    if (this.omniscient) return true;
    if (!a.connected) return false;
    return hashUnit(this.scenario.seed, this.tick, a.id, key) >= CONFIG.MSG_LOSS;
  }

  /**
   * Shelter choice incl. drop point. Boats cannot reach dry shelters, so they hand people over at a LANDING
   * (a boat-reachable node with a ground connection); the shelter's shuttle completes the transfer.
   * cost = boat minutes to landing + 0.5 × escort-ground minutes landing→shelter (+8 if medical needed but absent).
   */
  nearestShelterFor(view: View, type: AgentType, from: number, count: number, preferMedical: boolean, reserve = false): { id: string; minutes: number; dropNode: number } | null {
    let best: { id: string; minutes: number; dropNode: number } | null = null;
    const own = type === "boat" ? this.tree(view, "boat", from) : null;
    for (const s of this.world.shelters) {
      const st = this.shelters.get(s.id)!;
      if (reserve && !this.omniscient && this.isBlackout(s.nbhd)) continue;
      const reserved = st.reservations.reduce((x, r) => x + r.count, 0);
      if (st.capacity - st.occupancy - reserved < count) continue;
      let minutes: number;
      let dropNode = s.node;
      if (own) {
        const g = this.tree(view, "ground", s.node, true);
        minutes = Infinity;
        for (let n = 0; n < own.dist.length; n++) {
          if (!Number.isFinite(own.dist[n]) || !Number.isFinite(g.dist[n])) continue;
          const m = own.dist[n] + 0.5 * g.dist[n];
          if (m < minutes) {
            minutes = m;
            dropNode = n;
          }
        }
      } else minutes = this.travel(view, type, from, s.node, true);
      if (!Number.isFinite(minutes)) continue;
      const score = minutes + (preferMedical && !s.medical ? 8 : 0);
      if (!best || score < best.minutes) best = { id: s.id, minutes: score, dropNode };
    }
    return best;
  }

  /** Time (min) until the agent could start a new task, and where it would be. */
  availability(a: Agent, view: View): { minutes: number; node: number } {
    let t = 0;
    let node = a.next ?? a.node;
    if (a.next !== null) {
      const e = this.world.edgeById.get(edgeBetween(this.world, a.node, a.next)!)!;
      t += ((e.length - a.progress) / 10) * 60;
    }
    if (a.status === "refuelling") t += a.workLeft;
    for (const c of a.queue) {
      const task = this.tasks.get(c.taskId);
      if (!task) continue;
      if (c.phase === "queued" || c.phase === "to_site") {
        t += this.travel(view, a.type, node, task.node);
        node = task.node;
        t += this.workTicks(task, c.count);
      } else if (c.phase === "on_site") {
        t += a.workLeft;
      }
      if (task.kind === "RESCUE" && c.phase !== "done") {
        if (c.phase === "to_shelter" && c.shelterId) {
          const sn = c.dropNode ?? node;
          t += this.travel(view, a.type, node, sn, a.type === "ground");
          node = sn;
        } else {
          const s = this.nearestShelterFor(view, a.type, node, c.count, false);
          if (s) {
            t += s.minutes;
            node = s.dropNode;
          } else t += 30;
        }
      }
    }
    return { minutes: Number.isFinite(t) ? t : 1e6, node };
  }

  workTicks(t: Task, count: number): number {
    if (t.kind === "RESCUE") return CONFIG.LOAD_BASE + Math.ceil(count / 4);
    return CONFIG.WORK_TICKS[t.kind] ?? 2;
  }

  bid(a: Agent, t: Task, opts: { ignoreQueue?: boolean; requireComms?: boolean } = {}): BidRecord {
    const ex = (excluded: string): BidRecord => ({ agent: a.id, bid: Infinity, eta: Infinity, breakdown: {}, excluded });
    const cap = this.capable(a, t);
    if (cap) return ex(cap);
    if (opts.requireComms !== false && !this.canReceive(a, `ann:${t.id}`)) return ex(a.connected ? "message lost" : "no comms (blackout)");
    if (!opts.ignoreQueue && a.queue.length >= CONFIG.MAX_QUEUE) return ex("bundle full");
    const view = this.viewFor(a);
    const av = opts.ignoreQueue ? { minutes: 0, node: a.next ?? a.node } : this.availability(a, view);
    if (av.minutes >= 1e5) return ex("current commitments unreachable");
    const travel = this.travel(view, a.type, av.node, t.node);
    if (!Number.isFinite(travel)) return ex("no route on own map");
    if (av.minutes + travel > 480) return ex("ETA beyond 8 h");
    const eta = av.minutes + travel;
    const queue = opts.ignoreQueue ? 0 : CONFIG.QUEUE_PENALTY * a.queue.length;
    const need = this.unassigned(t);
    const capacity = t.kind === "RESCUE" && a.capacity < need ? CONFIG.CAPACITY_SHORTFALL_PENALTY : 0;
    const skill = t.prefSkills.some((s) => a.skills.includes(s)) ? -CONFIG.SKILL_BONUS : 0;
    if (a.type === "boat" && a.fuel < eta + 45 + CONFIG.FUEL_RESERVE) return ex(`fuel ${Math.round(a.fuel)} min left`);
    const bid = Math.round((eta + queue + capacity + skill) * 10) / 10;
    return { agent: a.id, bid, eta: Math.round(eta * 10) / 10, breakdown: { availability: Math.round(av.minutes * 10) / 10, travel: Math.round(travel * 10) / 10, queue, capacity, skill } };
  }

  markConsidered(taskId: string) {
    this.considered.add(taskId);
  }

  award(t: Task, a: Agent, count: number, win: BidRecord, bids: BidRecord[], how: string, front = false): Commitment {
    const c: Commitment = { id: `C${++this.ids.commit}`, taskId: t.id, agentId: a.id, count, awardedTick: this.tick, bid: win.bid, phase: "queued" };
    if (front) a.queue.unshift(c);
    else a.queue.push(c);
    t.committed += count;
    t.awards++;
    if (t.status === "open") t.status = "assigned";
    const inc = t.incidentId ? this.incidents.get(t.incidentId) : undefined;
    if (inc && inc.status === "open") inc.status = "assigned";
    const sorted = [...bids].filter((b) => Number.isFinite(b.bid)).sort((x, y) => x.bid - y.bid);
    const runner = sorted.find((b) => b.agent !== a.id);
    const label = inc ? `${inc.id} (${inc.people} ppl, ${inc.urgency})` : t.kind === "VERIFY" ? `verify ${t.edgeId ?? t.incidentId}` : t.id;
    const vs = runner ? ` vs ${runner.agent} ${runner.bid.toFixed(1)}` : " (sole bidder)";
    this.emit("AWARD", `${a.id} won ${t.kind} ${label} — bid ${win.bid.toFixed(1)}${vs}`, {
      reason: how,
      agent: a.id,
      task: t.id,
      incident: inc?.id,
      data: {
        commitment: c.id,
        count,
        bid: win,
        bids: bids.map((b) => ({ agent: b.agent, bid: Number.isFinite(b.bid) ? b.bid : null, eta: Number.isFinite(b.eta) ? b.eta : null, breakdown: b.breakdown, excluded: b.excluded })),
        priority: this.lastPriority.get(t.id) ?? this.computePriority(t),
        constraints: [
          `mode: ${t.mode}`,
          ...(t.skills.length ? [`skills: ${t.skills.join(", ")}`] : []),
          `capacity: ${a.capacity}${t.kind === "RESCUE" ? ` for ${count} of ${t.demand} people` : ""}`,
          `route avoids edges ${a.id} believes closed/contested`,
        ],
        strategy: this.strategyName,
      },
      severity: t.urgency === "critical" ? "critical" : "info",
    });
    // cascade bookkeeping: a released task found a new owner
    for (const cas of this.openCascades) {
      if (cas.pendingTasks.has(t.id)) {
        cas.pendingTasks.delete(t.id);
        cas.reassigned.push({ task: t.id, incident: t.incidentId ?? t.edgeId, agent: a.id, eta: win.eta, bids: sorted.slice(0, 3).map((b) => ({ agent: b.agent, bid: b.bid })), tick: this.tick });
        cas.explanation = cascadeExplanation(this, cas);
        if (cas.pendingTasks.size === 0 && cas.resolvedTick === undefined) cas.resolvedTick = this.tick;
      }
    }
    return c;
  }

  /** Leveled commitment support: lift a not-yet-started bundle item out for re-auction (no event). */
  softRelease(c: Commitment) {
    const a = this.agentById.get(c.agentId)!;
    const t = this.tasks.get(c.taskId);
    a.queue = a.queue.filter((x) => x.id !== c.id);
    if (t) t.committed = Math.max(0, t.committed - c.count);
  }

  restore(c: Commitment, count: number) {
    const a = this.agentById.get(c.agentId)!;
    const t = this.tasks.get(c.taskId)!;
    c.count = Math.max(1, count);
    if (c.phase === "to_site") a.queue.unshift(c);
    else a.queue.push(c);
    t.committed += c.count;
  }

  /** Log a decommit for a commitment already removed from its queue (soft-released and lost). */
  logDecommit(c: Commitment, reason: ReasonCode, detail: string) {
    const t = this.tasks.get(c.taskId);
    if (t) t.decommits++;
    this.emit("DECOMMIT", `${c.agentId} released ${t?.kind ?? "task"} ${t?.incidentId ?? c.taskId}: ${reason} — ${detail}`, { reason, agent: c.agentId, task: c.taskId, incident: t?.incidentId, data: { commitment: c.id, count: c.count, detail }, severity: "info" });
  }

  decommit(c: Commitment, reason: ReasonCode, detail: string) {
    const a = this.agentById.get(c.agentId)!;
    const t = this.tasks.get(c.taskId);
    a.queue = a.queue.filter((x) => x.id !== c.id);
    if (t) {
      if (c.phase !== "done" && c.pickedUp === undefined) t.committed = Math.max(0, t.committed - c.count);
      t.decommits++;
      if (t.committed === 0 && t.served === 0 && t.status === "assigned") t.status = "open";
      const inc = t.incidentId ? this.incidents.get(t.incidentId) : undefined;
      if (inc && inc.status === "assigned" && t.committed === 0) inc.status = "open";
      if (reason !== "TASK_RESOLVED" && reason !== "CENTRAL_REPLAN" && this.unassigned(t) > 0) this.released.add(t.id);
    }
    if (a.queue.length === 0 && a.status !== "failed" && a.onboard === 0) {
      a.path = [];
      a.target = null;
      if (a.status !== "refuelling" && a.status !== "returning") a.status = "idle";
    }
    this.emit("DECOMMIT", `${a.id} released ${t?.kind ?? "task"} ${t?.incidentId ?? t?.edgeId ?? c.taskId}: ${reason} — ${detail}`, {
      reason,
      agent: a.id,
      task: c.taskId,
      incident: t?.incidentId,
      data: { commitment: c.id, count: c.count, detail },
      severity: reason === "TASK_RESOLVED" ? "info" : "warn",
    });
    const cas = this.tickCascade;
    if (cas && reason !== "TASK_RESOLVED") {
      cas.cancelled.push({ commitment: c.id, task: c.taskId, incident: t?.incidentId ?? t?.edgeId, agent: a.id, reason, people: c.count });
      if (t && this.unassigned(t) > 0) cas.pendingTasks.add(t.id);
    }
    for (const rec of this.contradictions) {
      if (rec.resolvedTick === undefined || this.tick - rec.tick < 60) {
        if (detail.includes(rec.edge)) {
          rec.churn++;
          rec.lastImpactTick = this.tick;
        }
      }
    }
  }

  // ───────────────────────────── world & comms ─────────────────────────────

  isBlackout(nbhd: string): boolean {
    const until = this.blackouts.get(nbhd);
    return until !== undefined && this.tick < until;
  }

  private send(a: Agent, msg: Message) {
    if (this.omniscient) return;
    if (a.connected) this.inbox.push({ msg, at: this.tick + 1 });
    else a.outbox.push(msg);
  }

  private beginCascade(cause: { type: string; target: string; msg: string }) {
    if (!this.tickCascade || this.tickCascade.tick !== this.tick) {
      this.tickCascade = { tick: this.tick, causes: [], cancelled: [], reassigned: [], reroutes: [], explanation: [], pendingTasks: new Set() };
      this.cascades.push(this.tickCascade);
      this.openCascades.push(this.tickCascade);
    }
    this.tickCascade.causes.push(cause);
  }

  private applyEvent(ev: ScenarioEvent) {
    const w = this.world;
    switch (ev.type) {
      case "RAIN_SURGE":
        this.surges.push({ nbhds: ev.nbhds, delta: ev.delta, tick: ev.tick, duration: ev.duration });
        this.emit("RAIN_SURGE", `Rain surge: +${ev.delta.toFixed(1)} m over ${ev.nbhds.join(", ")}`, { severity: "warn" });
        break;
      case "EDGE_CLOSE":
      case "EDGE_OPEN": {
        const close = ev.type === "EDGE_CLOSE";
        if (close) this.truthClosed.add(ev.edge);
        else this.truthClosed.delete(ev.edge);
        this.emit(ev.type, `${close ? "Closure" : "Reopening"} of ${w.edgeById.get(ev.edge)?.label ?? ev.edge} (ground truth)`, { edge: ev.edge, severity: close ? "warn" : "good" });
        if (ev.announce) this.inbox.push({ msg: { from: ev.announce, to: "cop", kind: "report", tick: this.tick, payload: { edge: ev.edge, claim: close ? "closed" : "open", confidence: 0.95, source: ev.announce } }, at: this.tick });
        if (close) this.beginCascade({ type: "EDGE_CLOSE", target: ev.edge, msg: `${ev.edge} closed` });
        break;
      }
      case "BRIDGE_COLLAPSE": {
        const e = w.edgeById.get(ev.edge);
        this.truthClosed.add(ev.edge);
        this.emit("BRIDGE_COLLAPSE", `${e?.label ?? ev.edge} (${ev.edge}) collapsed${e?.sensor ? " — structural sensor alarm" : " — no sensor; awaiting field reports"}`, { edge: ev.edge, severity: "critical" });
        if (e?.sensor) this.inbox.push({ msg: { from: `sensor:${ev.edge}`, to: "cop", kind: "report", tick: this.tick, payload: { edge: ev.edge, claim: "closed", confidence: 1, source: "sensor" } }, at: this.tick });
        this.beginCascade({ type: "BRIDGE_COLLAPSE", target: ev.edge, msg: `${e?.label ?? ev.edge} collapsed` });
        break;
      }
      case "AGENT_FAILURE":
        this.failAgent(ev.agent, ev.cause ?? "engine failure");
        break;
      case "AGENT_RECOVER": {
        const a = this.agentById.get(ev.agent);
        if (a && a.status === "failed") {
          a.status = "idle";
          this.emit("AGENT_RECOVER", `${a.id} back in service`, { agent: a.id, severity: "good" });
        }
        break;
      }
      case "SHELTER_OVERFLOW":
        this.overflowShelter(ev.shelter, ev.walkIns ?? 0, ev.capacityDrop ?? 0);
        break;
      case "SOS": {
        const spec = ev.sos;
        const nbhd = spec.nbhd ?? w.nodes[spec.node ?? nearestNode(w, spec.x ?? 0, spec.y ?? 0)].nbhd;
        const at = !this.omniscient && this.isBlackout(nbhd) ? (this.blackouts.get(nbhd) ?? this.tick) : this.tick;
        this.sosQueue.push({ spec: { ...spec, nbhd }, at });
        break;
      }
      case "REPORT":
        this.inbox.push({ msg: { from: ev.source, to: "cop", kind: "report", tick: this.tick, payload: { edge: ev.edge, claim: ev.claim, confidence: ev.confidence, source: ev.source, note: ev.note } }, at: this.tick });
        break;
      case "SHELTER_REPORT": {
        const st = this.shelters.get(ev.shelter)!;
        const actualFree = st.capacity - st.occupancy - st.reservations.reduce((x, r) => x + r.count, 0);
        this.shelterClaims.push({ tick: this.tick, shelter: ev.shelter, claimFree: ev.claimFree, source: ev.source, actualFree, note: ev.note });
        const conflict = Math.abs(actualFree - ev.claimFree) > 10;
        this.emit("SHELTER_REPORT", `${ev.source} report: ${ev.shelter} has ~${ev.claimFree} free${conflict ? ` — CONFLICTS with shelter agent (${actualFree} free); shelter agent is authoritative for reservations` : ""}`, { shelter: ev.shelter, severity: conflict ? "warn" : "info" });
        break;
      }
      case "BLACKOUT":
        this.blackouts.set(ev.nbhd, this.tick + ev.duration);
        this.emit("BLACKOUT", `Communication blackout in ${ev.nbhd} for ${ev.duration} min`, { severity: "critical", data: { nbhd: ev.nbhd } });
        break;
      case "CONTROL_OVERRIDE":
        this.override(ev.action, ev.task, ev.agent, ev.reason);
        break;
      case "TRIPLE_FAILURE": {
        const bridge = ev.bridge === "auto" ? this.pickBridge() : ev.bridge;
        const agent = ev.agent === "auto" ? this.pickBoat() : ev.agent;
        const shelter = ev.shelter === "auto" ? this.pickShelter() : ev.shelter;
        this.emit("TRIPLE_FAILURE", `TRIPLE FAILURE injected: ${bridge} collapse + ${agent} failure + ${shelter} overflow`, { severity: "critical", data: { bridge, agent, shelter } });
        this.applyEvent({ tick: this.tick, type: "BRIDGE_COLLAPSE", edge: bridge });
        this.applyEvent({ tick: this.tick, type: "AGENT_FAILURE", agent, cause: "engine seized" });
        this.applyEvent({ tick: this.tick, type: "SHELTER_OVERFLOW", shelter, walkIns: ev.walkIns });
        break;
      }
    }
  }

  /** Most disruptive targets for an "auto" triple failure (makes the demo button robust to any state). */
  pickBridge(): string {
    let best = this.world.bridges[0];
    let bestN = -1;
    for (const b of this.world.bridges) {
      if (this.truthClosed.has(b)) continue;
      const e = this.world.edgeById.get(b)!;
      let n = 0;
      for (const a of this.agents) {
        const nodes = [a.node, a.next ?? -1, ...a.path];
        for (let i = 1; i < nodes.length; i++) if ((nodes[i - 1] === e.a && nodes[i] === e.b) || (nodes[i - 1] === e.b && nodes[i] === e.a)) n += 3;
        if (a.type === "ground") n += 0.01;
      }
      if (n > bestN) {
        bestN = n;
        best = b;
      }
    }
    return best;
  }

  pickBoat(): string {
    const boats = this.agents.filter((a) => a.type === "boat" && a.status !== "failed");
    boats.sort((a, b) => b.queue.length + b.onboard / 10 - (a.queue.length + a.onboard / 10) || a.id.localeCompare(b.id));
    return boats[0]?.id ?? "B-1";
  }

  pickShelter(): string {
    const list = [...this.shelters.values()].sort((a, b) => b.reservations.length - a.reservations.length || b.occupancy / b.capacity - a.occupancy / a.capacity);
    return list[0]?.id ?? "S2";
  }

  failAgent(id: string, cause: string) {
    const a = this.agentById.get(id);
    if (!a || a.status === "failed") return;
    a.status = "failed";
    a.failedTick = this.tick;
    a.failCause = cause;
    a.path = [];
    a.target = null;
    const commitments = [...a.queue];
    this.emit("AGENT_FAILURE", `${a.id} ${a.name} FAILED (${cause}) with ${a.onboard} on board and ${commitments.length} commitment(s)`, { agent: a.id, severity: "critical" });
    this.beginCascade({ type: "AGENT_FAILURE", target: a.id, msg: `${a.id} failed (${cause})` });
    // invariant 5: release in the same tick; strategies re-announce before the tick ends
    for (const c of commitments) this.decommit(c, "RESOURCE_FAILURE", `${a.id} ${cause}`);
    for (const s of this.shelters.values()) s.reservations = s.reservations.filter((r) => r.agentId !== a.id);
    if (a.onboard > 0) {
      const node = a.next ?? a.node;
      const people = a.onboard;
      a.onboard = 0;
      this.receiveSos(
        { id: `JS-${a.id.replace("-", "")}X`, tick: this.tick, node, x: a.x, y: a.y, people, urgency: "critical", needs: [], text: `Stranded on disabled boat ${a.id}`, source: "field", real: true },
        true,
      );
    }
    this.copAgents.set(a.id, { ...this.copAgents.get(a.id)!, status: "failed", t: this.tick });
  }

  overflowShelter(id: string, walkIns: number, capacityDrop: number) {
    const st = this.shelters.get(id);
    if (!st) return;
    st.occupancy += walkIns;
    st.capacity = Math.max(0, st.capacity - capacityDrop);
    const name = this.world.shelters.find((s) => s.id === id)?.name ?? id;
    this.emit("SHELTER_OVERFLOW", `${id} ${name} overflow: +${walkIns} walk-ins${capacityDrop ? `, capacity −${capacityDrop}` : ""} → ${st.occupancy}/${st.capacity}`, { shelter: id, severity: "critical" });
    this.beginCascade({ type: "SHELTER_OVERFLOW", target: id, msg: `${id} overflowed (${st.occupancy}/${st.capacity})` });
    // cancel newest reservations until the rest fit; affected boats re-reserve elsewhere THIS tick
    const sorted = [...st.reservations].sort((a, b) => b.tick - a.tick);
    for (const r of sorted) {
      const reserved = st.reservations.reduce((x, q) => x + q.count, 0);
      if (st.occupancy + reserved <= st.capacity) break;
      st.reservations = st.reservations.filter((q) => q.id !== r.id);
      const a = this.agentById.get(r.agentId)!;
      const c = a.queue.find((q) => q.shelterId === id && q.phase === "to_shelter");
      if (c) {
        c.shelterId = undefined;
        const ok = this.reserveShelter(a, c);
        const to = c.shelterId;
        if (this.tickCascade) this.tickCascade.reroutes.push({ agent: a.id, from: id, to, reason: "SHELTER_FULL" });
        this.emit("REROUTE", `${a.id} drop-off moved ${id} → ${to ?? "HOLDING (no shelter space)"}: SHELTER_FULL`, { agent: a.id, reason: "SHELTER_FULL", shelter: id, severity: "warn", data: { from: id, to } });
        if (ok && to) this.routeTo(a, c.dropNode!);
        else a.status = "holding";
      }
    }
  }

  override(action: "pin" | "veto", taskId: string, agentId: string, reason: string) {
    const a = this.agentById.get(agentId);
    const t = this.tasks.get(taskId);
    if (!a || !t) return;
    if (action === "veto") {
      a.vetoed.add(taskId);
      for (const c of a.queue.filter((q) => q.taskId === taskId && (q.phase === "queued" || q.phase === "to_site"))) this.decommit(c, "CONTROL_OVERRIDE", `veto: ${reason}`);
      this.emit("OVERRIDE", `Control room VETO: ${a.id} ✕ ${t.incidentId ?? t.id} — ${reason}`, { reason: "CONTROL_OVERRIDE", agent: a.id, task: t.id, severity: "warn" });
      return;
    }
    const cap = this.capable(a, t);
    if (cap || this.unassigned(t) <= 0) {
      this.emit("OVERRIDE_REJECTED", `Pin ${a.id} → ${t.incidentId ?? t.id} rejected by safety check: ${cap ?? "nothing left to assign"}`, { agent: a.id, task: t.id, severity: "warn" });
      return;
    }
    for (const c of a.queue.filter((q) => q.phase === "queued" || q.phase === "to_site")) this.decommit(c, "CONTROL_OVERRIDE", `pinned to ${t.incidentId ?? t.id}: ${reason}`);
    const bid = this.bid(a, t, { ignoreQueue: true, requireComms: false });
    this.award(t, a, t.kind === "RESCUE" ? Math.min(a.capacity, this.unassigned(t)) : 1, Number.isFinite(bid.bid) ? bid : { ...bid, bid: 0, eta: 0 }, [bid], "CONTROL_OVERRIDE", true);
    this.emit("OVERRIDE", `Control room PIN: ${a.id} → ${t.incidentId ?? t.id} — ${reason}`, { reason: "CONTROL_OVERRIDE", agent: a.id, task: t.id, severity: "warn" });
  }

  // ───────────────────────────── COP intake ─────────────────────────────

  receiveSos(spec: SosSpec, forceVerified = false) {
    const w = this.world;
    const node = spec.node ?? nearestNode(w, spec.x ?? 0, spec.y ?? 0);
    const n = w.nodes[node];
    const real = spec.real !== false;
    const recent = [...this.incidents.values()].flatMap((i) => i.reports).filter((r) => this.tick - r.receivedTick <= 15);
    const lastByPhone = spec.phone ? [...this.incidents.values()].flatMap((i) => i.reports).filter((r) => r.phone === spec.phone).sort((a, b) => b.tick - a.tick)[0] : undefined;
    const report: Report = {
      id: `R${++this.ids.rep}`,
      sosId: spec.id ?? `JS-${this.ids.rep}`,
      tick: spec.tick,
      receivedTick: this.tick,
      node,
      x: spec.x ?? n.x,
      y: spec.y ?? n.y,
      nbhd: n.nbhd,
      people: Math.max(1, spec.people),
      urgency: spec.urgency,
      needs: spec.needs ?? [],
      text: spec.text ?? "",
      phone: spec.phone,
      building: spec.building,
      source: spec.source ?? "citizen",
      real,
      risk: { score: 0, reasons: [] },
    };
    const depth = nodeDepth(n, (nb) => this.centralView().level(nb));
    report.risk = scoreRisk(report, { recent, depthAtNode: depth, areaFlooded: this.areaStatus(n.nbhd) !== "normal", gpsMismatch: spec.gpsMismatch, lastByPhone });

    if (this.omniscient && !real) {
      this.emit("SOS_FILTERED", `${report.sosId} filtered (oracle knows it is false)`, { severity: "info" });
      return;
    }
    const active = [...this.incidents.values()].filter((i) => i.status === "open" || i.status === "assigned" || i.status === "in_progress");
    const link = findCluster(active, report);
    if (link) {
      const inc = link.incident;
      inc.reports.push(report);
      this.sosIndex.set(report.sosId, inc.id);
      const est = estimatePeople(inc.reports);
      const before = inc.people;
      inc.people = Math.max(est.estimate, inc.rescued + this.onboardFor(inc.id));
      inc.peopleRange = est.range;
      if (URG_RANK[report.urgency] > URG_RANK[inc.urgency]) inc.urgency = report.urgency;
      inc.needs = [...new Set([...inc.needs, ...report.needs])] as Need[];
      inc.realPeople = estimatePeople(inc.reports.filter((r) => r.real)).estimate;
      inc.isReal = inc.reports.some((r) => r.real);
      if (report.risk.score > inc.risk.score) inc.risk = report.risk;
      this.emit("SOS_MERGED", `${report.sosId} merged into ${inc.id} (${link.why}) — est. ${inc.people} people (range ${est.range[0]}–${est.range[1]}, ${inc.reports.length} reports)`, { incident: inc.id, severity: "info", data: { sos: report.sosId, before, after: inc.people } });
      for (const tid of inc.taskIds) {
        const t = this.tasks.get(tid)!;
        if (t.status === "done" || t.status === "cancelled") continue;
        // one RESCUE task per incident: its demand tracks the (merged) people estimate
        if (t.kind === "RESCUE") t.demand = Math.max(t.served, inc.people);
        if (URG_RANK[inc.urgency] > URG_RANK[t.urgency]) t.urgency = inc.urgency;
      }
      return;
    }

    const id = `I-${String(++this.ids.inc).padStart(3, "0")}`;
    const est = estimatePeople([report]);
    const inc: Incident = {
      id,
      reports: [report],
      node,
      x: report.x,
      y: report.y,
      nbhd: n.nbhd,
      urgency: report.urgency,
      needs: report.needs,
      people: est.estimate,
      peopleRange: est.range,
      createdTick: spec.tick,
      knownTick: this.tick,
      verification: forceVerified || report.source === "field" ? "verified" : report.risk.score >= 0.5 ? "under_review" : "pending",
      risk: report.risk,
      status: "open",
      rescued: 0,
      taskIds: [],
      escalated: false,
      realPeople: real ? est.estimate : 0,
      isReal: real,
    };
    this.incidents.set(id, inc);
    this.sosIndex.set(report.sosId, id);
    const lag = spec.tick < this.tick ? ` (delayed ${this.tick - spec.tick} min)` : "";
    this.emit("SOS_RECEIVED", `${report.sosId} → ${id}: ${inc.people} people, ${inc.urgency}${inc.needs.length ? `, ${inc.needs.join("/")}` : ""} in ${n.nbhd}${lag}${inc.verification === "under_review" ? ` · risk ${report.risk.score} → review queue` : ""}`, {
      incident: id,
      severity: inc.urgency === "critical" ? "critical" : "info",
      data: { sos: report.sosId, risk: report.risk },
    });
    this.createTasks(inc);
  }

  onboardFor(incidentId: string): number {
    let n = 0;
    for (const a of this.agents) for (const c of a.queue) if (c.phase === "to_shelter" && this.tasks.get(c.taskId)?.incidentId === incidentId) n += c.pickedUp ?? 0;
    return n;
  }

  private newTask(partial: Omit<Task, "id" | "createdTick" | "served" | "committed" | "status" | "priority" | "decommits" | "awards">): Task {
    const t: Task = { ...partial, id: `T${++this.ids.task}`, createdTick: this.tick, served: 0, committed: 0, status: "open", priority: 0, decommits: 0, awards: 0 };
    this.tasks.set(t.id, t);
    return t;
  }

  private reachCache: { tick: number; boat: Tree; ground: Tree } | null = null;

  /** Who can physically get there (on the central picture)? Boats launch from ghats, ground teams from shelters. */
  reach(): { boat: Tree; ground: Tree } {
    if (!this.reachCache || this.reachCache.tick !== this.tick) {
      const v = this.centralView();
      this.reachCache = {
        tick: this.tick,
        boat: dijkstra(this.world, this.world.ghats, this.costFn(v, "boat")),
        ground: dijkstra(this.world, this.world.shelters.map((s) => s.node), this.costFn(v, "ground")),
      };
    }
    return this.reachCache;
  }

  private deriveMode(inc: Incident): Pick<Task, "kind" | "mode" | "skills" | "prefSkills"> {
    const depth = nodeDepth(this.world.nodes[inc.node], (nb) => this.centralView().level(nb));
    const medical = inc.needs.includes("injured") || inc.needs.includes("medical");
    const r = this.reach();
    const boatOk = Number.isFinite(r.boat.dist[inc.node]);
    const groundOk = Number.isFinite(r.ground.dist[inc.node]);
    const boat = boatOk ? depth >= 0.45 || !groundOk : !groundOk && depth >= CONFIG.BOAT_MIN_DEPTH;
    if (boat) return { kind: "RESCUE", mode: "boat", skills: [], prefSkills: medical ? ["first_aid"] : [] };
    if (medical && inc.urgency !== "critical") return { kind: "MEDICAL", mode: "ground", skills: ["first_aid"], prefSkills: [] };
    if (inc.urgency === "needs_help") return { kind: "SUPPLY", mode: "ground", skills: ["supplies"], prefSkills: [] };
    return { kind: "RESCUE", mode: "ground", skills: [], prefSkills: medical ? ["first_aid"] : ["logistics"] };
  }

  private createTasks(inc: Incident) {
    const m = this.deriveMode(inc);
    const t = this.newTask({ ...m, incidentId: inc.id, node: inc.node, nbhd: inc.nbhd, urgency: inc.urgency, demand: m.kind === "RESCUE" ? inc.people : 1 });
    inc.taskIds.push(t.id);
    if (inc.verification === "under_review" && inc.urgency !== "critical") {
      const v = this.newTask({ kind: "VERIFY", mode: "ground", skills: ["verification"], prefSkills: [], incidentId: inc.id, node: inc.node, nbhd: inc.nbhd, urgency: "urgent", demand: 1 });
      inc.taskIds.push(v.id);
      this.emit("VERIFY_TASK", `Verification task ${v.id} for ${inc.id} (risk ${inc.risk.score}: ${inc.risk.reasons.join("; ")}) — rescue NOT blocked`, { incident: inc.id, task: v.id, severity: "info" });
    }
  }

  private processInbox() {
    const due = this.inbox.filter((m) => m.at <= this.tick);
    this.inbox = this.inbox.filter((m) => m.at > this.tick);
    for (const { msg } of due) {
      if (msg.kind === "report") {
        const p = msg.payload as { edge: string; claim: "open" | "closed"; confidence: number; source: string; by?: string; note?: string };
        const res = applyReport(this.cop, p.edge, { claim: p.claim, confidence: p.confidence, source: p.source as never, by: p.by }, this.tick);
        const e = this.world.edgeById.get(p.edge);
        const label = e?.label ? `${e.label} (${p.edge})` : p.edge;
        if (res.statusBefore !== res.statusAfter || res.contradiction || res.resolved) {
          this.emit("BELIEF", `COP: ${label} ${res.statusBefore} → ${res.statusAfter} (${p.source}${p.by ? ` ${p.by}` : ""} says ${p.claim}, conf ${p.confidence})`, { edge: p.edge, severity: res.statusAfter === "closed" ? "warn" : "info" });
        }
        if (res.contradiction) this.openContradiction(p.edge);
        if (res.resolved) this.resolveContradiction(p.edge, p.claim);
      } else if (msg.kind === "gauge") {
        const p = msg.payload as { nbhd: string; level: number };
        const cur = this.cop.level.get(p.nbhd);
        if (!cur || cur.t <= this.tick) this.cop.level.set(p.nbhd, { level: p.level, t: this.tick });
      }
    }
    // SOS delivery (citizen outbox / SMS)
    const sos = this.sosQueue.filter((s) => s.at <= this.tick);
    this.sosQueue = this.sosQueue.filter((s) => s.at > this.tick);
    for (const s of sos) this.receiveSos(s.spec);
  }

  private openContradiction(edge: string) {
    const b = this.cop.edges.get(edge);
    const rec: ContradictionRecord = {
      id: `X${++this.ids.con}`,
      edge,
      tick: this.tick,
      sources: (b?.sources ?? []).map((s) => ({ source: s.source, claim: s.claim, confidence: s.confidence, tick: s.tick })),
      lastImpactTick: this.tick,
      wastedTrips: 0,
      churn: 0,
    };
    this.contradictions.push(rec);
    const e = this.world.edgeById.get(edge)!;
    const v = this.newTask({ kind: "VERIFY", mode: "ground", skills: ["verification"], prefSkills: [], edgeId: edge, node: e.a, nbhd: e.nbhd, urgency: "urgent", demand: 1 });
    rec.verifyTask = v.id;
    this.emit("CONTRADICTION", `CONFLICT on ${e.label ?? edge}: ${rec.sources.map((s) => `${s.source} says ${s.claim}`).join(" vs ")} → marked CONTESTED, safe routing (ground avoids, boats ×3), verification task ${v.id}`, { edge, task: v.id, severity: "warn" });
  }

  private resolveContradiction(edge: string, claim: "open" | "closed") {
    for (const rec of this.contradictions) {
      if (rec.edge === edge && rec.resolvedTick === undefined) {
        rec.resolvedTick = this.tick;
        rec.resolvedAs = claim;
        this.emit("CONTRADICTION_RESOLVED", `${edge} conflict resolved by direct observation: ${claim.toUpperCase()} (${this.tick - rec.tick} min after conflict)`, { edge, severity: "good" });
        if (rec.verifyTask) {
          const t = this.tasks.get(rec.verifyTask);
          if (t && t.status !== "done") {
            for (const a of this.agents) for (const c of [...a.queue]) if (c.taskId === t.id && c.phase !== "on_site") this.decommit(c, "TASK_RESOLVED", `${edge} already verified`);
            t.status = "done";
            t.doneTick = this.tick;
          }
        }
      }
    }
  }

  areaStatus(nbhd: string): AreaStatus {
    if (!this.omniscient && this.isBlackout(nbhd)) return "verification_pending";
    const level = this.centralView().level(nbhd);
    const nodes = this.world.nodes.filter((n) => n.nbhd === nbhd && n.kind !== "river");
    const wet = nodes.filter((n) => level - n.elev > 0.3).length / Math.max(1, nodes.length);
    if (wet > 0.25) return "flooded";
    if (wet > 0.05 || nodes.some((n) => level - n.elev > 0)) return "at_risk";
    return "normal";
  }

  // ───────────────────────────── agent motion ─────────────────────────────

  /** Plan a route on the agent's OWN beliefs. Returns minutes or null if unreachable. */
  routeTo(a: Agent, target: number): number | null {
    const view = this.viewFor(a);
    const escort = a.type === "ground" && a.onboard > 0;
    // an agent already on an edge finishes it (it was passable when entered) and plans from its far end
    const start = a.next ?? a.node;
    const tree = dijkstra(this.world, start, this.costFn(view, a.type, escort));
    const p = pathTo(tree, target);
    if (!p) return null;
    const old = a.path;
    a.path = p.slice(1);
    a.target = target;
    if (old.length && old.join() !== a.path.join() && a.target === target) {
      // genuine re-route (logged by caller where a reason is known)
    }
    return tree.dist[target];
  }

  /** Invariant-2 guard: whenever beliefs change, a planned path through a believed-impassable edge is replaced at once. */
  private ensureSafePath(a: Agent): void {
    if (a.status === "failed" || (a.path.length === 0 && a.next === null)) return;
    const cost = this.costFn(this.viewFor(a), a.type, a.type === "ground" && a.onboard > 0);
    const nodes = [a.next ?? a.node, ...a.path];
    let bad: string | null = null;
    for (let i = 1; !bad && i < nodes.length; i++) {
      const e = edgeBetween(this.world, nodes[i - 1], nodes[i])!;
      if (!Number.isFinite(cost(e, nodes[i - 1], nodes[i]))) bad = e;
    }
    if (!bad) return;
    if (a.target !== null && this.routeTo(a, a.target) !== null) {
      this.emit("REROUTE", `${a.id} re-routed: ${this.world.edgeById.get(bad)?.label ?? bad} (${bad}) now believed impassable`, { agent: a.id, edge: bad, reason: "ROUTE_BLOCKED" });
      for (const rec of this.contradictions) if (rec.edge === bad) {
        rec.churn++;
        rec.lastImpactTick = this.tick;
      }
      return;
    }
    a.path = [];
    const c = a.queue[0];
    if (c && c.phase === "to_shelter" && c.shelterId) {
      const st = this.shelters.get(c.shelterId)!;
      st.reservations = st.reservations.filter((r) => r.agentId !== a.id);
      this.emit("REROUTE", `${a.id} drop-off at ${c.shelterId} unreachable (${bad}) — re-reserving`, { agent: a.id, edge: bad, reason: "ROUTE_BLOCKED", severity: "warn" });
      c.shelterId = undefined;
      c.dropNode = undefined;
    } else this.blockedAgents.add(a.id);
  }

  private observeAt(a: Agent) {
    if (this.omniscient) return;
    const n = this.world.nodes[a.node];
    for (const { edge } of this.world.adj[a.node]) {
      const closed = this.truthClosed.has(edge);
      if (observeEdge(a.belief, edge, !closed, this.tick, a.id)) {
        this.send(a, { from: a.id, to: "cop", kind: "report", tick: this.tick, payload: { edge, claim: closed ? "closed" : "open", confidence: 1, source: "rescuer", by: a.id } });
      }
    }
    if (n.kind !== "river") {
      const truth = this.levelsTruth[n.nbhd];
      const mine = a.belief.level.get(n.nbhd);
      a.belief.level.set(n.nbhd, { level: truth, t: this.tick });
      if (!mine || Math.abs(mine.level - truth) > 0.12) this.send(a, { from: a.id, to: "cop", kind: "gauge", tick: this.tick, payload: { nbhd: n.nbhd, level: truth } });
    }
  }

  private move(a: Agent) {
    let budget = 1;
    let attempts = 0;
    const escort = a.type === "ground" && a.onboard > 0;
    const truthCost = this.costFn(this.truthView, a.type, escort);
    while (budget > 1e-6) {
      if (a.next === null) {
        if (a.path.length === 0) break;
        const nxt = a.path[0];
        const eid = edgeBetween(this.world, a.node, nxt);
        if (!eid) {
          a.path = [];
          break;
        }
        if (!Number.isFinite(truthCost(eid, a.node, nxt))) {
          // ROUTE VIOLATION (vs ground truth): agent physically reached an edge it planned to use that is impassable
          const why = this.truthClosed.has(eid) ? "closed" : `depth ${edgeDepth(this.world, this.world.edgeById.get(eid)!, (nb) => this.levelsTruth[nb]).toFixed(2)} m`;
          this.violations.push({ tick: this.tick, agent: a.id, edge: eid, why });
          for (const rec of this.contradictions) if (rec.edge === eid) rec.wastedTrips++;
          const e = this.world.edgeById.get(eid)!;
          this.emit("VIOLATION", `${a.id} reached ${e.label ?? eid} planning to cross — impassable (${why}); turned back & re-planning`, { agent: a.id, edge: eid, severity: "warn" });
          this.observeAt(a);
          if (this.omniscient) {
            this.invariantViolations.push({ tick: this.tick, id: 2, msg: `omniscient agent ${a.id} hit impassable ${eid}` });
          }
          if (this.truthClosed.has(eid) === false) {
            // depth-based: update both endpoints' neighbourhood levels
            for (const nid of [e.a, e.b]) {
              const nb = this.world.nodes[nid].nbhd;
              if (nb !== "RIV") a.belief.level.set(nb, { level: this.levelsTruth[nb], t: this.tick });
            }
          }
          const tgt = a.target;
          if (tgt === null || this.routeTo(a, tgt) === null || ++attempts > 3) {
            a.path = [];
            this.blockedAgents.add(a.id);
            break;
          }
          this.emit("REROUTE", `${a.id} re-routed around ${e.label ?? eid}: ROUTE_BLOCKED`, { agent: a.id, edge: eid, reason: "ROUTE_BLOCKED", severity: "info" });
          continue;
        }
        a.next = nxt;
        a.path.shift();
        a.progress = 0;
      }
      const eid = edgeBetween(this.world, a.node, a.next!)!;
      const e = this.world.edgeById.get(eid)!;
      const depth = edgeDepth(this.world, e, (nb) => this.levelsTruth[nb]);
      const sp = Math.max(2, speedKmh(a.type, e.kind, depth, escort));
      const remain = e.length - a.progress;
      const need = (remain / sp) * 60;
      if (need <= budget) {
        budget -= need;
        a.stats.km += remain;
        if (a.type === "boat") a.fuel -= need;
        a.node = a.next!;
        a.next = null;
        a.progress = 0;
        this.observeAt(a);
      } else {
        a.progress += (sp * budget) / 60;
        a.stats.km += (sp * budget) / 60;
        if (a.type === "boat") a.fuel -= budget;
        budget = 0;
      }
    }
    const n0 = this.world.nodes[a.node];
    if (a.next !== null) {
      const n1 = this.world.nodes[a.next];
      const e = this.world.edgeById.get(edgeBetween(this.world, a.node, a.next)!)!;
      const f = Math.min(1, a.progress / Math.max(1e-6, e.length));
      a.x = n0.x + (n1.x - n0.x) * f;
      a.y = n0.y + (n1.y - n0.y) * f;
    } else {
      a.x = n0.x;
      a.y = n0.y;
    }
  }

  private arrived(a: Agent, target: number) {
    return a.next === null && a.node === target && a.path.length === 0;
  }

  reserveShelter(a: Agent, c: Commitment): boolean {
    const t = this.tasks.get(c.taskId)!;
    const inc = t.incidentId ? this.incidents.get(t.incidentId) : undefined;
    const preferMedical = !!inc?.needs.some((n) => n === "injured" || n === "medical");
    const s = this.nearestShelterFor(this.viewFor(a), a.type, a.next ?? a.node, a.onboard, preferMedical, true);
    if (!s) return false;
    const st = this.shelters.get(s.id)!;
    st.reservations.push({ id: `RSV${++this.ids.res}`, agentId: a.id, count: a.onboard, tick: this.tick });
    c.shelterId = s.id;
    c.dropNode = s.dropNode;
    const landing = s.dropNode !== this.world.shelters.find((x) => x.id === s.id)!.node;
    this.emit("RESERVATION", `${s.id} confirmed ${a.onboard} places for ${a.id}${landing ? ` (hand-over at landing node ${s.dropNode})` : ""}`, { agent: a.id, shelter: s.id, severity: "info" });
    return true;
  }

  private act(a: Agent) {
    if (a.status === "failed") return;
    if (a.status === "refuelling") {
      if (--a.workLeft <= 0) {
        a.fuel = a.fuelMax;
        a.status = "idle";
        this.emit("REFUELLED", `${a.id} refuelled`, { agent: a.id });
      }
      return;
    }
    const c = a.queue[0];
    if (!c) {
      if (a.type === "boat" && a.fuel < CONFIG.FUEL_RESERVE * 2.5 && a.status !== "returning") {
        if (this.routeTo(a, a.baseNode) !== null) {
          a.status = "returning";
          this.emit("RETURNING", `${a.id} returning to base to refuel (${Math.round(a.fuel)} min fuel)`, { agent: a.id });
        }
      }
      if (a.status === "returning") {
        this.move(a);
        if (this.arrived(a, a.baseNode)) {
          a.status = "refuelling";
          a.workLeft = CONFIG.REFUEL_TICKS;
        }
        return;
      }
      if (a.next !== null) this.move(a);
      a.status = "idle";
      return;
    }
    const t = this.tasks.get(c.taskId)!;
    const inc = t.incidentId ? this.incidents.get(t.incidentId) : undefined;

    if (c.phase === "queued") {
      if (this.routeTo(a, t.node) === null) {
        this.decommit(c, "ROUTE_BLOCKED", `no route to ${inc?.id ?? t.edgeId ?? t.id} on ${a.id}'s map`);
        return;
      }
      c.phase = "to_site";
      a.status = "en_route";
    }
    if (c.phase === "to_site") {
      if (a.target !== t.node && this.routeTo(a, t.node) === null) {
        this.decommit(c, "ROUTE_BLOCKED", `no route to ${inc?.id ?? t.id}`);
        return;
      }
      this.move(a);
      if (this.blockedAgents.has(a.id)) return;
      if (!this.arrived(a, t.node)) return;
      // ON SITE
      c.phase = "on_site";
      if (inc) {
        if (!inc.isReal) {
          this.falseTrips++;
          inc.status = "false_report";
          inc.verification = "needs_attention";
          inc.resolvedTick = this.tick;
          this.emit("FALSE_REPORT", `${a.id} on site at ${inc.id}: nobody found — report flagged false (wasted trip)`, { agent: a.id, incident: inc.id, severity: "warn" });
          for (const tid of inc.taskIds) {
            const tt = this.tasks.get(tid)!;
            for (const ag of this.agents) for (const cc of [...ag.queue]) if (cc.taskId === tid && cc.id !== c.id) this.decommit(cc, "INFO_CONTRADICTED", `${inc.id} found empty on site`);
            tt.status = "cancelled";
          }
          a.queue = a.queue.filter((q) => q.id !== c.id);
          a.status = a.queue.length ? "en_route" : "idle";
          return;
        }
        if (inc.verification !== "verified") {
          inc.verification = "verified";
          this.emit("VERIFIED", `${inc.id} verified on site by ${a.id}`, { incident: inc.id, agent: a.id, severity: "good" });
        }
        if (inc.firstServedTick === undefined) inc.firstServedTick = this.tick;
        if (inc.status === "open" || inc.status === "assigned") inc.status = "in_progress";
      }
      if (t.firstServedTick === undefined) t.firstServedTick = this.tick;
      t.status = "in_progress";
      a.workLeft = this.workTicks(t, c.count);
      a.status = t.kind === "RESCUE" ? "rescuing" : "working";
      this.emit("ON_SITE", `${a.id} on site at ${inc?.id ?? t.edgeId ?? t.id} (${t.kind})`, { agent: a.id, task: t.id, incident: inc?.id, severity: "good" });
      return;
    }
    if (c.phase === "on_site" || (c.phase === "to_shelter" && a.status === "holding")) {
      if (a.next !== null) this.move(a);
      if (a.status === "holding") {
        if (this.reserveShelter(a, c)) {
          c.phase = "to_shelter";
          a.status = "transporting";
          this.routeTo(a, c.dropNode!);
        }
        return;
      }
      if (--a.workLeft > 0) return;
      this.completeSite(a, c, t, inc);
      return;
    }
    if (c.phase === "to_shelter") {
      if (!c.shelterId) {
        if (this.reserveShelter(a, c)) this.routeTo(a, c.dropNode!);
        else {
          a.status = "holding";
          return;
        }
      }
      const sn = c.dropNode!;
      if (a.target !== sn && this.routeTo(a, sn) === null) {
        // shelter unreachable on own map → pick another reachable shelter
        const st = this.shelters.get(c.shelterId!)!;
        st.reservations = st.reservations.filter((r) => r.agentId !== a.id);
        const from = c.shelterId;
        c.shelterId = undefined;
        if (this.reserveShelter(a, c)) {
          this.emit("REROUTE", `${a.id} drop-off ${from} → ${c.shelterId}: ROUTE_BLOCKED`, { agent: a.id, reason: "ROUTE_BLOCKED", severity: "warn" });
          if (this.tickCascade) this.tickCascade.reroutes.push({ agent: a.id, from, to: c.shelterId, reason: "ROUTE_BLOCKED" });
          this.routeTo(a, c.dropNode!);
        } else a.status = "holding";
        return;
      }
      a.status = "transporting";
      this.move(a);
      if (this.blockedAgents.has(a.id)) {
        // try alternative shelter next tick
        const st = this.shelters.get(c.shelterId!)!;
        st.reservations = st.reservations.filter((r) => r.agentId !== a.id);
        c.shelterId = undefined;
        return;
      }
      if (this.arrived(a, sn)) this.drop(a, c, t, inc);
    }
  }

  private completeSite(a: Agent, c: Commitment, t: Task, inc: Incident | undefined) {
    if (t.kind === "RESCUE" && inc) {
      const remainingReal = Math.max(0, inc.realPeople - this.pickedFor(inc.id));
      if (inc.realPeople > inc.people) {
        this.emit("COUNT_CORRECTED", `${a.id} on-site count at ${inc.id}: ${inc.people} → ${inc.realPeople}`, { incident: inc.id, agent: a.id, severity: "info" });
        inc.people = inc.realPeople;
        t.demand = Math.max(t.demand, inc.realPeople - (inc.rescued + this.onboardFor(inc.id)) + t.served);
      }
      const take = Math.min(c.count, a.capacity - a.onboard, remainingReal);
      t.committed = Math.max(0, t.committed - c.count);
      c.pickedUp = take;
      if (take <= 0) {
        a.queue.shift();
        a.status = a.queue.length ? "en_route" : "idle";
        this.emit("SITE_CLEAR", `${a.id} found ${inc.id} already cleared`, { agent: a.id, incident: inc.id });
        this.closeIfDone(t, inc);
        return;
      }
      a.onboard += take;
      t.served += take;
      this.emit("PICKUP", `${a.id} picked up ${take} at ${inc.id} (${a.onboard}/${a.capacity} on board)`, { agent: a.id, incident: inc.id, severity: "good" });
      if (remainingReal - take <= 0) {
        // site cleared: correct the estimate and release other commitments that are no longer needed
        t.demand = t.served;
        inc.people = Math.min(inc.people, inc.realPeople);
        for (const ag of this.agents) for (const cc of [...ag.queue]) if (cc.taskId === t.id && cc.id !== c.id && cc.pickedUp === undefined) this.decommit(cc, "TASK_RESOLVED", `${inc.id} cleared by ${a.id}`);
      }
      c.phase = "to_shelter";
      if (this.reserveShelter(a, c)) {
        a.status = "transporting";
        this.routeTo(a, c.dropNode!);
      } else {
        a.status = "holding";
        c.phase = "on_site";
        this.emit("HOLDING", `${a.id} holding with ${a.onboard} people — no shelter reservation available`, { agent: a.id, severity: "warn" });
      }
      return;
    }
    // MEDICAL / SUPPLY / VERIFY
    t.served = 1;
    t.committed = Math.max(0, t.committed - c.count);
    c.phase = "done";
    a.queue.shift();
    if (t.kind === "VERIFY") {
      if (t.edgeId) {
        const closed = this.truthClosed.has(t.edgeId);
        observeEdge(a.belief, t.edgeId, !closed, this.tick, a.id);
        this.inbox.push({ msg: { from: a.id, to: "cop", kind: "report", tick: this.tick, payload: { edge: t.edgeId, claim: closed ? "closed" : "open", confidence: 1, source: "rescuer", by: a.id } }, at: this.omniscient ? this.tick : this.tick + 1 });
        this.emit("VERIFIED", `${a.id} verified ${this.world.edgeById.get(t.edgeId)?.label ?? t.edgeId}: ${closed ? "CLOSED" : "OPEN"}`, { agent: a.id, edge: t.edgeId, severity: "good" });
      } else if (inc) {
        inc.verification = inc.isReal ? "verified" : "needs_attention";
        if (!inc.isReal) {
          inc.status = "false_report";
          for (const tid of inc.taskIds) {
            const tt = this.tasks.get(tid)!;
            for (const ag of this.agents) for (const cc of [...ag.queue]) if (cc.taskId === tid) this.decommit(cc, "INFO_CONTRADICTED", `${inc.id} verified false by ${a.id}`);
            tt.status = "cancelled";
          }
        }
        this.emit("VERIFIED", `${a.id} verified ${inc.id}: ${inc.isReal ? "GENUINE" : "FALSE — tasks cancelled"}`, { agent: a.id, incident: inc.id, severity: inc.isReal ? "good" : "warn" });
      }
    }
    t.status = "done";
    t.doneTick = this.tick;
    a.status = a.queue.length ? "en_route" : "idle";
    if (inc) this.closeIfDone(t, inc);
  }

  pickedFor(incidentId: string): number {
    let n = 0;
    for (const tid of this.incidents.get(incidentId)?.taskIds ?? []) {
      const t = this.tasks.get(tid)!;
      if (t.kind === "RESCUE") n += t.served;
    }
    return n;
  }

  private drop(a: Agent, c: Commitment, t: Task, inc: Incident | undefined) {
    const st = this.shelters.get(c.shelterId!)!;
    const r = st.reservations.find((x) => x.agentId === a.id);
    const ok = !!r && st.occupancy + a.onboard <= st.capacity;
    this.dropChecks.push({ ok, msg: ok ? "" : `${a.id} dropped at ${st.id} without valid reservation/capacity` });
    st.reservations = st.reservations.filter((x) => x.agentId !== a.id);
    st.occupancy += a.onboard;
    if (inc) inc.rescued += a.onboard;
    this.emit("DROP", `${a.id} delivered ${a.onboard} to ${st.id} (${st.occupancy}/${st.capacity})`, { agent: a.id, shelter: st.id, incident: inc?.id, severity: "good" });
    a.onboard = 0;
    c.phase = "done";
    a.queue.shift();
    a.status = a.queue.length ? "en_route" : "idle";
    a.path = [];
    a.target = null;
    if (inc) this.closeIfDone(t, inc);
  }

  private closeIfDone(t: Task, inc: Incident) {
    if (t.kind === "RESCUE" && t.served >= t.demand && t.committed === 0 && this.onboardFor(inc.id) === 0) {
      t.status = "done";
      t.doneTick = this.tick;
    }
    const allDone = inc.taskIds.every((id) => {
      const x = this.tasks.get(id)!;
      return x.status === "done" || x.status === "cancelled";
    });
    if (allDone && inc.status !== "false_report" && inc.status !== "resolved") {
      inc.status = "resolved";
      inc.resolvedTick = this.tick;
      this.emit("RESOLVED", `${inc.id} resolved — ${inc.rescued} people safe (${inc.resolvedTick - inc.createdTick} min after first SOS)`, { incident: inc.id, severity: "good" });
    }
  }

  // ───────────────────────────── per-tick maintenance ─────────────────────────────

  /** Common MONITOR phase (identical for all strategies): invalid commitments → decommit with reason. */
  private monitor() {
    for (const a of this.agents) {
      if (a.status === "failed") continue;
      for (const c of [...a.queue]) {
        const t = this.tasks.get(c.taskId);
        if (!t || t.status === "cancelled" || (t.status === "done" && c.phase !== "to_shelter")) {
          if (c.phase !== "to_shelter") this.decommit(c, "TASK_RESOLVED", "task closed");
          continue;
        }
        if (c.phase === "to_site" && c === a.queue[0]) {
          // does the planned path still avoid edges we now believe impassable?
          const view = this.viewFor(a);
          const cost = this.costFn(view, a.type);
          const nodes = [a.next ?? a.node, ...a.path];
          let bad: string | null = null;
          for (let i = 1; i < nodes.length; i++) {
            const e = edgeBetween(this.world, nodes[i - 1], nodes[i])!;
            if (!Number.isFinite(cost(e, nodes[i - 1], nodes[i]))) {
              bad = e;
              break;
            }
          }
          if (bad) {
            const label = this.world.edgeById.get(bad)?.label ?? bad;
            const oldPath = [...nodes];
            if (this.routeTo(a, t.node) === null) this.decommit(c, "ROUTE_BLOCKED", `${label} (${bad}) now impassable, no alternative route`);
            else {
              this.emit("REROUTE", `${a.id} re-routed: ${label} (${bad}) believed impassable`, { agent: a.id, edge: bad, reason: "ROUTE_BLOCKED", data: { oldPath, newPath: [a.next ?? a.node, ...a.path] } });
              if (this.tickCascade) this.tickCascade.reroutes.push({ agent: a.id, reason: `ROUTE_BLOCKED (${bad})` });
              for (const rec of this.contradictions) if (rec.edge === bad) {
                rec.churn++;
                rec.lastImpactTick = this.tick;
              }
            }
          }
        }
      }
      this.ensureSafePath(a);
      if (this.blockedAgents.has(a.id)) {
        const c = a.queue[0];
        if (c && (c.phase === "to_site" || c.phase === "queued")) this.decommit(c, "ROUTE_BLOCKED", `${a.id} blocked en route, no alternative`);
        else if (a.status === "returning") a.status = "idle";
      }
    }
    this.blockedAgents.clear();
  }

  private maintainTasks() {
    // neighbourhood lag for the fairness term
    const waits: Record<string, number[]> = {};
    let all: number[] = [];
    for (const inc of this.incidents.values()) {
      if (inc.status === "merged" || inc.status === "false_report") continue;
      const wv = (inc.firstServedTick ?? this.tick) - inc.createdTick;
      (waits[inc.nbhd] ??= []).push(wv);
      all.push(wv);
    }
    const gm = all.length ? all.reduce((s, x) => s + x, 0) / all.length : 0;
    for (const n of this.world.nbhds) {
      const v = waits[n.id];
      const m = v?.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
      this.nbhdLag[n.id] = gm > 0 ? m / gm - 1 : 0;
    }
    all = [];

    for (const t of this.tasks.values()) {
      if (t.status === "done" || t.status === "cancelled") continue;
      const inc = t.incidentId ? this.incidents.get(t.incidentId) : undefined;
      // re-derive mode while untouched (water rose/fell at the site)
      if (inc && t.kind !== "VERIFY" && t.committed === 0 && t.served === 0) {
        const m = this.deriveMode(inc);
        if (m.mode !== t.mode || m.kind !== t.kind) {
          this.emit("TASK_MODE", `${inc.id} now needs ${m.kind}/${m.mode} (water at site changed)`, { incident: inc.id, task: t.id });
          Object.assign(t, m);
          t.demand = m.kind === "RESCUE" ? inc.people : 1;
        }
        t.urgency = inc.urgency;
      }
      // starvation guard (invariant 6)
      if (inc && !inc.escalated && t.firstServedTick === undefined && inc.firstServedTick === undefined) {
        const wait = this.tick - inc.createdTick;
        if (wait > CONFIG.MAX_WAIT[inc.urgency]) {
          inc.escalated = true;
          inc.escalatedTick = this.tick;
          this.emit("ESCALATED", `${inc.id} waiting ${wait} min (> ${CONFIG.MAX_WAIT[inc.urgency]} for ${inc.urgency}) — ESCALATED to control room`, { incident: inc.id, severity: "critical" });
        }
      }
    }
  }

  private updateConnectivity() {
    for (const [nb, until] of this.blackouts) {
      if (this.tick === until) this.emit("BLACKOUT_END", `Communications restored in ${nb}`, { severity: "good" });
    }
    for (const a of this.agents) {
      const nb = this.world.nodes[a.node].nbhd;
      const was = a.connected;
      a.connected = this.omniscient || !this.isBlackout(nb);
      if (!was && a.connected && a.outbox.length) {
        for (const m of a.outbox) this.inbox.push({ msg: m, at: this.tick });
        this.emit("OUTBOX_FLUSH", `${a.id} reconnected — ${a.outbox.length} queued field reports delivered`, { agent: a.id, severity: "good" });
        a.outbox = [];
      }
    }
  }

  private gauges() {
    if (this.tick % CONFIG.GAUGE_PERIOD !== 0) return;
    for (const n of this.world.nbhds) {
      if (!this.omniscient && this.isBlackout(n.id)) continue;
      const noise = (hashUnit(this.scenario.seed, "g", this.tick, n.id) - 0.5) * 2 * CONFIG.GAUGE_NOISE;
      this.inbox.push({ msg: { from: `gauge:${n.id}`, to: "cop", kind: "gauge", tick: this.tick, payload: { nbhd: n.id, level: this.levelsTruth[n.id] + noise } }, at: this.tick });
    }
  }

  private broadcastCop() {
    if (this.omniscient) return;
    for (const a of this.agents) {
      if (!a.connected || a.status === "failed") continue;
      mergeBeliefs(a.belief, this.cop);
      this.copAgents.set(a.id, { x: a.x, y: a.y, node: a.next ?? a.node, status: a.status, t: this.tick, onboard: a.onboard });
    }
  }

  // ───────────────────────────── main loop ─────────────────────────────

  inject(ev: InjectEvent) {
    const e = { ...ev, tick: Math.max(this.tick, ev.tick ?? this.tick) } as ScenarioEvent;
    this.pending.push(e);
    this.pending.sort((a, b) => a.tick - b.tick);
  }

  get done() {
    return this.tick >= this.scenario.duration;
  }

  step() {
    if (this.done) return;
    this.considered.clear();
    this.released.clear();
    this.dropChecks = [];
    this.treeCache.clear();
    if (this.tickCascade && this.tickCascade.tick !== this.tick) this.tickCascade = null;

    // 1. flood dynamics (truth)
    for (const n of this.world.nbhds) this.levelsTruth[n.id] = truthLevel(this.scenario, n.id, this.tick, this.surges);
    // 2. injected events
    while (this.pending.length && this.pending[0].tick <= this.tick) this.applyEvent(this.pending.shift()!);
    // 3. comms + COP fusion
    this.updateConnectivity();
    this.gauges();
    this.processInbox();
    this.broadcastCop();
    // 4. tasks: mode, escalation, fairness lag
    this.maintainTasks();
    // 5. MONITOR + ALLOCATE (strategy) — same tick re-announcement of released work
    this.cacheOn = true;
    this.monitor();
    this.criticalAtAlloc = new Set([...this.tasks.values()].filter((t) => t.urgency === "critical" && this.unassigned(t) > 0).map((t) => t.id));
    this.strategy.allocate(this);
    this.cacheOn = false;
    this.treeCache.clear();
    // 6. agents act (move/serve), observe, report
    const openModes = new Set([...this.tasks.values()].filter((t) => this.unassigned(t) > 0).map((t) => t.mode));
    for (const a of this.agents) {
      this.act(a);
      this.ensureSafePath(a);
      if (a.status !== "failed") {
        a.stats.alive++;
        if (a.status === "idle") {
          a.stats.idle++;
          if (openModes.has(a.type)) a.stats.idleWhileDemand++;
        } else a.stats.busy++;
      }
    }
    // 6b. work released while acting (blocked routes, false reports) is re-announced in the SAME tick
    if ([...this.released].some((id) => !this.considered.has(id))) {
      this.cacheOn = true;
      this.strategy.allocate(this);
      this.cacheOn = false;
      this.treeCache.clear();
    }
    // 7. invariants + metrics + frame
    for (const v of checkInvariants(this)) {
      this.invariantViolations.push({ tick: this.tick, ...v });
      this.emit("INVARIANT", `Invariant ${v.id} violated: ${v.msg}`, { severity: "critical" });
    }
    for (const cas of this.openCascades) {
      cas.explanation = cascadeExplanation(this, cas);
    }
    this.openCascades = this.openCascades.filter((c) => c.pendingTasks.size > 0 && this.tick - c.tick < 90);
    const k = computeKpis(this);
    this.series.push({ tick: this.tick, openSos: k.openSos, critical: k.criticalWaiting, p90: k.p90Wait, idlePct: k.idlePct, violations: k.violations, fairness: k.fairness, rescued: k.rescued });
    if (this.recordFrames) this.frames.push(this.frame(k));
    this.tick++;
  }

  run(until = this.scenario.duration) {
    while (this.tick < until && !this.done) this.step();
    return this;
  }

  /** Aggregates for the one-way rescue → relief contract (verified incidents only; no ids leave). */
  areaInputs() {
    return this.world.nbhds.map((n) => ({
      id: n.id,
      name: n.name,
      status: this.areaStatus(n.id),
      incidents: [...this.incidents.values()]
        .filter((i) => i.nbhd === n.id && i.isReal && i.status !== "merged" && i.status !== "false_report")
        .map((i) => ({ verified: i.verification === "verified", people: i.people, rescued: i.rescued, needs: i.needs as string[] })),
    }));
  }

  /** ETA (min) for a commitment from the agent's own beliefs. */
  etaFor(a: Agent, c: Commitment): number | null {
    const t = this.tasks.get(c.taskId);
    if (!t) return null;
    if (c.phase === "on_site" || c.phase === "to_shelter" || c.phase === "done") return 0;
    const view = this.viewFor(a);
    const idx = a.queue.indexOf(c);
    let before = 0;
    let node = a.next ?? a.node;
    if (idx > 0) {
      const prior: Agent = { ...a, queue: a.queue.slice(0, idx) };
      const av = this.availability(prior, view);
      before = av.minutes;
      node = av.node;
    }
    const m = before + this.travel(view, a.type, node, t.node);
    return Number.isFinite(m) ? Math.round(m) : null;
  }

  /** Live bridge: status of every SOS that came from a real phone (source "live"). */
  liveStatus(): Record<string, { incident: string; status: Incident["status"]; verification: Incident["verification"]; people: number; reports: number; unit?: string; unitType?: AgentType; eta?: number | null; pos?: { x: number; y: number }; mergedWith?: number }> {
    const out: ReturnType<Simulation["liveStatus"]> = {};
    for (const inc of this.incidents.values()) {
      const live = inc.reports.filter((r) => r.source === "live");
      if (!live.length) continue;
      let unit: Agent | undefined;
      let com: Commitment | undefined;
      for (const a of this.agents) {
        const c = a.queue.find((q) => inc.taskIds.includes(q.taskId) && this.tasks.get(q.taskId)?.kind !== "VERIFY");
        if (c && (!com || (c.phase !== "queued" && com.phase === "queued"))) {
          unit = a;
          com = c;
        }
      }
      for (const r of live) {
        out[r.sosId] = {
          incident: inc.id,
          status: inc.status,
          verification: inc.verification,
          people: inc.people,
          reports: inc.reports.length,
          unit: unit?.id,
          unitType: unit?.type,
          eta: unit && com ? this.etaFor(unit, com) : undefined,
          pos: unit ? { x: unit.x, y: unit.y } : undefined,
          mergedWith: inc.reports.length - 1,
        };
      }
    }
    return out;
  }

  /** Live bridge: what each unit's crew phone should show. */
  units() {
    return this.agents.map((a) => {
      const c = a.queue[0];
      const t = c ? this.tasks.get(c.taskId) : undefined;
      const inc = t?.incidentId ? this.incidents.get(t.incidentId) : undefined;
      const award = c ? [...this.log].reverse().find((e) => e.type === "AWARD" && e.agent === a.id && e.task === c.taskId) : undefined;
      const bids = (award?.data?.bids as { agent: string; bid: number | null }[] | undefined)?.filter((b) => b.bid !== null).sort((x, y) => x.bid! - y.bid!) ?? [];
      const runner = bids.find((b) => b.agent !== a.id);
      const shelter = c?.shelterId ? this.world.shelters.find((s) => s.id === c.shelterId) : undefined;
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        status: a.status,
        onboard: a.onboard,
        capacity: a.capacity,
        fuel: a.type === "boat" ? Math.round(a.fuel) : null,
        fuelMax: a.type === "boat" ? a.fuelMax : null,
        skills: a.skills,
        connected: a.connected,
        x: a.x,
        y: a.y,
        route: [[a.x, a.y] as [number, number], ...(a.next !== null ? [a.next] : []).concat(a.path).map((n) => [this.world.nodes[n].x, this.world.nodes[n].y] as [number, number])],
        queue: a.queue.length,
        task: t
          ? {
              id: t.id,
              kind: t.kind,
              incident: inc?.id,
              people: c!.count,
              urgency: t.urgency,
              needs: inc?.needs ?? [],
              phase: c!.phase,
              eta: this.etaFor(a, c!),
              site: { x: this.world.nodes[t.node].x, y: this.world.nodes[t.node].y },
              shelter: shelter ? { id: shelter.id, name: shelter.name } : undefined,
              why: award ? `${award.reason === "CNP" ? "Won auction" : award.reason === "CONTROL_OVERRIDE" ? "Pinned by control room" : "Assigned by planner"}: ${c!.bid.toFixed(1)} min${runner ? ` vs ${runner.agent} ${runner.bid!.toFixed(1)}` : ""}` : undefined,
              sos: inc?.reports.filter((r) => r.source === "live").map((r) => r.sosId) ?? [],
            }
          : null,
      };
    });
  }

  frame(kpis = computeKpis(this)): Frame {
    const w = this.world;
    const cop = this.centralView();
    let edgeCop = "";
    let edgeTruth = "";
    for (const e of w.edges) {
      const s = cop.status(e.id);
      edgeCop += s === "open" ? "o" : s === "closed" ? "c" : s === "unknown" ? "u" : "x";
      edgeTruth += this.truthClosed.has(e.id) ? "c" : "o";
    }
    const levelsCop: Record<string, number> = {};
    const areaStatus: Record<string, AreaStatus> = {};
    for (const n of w.nbhds) {
      levelsCop[n.id] = Math.round(cop.level(n.id) * 100) / 100;
      areaStatus[n.id] = this.areaStatus(n.id);
    }
    return {
      tick: this.tick,
      agents: this.agents.map((a) => {
        const route: [number, number][] = [[a.x, a.y]];
        if (a.next !== null) route.push([w.nodes[a.next].x, w.nodes[a.next].y]);
        for (const p of a.path) route.push([w.nodes[p].x, w.nodes[p].y]);
        const seen = this.copAgents.get(a.id);
        return {
          id: a.id,
          type: a.type,
          x: Math.round(a.x * 1000) / 1000,
          y: Math.round(a.y * 1000) / 1000,
          status: a.status,
          onboard: a.onboard,
          capacity: a.capacity,
          fuel: Math.round(a.type === "boat" ? a.fuel : 999),
          connected: a.connected,
          route: route.length > 1 ? route : [],
          task: a.queue[0]?.taskId,
          lastSeen: seen?.t,
        };
      }),
      incidents: [...this.incidents.values()]
        .filter((i) => i.status !== "merged" && !(i.status === "resolved" && this.tick - (i.resolvedTick ?? 0) > 20))
        .map((i) => ({
          id: i.id,
          x: i.x,
          y: i.y,
          people: i.people,
          urgency: i.urgency,
          status: i.status,
          verification: i.verification,
          reports: i.reports.length,
          escalated: i.escalated,
          nbhd: i.nbhd,
          wait: (i.firstServedTick ?? this.tick) - i.createdTick,
        })),
      edgeCop,
      edgeTruth,
      levels: Object.fromEntries(Object.entries(this.levelsTruth).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      levelsCop,
      areaStatus,
      shelters: [...this.shelters.values()].map((s) => ({ id: s.id, occupancy: s.occupancy, reserved: s.reservations.reduce((x, r) => x + r.count, 0), capacity: s.capacity })),
      blackout: [...this.blackouts.entries()].filter(([, u]) => this.tick < u).map(([k]) => k),
      kpis,
    };
  }
}

export type { Strategy };
