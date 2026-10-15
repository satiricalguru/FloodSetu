import { CONFIG } from "./config";
import { hungarian } from "./hungarian";
import type { Simulation } from "./sim";
import type { Agent, BidRecord, Commitment, StrategyName, Task, Urgency } from "./types";

export interface Strategy {
  name: StrategyName;
  label: string;
  allocate(sim: Simulation): void;
}

const RANK: Record<Urgency, number> = { critical: 3, urgent: 2, needs_help: 1 };

// ───────────────────────────── Decentralised: Contract Net ─────────────────────────────

/**
 * IncidentAgents (managers) announce tasks in priority order; capable agents bid time-to-service computed on
 * THEIR OWN beliefs; lowest bid wins; bundles ≤ 2; strictly-higher-urgency preemption with immediate
 * re-announcement of the victim task.
 */
/** Award utility: urgency-weighted priority discounted by time-to-service (bid). */
export const UTILITY_SCALE = { tau: 20 };
export const utility = (priority: number, bid: number) => priority / (1 + bid / UTILITY_SCALE.tau);

export const cnp: Strategy = {
  name: "cnp",
  label: "Decentralised CNP",
  allocate(sim) {
    const announced = new Set<string>();
    // Leveled commitment: queued (not yet started) bundle items are re-offered each tick. The holder bids with a
    // DECOMMIT_PENALTY advantage; it only loses the item if another agent is better by more than the penalty.
    const soft: Commitment[] = [];
    const heldTasks = new Set<string>();
    for (const a of sim.agents) {
      if (a.status === "failed") continue;
      for (const c of [...a.queue]) {
        if ((c.phase === "queued" || c.phase === "to_site") && c.pickedUp === undefined) {
          soft.push(c);
          heldTasks.add(c.taskId);
          sim.softRelease(c);
        }
      }
    }
    const restored = new Set<string>();
    try {
      runPasses();
    } finally {
      for (const c of soft) {
        if (restored.has(c.id)) continue;
        const t = sim.tasks.get(c.taskId);
        const holder = sim.agentById.get(c.agentId)!;
        const diverted = holder.queue.find((q) => q.awardedTick === sim.tick && RANK[sim.tasks.get(q.taskId)?.urgency ?? "needs_help"] > RANK[t?.urgency ?? "needs_help"]);
        const takenBy = t ? sim.agents.find((x) => x.id !== holder.id && x.queue.some((q) => q.taskId === t.id && q.awardedTick === sim.tick)) : undefined;
        if (!diverted && !takenBy && t && sim.unassigned(t) > 0) sim.restore(c, Math.min(c.count, sim.unassigned(t)));
        else if (diverted) sim.logDecommit(c, "HIGHER_URGENCY_PREEMPTION", `${holder.id} diverted to ${sim.tasks.get(diverted.taskId)?.incidentId ?? diverted.taskId} (${sim.tasks.get(diverted.taskId)?.urgency}); ${t?.incidentId ?? c.taskId} re-auctioned in the same tick${takenBy ? ` → ${takenBy.id}` : ""}`);
        else sim.logDecommit(c, "BETTER_OFFER", `${takenBy?.id ?? "another agent"} beat ${c.agentId} by more than the ${CONFIG.DECOMMIT_PENALTY}-min decommitment penalty`);
      }
    }
    function runPasses() {
    for (let pass = 0; pass < 3; pass++) {
      const tasks = sim.openTasks();
      if (!tasks.length) return;
      // 1. ANNOUNCE — each IncidentAgent broadcasts its task; capable agents reply with bids from their own beliefs
      const bids = new Map<string, BidRecord[]>();
      for (const t of tasks) {
        sim.markConsidered(t.id);
        if (!announced.has(t.id) && !heldTasks.has(t.id)) {
          announced.add(t.id);
          const recipients = sim.agents.filter((a) => a.status !== "failed" && a.type === t.mode && sim.canReceive(a, `ann:${t.id}`)).length;
          sim.emit("ANNOUNCE", `${t.incidentId ?? t.edgeId ?? t.id} announced ${t.kind} (${t.urgency}, ${sim.unassigned(t)} ${t.kind === "RESCUE" ? "people" : "unit"}, pri ${t.priority}) to ${recipients} ${t.mode} agents`, { task: t.id, incident: t.incidentId });
        }
        bids.set(t.id, sim.agents.map((a) => holderBid(a, t)));
      }
      // 2. AWARD — repeatedly settle the highest-utility (task, bid) pair (CBBA-style greedy consensus).
      //    Ties within 5% go to the neighbourhood with the worse P90 wait (fairness).
      const p90 = sim.nbhdP90();
      for (let guard = 0; guard < 200; guard++) {
        let best: { t: Task; b: BidRecord; u: number } | null = null;
        for (const t of tasks) {
          if (sim.unassigned(t) <= 0) continue;
          for (const b of bids.get(t.id)!) {
            if (!Number.isFinite(b.bid)) continue;
            const u = utility(t.priority, b.bid);
            if (!best) best = { t, b, u };
            else if (Math.abs(u - best.u) <= CONFIG.FAIRNESS_TIE * Math.max(u, best.u) && t.nbhd !== best.t.nbhd) {
              if ((p90[t.nbhd] ?? 0) > (p90[best.t.nbhd] ?? 0)) best = { t, b, u };
            } else if (u > best.u || (u === best.u && b.agent < best.b.agent)) best = { t, b, u };
          }
        }
        if (!best) break;
        const { t, b } = best;
        const agent = sim.agentById.get(b.agent)!;
        const list = bids.get(t.id)!;
        const mine = soft.find((c) => c.taskId === t.id && c.agentId === agent.id && !restored.has(c.id));
        if (mine) {
          restored.add(mine.id);
          sim.restore(mine, Math.min(mine.count, sim.unassigned(t)));
        } else {
          for (const x of [...list].filter((x) => Number.isFinite(x.bid)).sort((p, q) => p.bid - q.bid).slice(0, 3)) sim.emit("BID", `${x.agent} bid ${x.bid.toFixed(1)} on ${t.incidentId ?? t.edgeId ?? t.id}`, { agent: x.agent, task: t.id });
          sim.award(t, agent, countFor(sim, t, agent), b, list, "CNP");
        }
        // the winner's availability changed → it re-bids everything (its bundle grew)
        for (const tt of tasks) {
          const l = bids.get(tt.id)!;
          const i = l.findIndex((x) => x.agent === agent.id);
          l[i] = holderBid(agent, tt);
        }
      }
      // 3. PREEMPTION — strictly higher urgency only; the victim is re-announced in the same tick (next pass)
      let preempted = false;
      for (const t of tasks) {
        if (sim.unassigned(t) <= 0) continue;
        if (!(t.urgency === "critical" || sim.incidents.get(t.incidentId ?? "")?.escalated)) continue;
        const valid = bids.get(t.id)!.filter((b) => Number.isFinite(b.bid)).sort((x, y) => x.bid - y.bid);
        const pre = preemption(sim, t, valid[0]);
        if (!pre) continue;
        const victimTask = sim.tasks.get(pre.victim.taskId)!;
        sim.decommit(pre.victim, "HIGHER_URGENCY_PREEMPTION", `${pre.agent.id} diverted to ${t.incidentId ?? t.id} (${t.urgency}); ${victimTask.incidentId ?? victimTask.id} re-announced now`);
        sim.award(t, pre.agent, countFor(sim, t, pre.agent), pre.bid, [pre.bid, ...bids.get(t.id)!], "CNP_PREEMPT", true);
        preempted = true;
      }
      if (!preempted) return;
    }
    }
    function holderBid(a: Agent, t: Task): BidRecord {
      const held = soft.find((c) => c.taskId === t.id && c.agentId === a.id && !restored.has(c.id));
      if (!held) return sim.bid(a, t);
      const b = sim.bid(a, t, { requireComms: false });
      if (!Number.isFinite(b.bid)) return b;
      return { ...b, bid: Math.max(0, b.bid - CONFIG.DECOMMIT_PENALTY), breakdown: { ...b.breakdown, holder: -CONFIG.DECOMMIT_PENALTY } };
    }
  },
};

