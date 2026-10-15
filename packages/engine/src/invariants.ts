import { CONFIG } from "./config";
import { edgeBetween } from "./graph";
import type { Simulation } from "./sim";

/**
 * Explicit safety invariants (Section 6.5). Checked at the end of EVERY tick for EVERY strategy.
 * Violations are counted as metrics and surfaced in the UI — never swallowed.
 *  1 capacity · 2 believed-safe routes · 3 capability · 4 reservations · 5 failure release
 *  6 starvation escalation · 7 critical never gated by verification · 8 (architecture test) · 9 reasons (in emit)
 */
export const INVARIANTS: Record<number, string> = {
  1: "A boat never exceeds its capacity",
  2: "No agent is routed through an edge it believes closed or impassable for its type",
  3: "No task is assigned to an agent lacking the required mode or skill",
  4: "No transfer to a full shelter; drop-off requires a confirmed reservation",
  5: "A failed agent's commitments are released and re-announced in the same tick",
  6: "No request waits beyond MAX_WAIT without escalation to the control room",
  7: "Life-threatening SOS are dispatched even while verification is pending",
  8: "Donation data never influences dispatch (architecture test)",
  9: "Every assignment, decommit and override has a logged reason",
};

export function checkInvariants(sim: Simulation): { id: number; msg: string }[] {
  const out: { id: number; msg: string }[] = [];
  const w = sim.world;
  for (const a of sim.agents) {
    // 1
    if (a.onboard > a.capacity) out.push({ id: 1, msg: `${a.id} carries ${a.onboard}/${a.capacity}` });
    // 2 — remaining planned path is passable on the agent's own beliefs
    if (a.status !== "failed" && a.path.length) {
      const cost = sim.costFn(sim.viewFor(a), a.type, a.type === "ground" && a.onboard > 0);
      const nodes = [a.next ?? a.node, ...a.path];
      for (let i = 1; i < nodes.length; i++) {
        const e = edgeBetween(w, nodes[i - 1], nodes[i]);
        if (!e || !Number.isFinite(cost(e, nodes[i - 1], nodes[i]))) {
          out.push({ id: 2, msg: `${a.id} path uses ${e ?? "missing edge"} it believes impassable` });
          break;
        }
      }
    }
    // 3
    for (const c of a.queue) {
      const t = sim.tasks.get(c.taskId);
      if (!t) continue;
      if (t.mode !== a.type) out.push({ id: 3, msg: `${t.mode} task ${t.id} held by ${a.type} ${a.id}` });
      for (const s of t.skills) if (!a.skills.includes(s)) out.push({ id: 3, msg: `${a.id} lacks ${s} for ${t.id}` });
    }
    // 5
    if (a.status === "failed" && a.queue.length) out.push({ id: 5, msg: `failed ${a.id} still holds ${a.queue.length} commitments` });
  }
  // 4
  for (const d of sim.dropChecks) if (!d.ok) out.push({ id: 4, msg: d.msg });
  for (const s of sim.shelters.values()) {
    const reserved = s.reservations.reduce((x, r) => x + r.count, 0);
    if (reserved > 0 && s.occupancy + reserved > s.capacity) out.push({ id: 4, msg: `${s.id} over-reserved ${s.occupancy}+${reserved}/${s.capacity}` });
  }
  // 5 — everything released this tick was re-announced/considered this tick
  for (const id of sim.released) if (!sim.considered.has(id) && sim.unassigned(sim.tasks.get(id)!) > 0) out.push({ id: 5, msg: `released task ${id} not re-announced in tick` });
  // 6 & 7
  for (const t of sim.tasks.values()) {
    if (t.status === "done" || t.status === "cancelled") continue;
    const inc = t.incidentId ? sim.incidents.get(t.incidentId) : undefined;
    if (inc && inc.firstServedTick === undefined && sim.tick - inc.createdTick > CONFIG.MAX_WAIT[inc.urgency] && !inc.escalated) {
      out.push({ id: 6, msg: `${inc.id} waited ${sim.tick - inc.createdTick} min without escalation` });
    }
    if (sim.criticalAtAlloc.has(t.id) && !sim.considered.has(t.id)) out.push({ id: 7, msg: `critical ${t.id} not considered for dispatch this tick` });
  }
  return out;
}
