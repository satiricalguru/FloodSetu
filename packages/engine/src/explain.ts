import { clock } from "./scenario";
import type { Simulation } from "./sim";
import type { CascadeEntry, SimEvent } from "./types";

/**
 * Deterministic, templated explanations built only from structured log data.
 * (An optional LLM may rephrase these strings but must never add facts.)
 */

const REASON_TEXT: Record<string, string> = {
  ROUTE_BLOCKED: "its route was blocked",
  RESOURCE_FAILURE: "the unit failed",
  SHELTER_FULL: "the destination shelter was full",
  HIGHER_URGENCY_PREEMPTION: "it was diverted to a strictly more urgent request",
  INFO_CONTRADICTED: "new information contradicted the report",
  CONTROL_OVERRIDE: "the control room overrode it",
  CENTRAL_REPLAN: "the central planner re-optimised",
  TASK_RESOLVED: "the task was already resolved",
};

export function reasonText(code: string): string {
  return REASON_TEXT[code] ?? code;
}

export function cascadeExplanation(sim: Simulation, cas: CascadeEntry): string[] {
  const lines: string[] = [];
  const t = clock(cas.tick);
  for (const c of cas.causes) lines.push(`${t} — ${c.msg}.`);
  const byAgent = new Map<string, typeof cas.cancelled>();
  for (const c of cas.cancelled) byAgent.set(c.agent, [...(byAgent.get(c.agent) ?? []), c]);
  for (const [agent, list] of byAgent) {
    const reasons = [...new Set(list.map((l) => l.reason))];
    lines.push(`${agent}: ${list.length} commitment${list.length > 1 ? "s" : ""} released (${reasons.join(", ")}) because ${reasons.map(reasonText).join(" and ")}.`);
  }
  for (const r of cas.reassigned) {
    const task = sim.tasks.get(r.task);
    const inc = task?.incidentId ? sim.incidents.get(task.incidentId) : undefined;
    const what = inc ? `Incident ${inc.id} (${inc.people} people, ${inc.urgency})` : `Task ${r.task}`;
    const others = r.bids.filter((b) => b.agent !== r.agent);
    const win = r.bids.find((b) => b.agent === r.agent);
    const vs = others.length ? ` (bid ${win?.bid.toFixed(1) ?? r.eta.toFixed(1)} vs ${others.map((o) => `${o.agent} ${o.bid.toFixed(1)}`).join(", ")})` : "";
    lines.push(`${what} was re-auctioned${r.tick > cas.tick ? ` at ${clock(r.tick)}` : " in the same tick"}; ${r.agent} won with ETA ${Math.round(r.eta)} min${vs}.`);
  }
  for (const r of cas.reroutes) {
    if (r.reason === "SHELTER_FULL") {
      const s = r.to ? sim.shelters.get(r.to) : undefined;
      const left = s ? s.capacity - s.occupancy - s.reservations.reduce((x, q) => x + q.count, 0) : 0;
      lines.push(`${r.agent}: shelter ${r.from} overflowed; drop-off rerouted to ${r.to ?? "HOLDING"}${s ? ` (capacity ${left} left)` : ""}.`);
    } else lines.push(`${r.agent} re-routed: ${r.reason}${r.from ? ` (${r.from} → ${r.to})` : ""}.`);
  }
  const pending = [...((cas as CascadeEntry & { pendingTasks?: Set<string> }).pendingTasks ?? [])];
  if (pending.length) lines.push(`Still awaiting reassignment: ${pending.map((p) => sim.tasks.get(p)?.incidentId ?? p).join(", ")} (no capable agent with a safe route yet).`);
  if (cas.resolvedTick !== undefined) lines.push(`All released work re-assigned ${cas.resolvedTick === cas.tick ? "within the same tick" : `after ${cas.resolvedTick - cas.tick} min`}.`);
  return lines;
}

export interface WhyExplanation {
  title: string;
  summary: string;
  bids: { agent: string; bid: number | null; eta: number | null; breakdown: Record<string, number>; excluded?: string; winner: boolean }[];
  priority?: Record<string, number>;
  constraints: string[];
  rejected: { agent: string; why: string }[];
  history: SimEvent[];
}

/** "Why?" drawer for a task: the latest award with full bid table, utility breakdown and constraints. */
export function explainTask(sim: Simulation, taskId: string): WhyExplanation | null {
  const task = sim.tasks.get(taskId);
  if (!task) return null;
  const history = sim.log.filter((e) => e.task === taskId || (task.incidentId && e.incident === task.incidentId));
  const award = [...history].reverse().find((e) => e.type === "AWARD" && e.task === taskId);
  const inc = task.incidentId ? sim.incidents.get(task.incidentId) : undefined;
  const title = `${task.kind} · ${inc ? `${inc.id} · ${inc.people} people · ${inc.urgency}` : (task.edgeId ?? task.id)}`;
  if (!award) {
    return { title, summary: `Not yet assigned — ${sim.unassigned(task)} unassigned. Waiting for a capable agent with a safe route.`, bids: [], constraints: [], rejected: [], history };
  }
  const d = award.data as { bids: WhyExplanation["bids"]; priority: Record<string, number>; constraints: string[]; bid: { bid: number }; count: number; strategy: string };
  const bids = d.bids.map((b) => ({ ...b, winner: b.agent === award.agent })).sort((a, b) => (a.bid ?? 1e9) - (b.bid ?? 1e9));
  const valid = bids.filter((b) => b.bid !== null);
  const runner = valid.find((b) => !b.winner);
  const pr = d.priority;
  const prText = pr ? `priority ${pr.total} = urgency ${pr.U} × vulnerability ${pr.V?.toFixed?.(2) ?? pr.V} × people ${pr.N?.toFixed?.(2) ?? pr.N} × aging ${pr.A?.toFixed?.(2) ?? pr.A} × verification ${pr.C} × escalation ${pr.E} × fairness ${pr.F?.toFixed?.(2) ?? pr.F}` : "";
  const how = award.reason === "CNP" ? "won the Contract-Net auction" : award.reason === "CNP_PREEMPT" ? "was diverted by strictly-higher-urgency preemption" : award.reason === "CONTROL_OVERRIDE" ? "was pinned by the control room" : award.reason === "GREEDY_NEAREST" ? "was the nearest free agent (greedy)" : "was chosen by the central Hungarian solver";
  const summary = `${award.agent} ${how} at ${clock(award.tick)} with time-to-service ${d.bid.bid.toFixed(1)} min${runner ? `, ${(runner.bid! - d.bid.bid).toFixed(1)} min better than ${runner.agent}` : ""}. Carries ${d.count}. ${prText}.`;
  return {
    title,
    summary,
    bids,
    priority: pr,
    constraints: d.constraints ?? [],
    rejected: bids.filter((b) => b.excluded).map((b) => ({ agent: b.agent, why: b.excluded! })),
    history,
  };
}