function countFor(sim: Simulation, t: Task, a: Agent): number {
  return t.kind === "RESCUE" ? Math.max(1, Math.min(a.capacity, sim.unassigned(t))) : 1;
}

function preemption(sim: Simulation, task: Task, best: BidRecord | undefined): { agent: Agent; victim: Commitment; bid: BidRecord } | null {
  let pick: { agent: Agent; victim: Commitment; bid: BidRecord } | null = null;
  for (const a of sim.agents) {
    const c = a.queue[0];
    if (!c || c.phase !== "to_site" || a.onboard > 0) continue;
    const vt = sim.tasks.get(c.taskId);
    if (!vt || RANK[vt.urgency] >= RANK[task.urgency]) continue; // strictly higher urgency only
    if (sim.capable(a, task)) continue;
    if (!sim.canReceive(a, `pre:${task.id}`)) continue;
    const b = sim.bid(a, task, { ignoreQueue: true });
    if (!Number.isFinite(b.bid)) continue;
    const threshold = best ? best.bid - CONFIG.PREEMPT_GAIN : Infinity;
    if (b.bid < threshold && (!pick || b.bid < pick.bid.bid)) pick = { agent: a, victim: c, bid: b };
  }
  return pick;
}

// ───────────────────────────── Centralised: Hungarian ─────────────────────────────

interface Slot {
  agent: Agent;
  incumbent?: Commitment;
  avail: number;
  node: number;
}

function centralAllocate(sim: Simulation, label: "central" | "omniscient") {
  const view = sim.centralView();
  const tasks = sim.openTasksIncludingReassignable(CONFIG.CENTRAL_TOP_K);
  for (const t of tasks) sim.markConsidered(t.id);
  const slots: Slot[] = [];
  for (const a of sim.agents) {
    if (a.status === "failed" || a.status === "refuelling" || a.status === "returning") continue;
    const seen = sim.copAgents.get(a.id);
    if (!sim.omniscient && (!seen || sim.tick - seen.t > CONFIG.HEARTBEAT_TIMEOUT)) continue; // central can't see it
    const last = a.queue[a.queue.length - 1];
    const reassignable = last && (last.phase === "queued" || last.phase === "to_site") && last.pickedUp === undefined;
    if (!reassignable && a.queue.length >= CONFIG.MAX_QUEUE) continue;
    // availability from non-reassignable work, measured on the CENTRAL picture (COP or truth)
    const fixed = reassignable ? a.queue.slice(0, -1) : a.queue;
    // central only knows the last-known position (same-info) or the true one (omniscient)
    const known: Agent = sim.omniscient ? { ...a, queue: fixed } : { ...a, queue: fixed, node: seen?.node ?? a.node, next: null, progress: 0 };
    const av = sim.availability(known, view);
    slots.push({ agent: a, incumbent: reassignable ? last : undefined, avail: av.minutes, node: av.node });
  }
  // task slots: big incidents can take up to 3 agents in one solve
  const cols: { task: Task; k: number; need: number }[] = [];
  for (const t of tasks) {
    const incumbentCount = slots.filter((s) => s.incumbent?.taskId === t.id).reduce((x, s) => x + s.incumbent!.count, 0);
    const need = sim.unassigned(t) + incumbentCount;
    if (need <= 0) continue;
    const k = t.kind === "RESCUE" ? Math.min(3, Math.ceil(need / 6)) : 1;
    for (let i = 0; i < k; i++) cols.push({ task: t, k: i, need });
  }
  const A = slots.length;
  const T = cols.length;
  if (!A || !T) return;
  const n = A + T;
  const BIG = 1e9;
  const C: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const etas: number[][] = Array.from({ length: A }, () => new Array<number>(T).fill(Infinity));
  for (let i = 0; i < A; i++) {
    const s = slots[i];
    for (let j = 0; j < T; j++) {
      const { task, k } = cols[j];
      const cap = sim.capable(s.agent, task);
      if (cap) {
        C[i][j] = BIG;
        continue;
      }
      if (s.agent.type === "boat") {
        // fuel feasibility (same rule as CNP bids)
        const travel0 = sim.travel(view, s.agent.type, s.node, task.node);
        if (s.agent.fuel < s.avail + travel0 + 45 + CONFIG.FUEL_RESERVE) {
          C[i][j] = BIG;
          continue;
        }
      }
      const travel = sim.travel(view, s.agent.type, s.node, task.node);
      if (!Number.isFinite(travel)) {
        C[i][j] = BIG;
        continue;
      }
      const eta = s.avail + travel;
      etas[i][j] = eta;
      const incumbent = s.incumbent?.taskId === task.id ? CONFIG.CENTRAL_INCUMBENCY : 1;
      C[i][j] = task.priority * eta * (1 + 0.15 * k) * incumbent;
    }
    for (let j = T; j < n; j++) C[i][j] = 0; // agent left idle
  }
  // dummy rows = "task slot left unserved this tick"
  for (let i = A; i < n; i++) {
    for (let j = 0; j < T; j++) C[i][j] = cols[j].task.priority * CONFIG.CENTRAL_UNSERVED_COST * (1 + 0.15 * cols[j].k);
    for (let j = T; j < n; j++) C[i][j] = 0;
  }
  const assign = hungarian(C);

  // apply: keep incumbents that were re-chosen, replace others (CENTRAL_REPLAN), add new
  const plan = new Map<string, { col: number }>();
  for (let i = 0; i < A; i++) {
    const j = assign[i];
    if (j < T && C[i][j] < BIG) plan.set(slots[i].agent.id, { col: j });
  }
  const remaining = new Map<string, number>();
  for (const { task, need } of cols) remaining.set(task.id, need);
  // first pass: incumbents kept
  for (const s of slots) {
    const p = plan.get(s.agent.id);
    if (s.incumbent && p && cols[p.col].task.id === s.incumbent.taskId) {
      remaining.set(s.incumbent.taskId, (remaining.get(s.incumbent.taskId) ?? 0) - s.incumbent.count);
      plan.delete(s.agent.id);
    } else if (s.incumbent) {
      const to = p ? cols[p.col].task : null;
      sim.decommit(s.incumbent, "CENTRAL_REPLAN", to ? `re-optimised to ${to.incidentId ?? to.id}` : "re-optimised (unassigned)");
    }
  }
  for (let i = 0; i < A; i++) {
    const s = slots[i];
    const p = plan.get(s.agent.id);
    if (!p) continue;
    const { task } = cols[p.col];
    const left = Math.min(remaining.get(task.id) ?? 0, sim.unassigned(task));
    if (left <= 0) continue;
    if (!sim.omniscient && !sim.canReceive(s.agent, `cmd:${task.id}`)) {
      sim.emit("CMD_LOST", `Central command to ${s.agent.id} for ${task.incidentId ?? task.id} lost (no ack)`, { agent: s.agent.id, task: task.id });
      continue;
    }
    const count = task.kind === "RESCUE" ? Math.min(s.agent.capacity, left) : 1;
    remaining.set(task.id, left - count);
    const eta = etas[i][p.col];
    const bids: BidRecord[] = slots
      .map((sl, ii) => ({ agent: sl.agent.id, bid: Number.isFinite(etas[ii][p.col]) ? Math.round(etas[ii][p.col] * 10) / 10 : Infinity, eta: etas[ii][p.col], breakdown: { availability: Math.round(sl.avail * 10) / 10 }, excluded: sim.capable(sl.agent, task) ?? undefined }))
      .sort((a, b) => a.bid - b.bid);
    sim.award(task, s.agent, count, { agent: s.agent.id, bid: Math.round(eta * 10) / 10, eta: Math.round(eta * 10) / 10, breakdown: { availability: Math.round(s.avail * 10) / 10, travel: Math.round((eta - s.avail) * 10) / 10 } }, bids, label === "omniscient" ? "CENTRAL_OMNISCIENT" : "CENTRAL_HUNGARIAN");
  }
}

export const central: Strategy = { name: "central", label: "Centralised (same-info)", allocate: (sim) => centralAllocate(sim, "central") };
export const omniscient: Strategy = { name: "omniscient", label: "Centralised (omniscient)", allocate: (sim) => centralAllocate(sim, "omniscient") };

// ───────────────────────────── Greedy floor ─────────────────────────────

export const greedy: Strategy = {
  name: "greedy",
  label: "Greedy nearest-available",
  allocate(sim) {
    const open = [...sim.tasks.values()].filter((t) => sim.unassigned(t) > 0);
    for (const t of open) sim.markConsidered(t.id);
    for (const a of sim.agents) {
      if (a.queue.length || a.status !== "idle") continue;
      let best: { t: Task; b: BidRecord } | null = null;
      for (const t of open) {
        if (sim.unassigned(t) <= 0) continue;
        const b = sim.bid(a, t);
        if (Number.isFinite(b.bid) && (!best || b.eta < best.b.eta)) best = { t, b };
      }
      if (best) sim.award(best.t, a, best.t.kind === "RESCUE" ? Math.min(a.capacity, sim.unassigned(best.t)) : 1, best.b, [best.b], "GREEDY_NEAREST");
    }
  },
};

export const STRATEGIES: Record<StrategyName, Strategy> = { cnp, central, omniscient, greedy };

export function makeStrategy(name: StrategyName): Strategy {
  return STRATEGIES[name];
}
