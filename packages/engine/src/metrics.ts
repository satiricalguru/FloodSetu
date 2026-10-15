import { CONFIG } from "./config";
import type { Simulation } from "./sim";
import type { Kpis } from "./types";

/** Jain's fairness index (Σx)²/(n·Σx²) — 1 = perfectly equal. */
export function jain(xs: number[]): number {
  const v = xs.filter((x) => Number.isFinite(x));
  if (!v.length) return 1;
  const s = v.reduce((a, b) => a + b, 0);
  const s2 = v.reduce((a, b) => a + b * b, 0);
  if (s2 === 0) return 1;
  return (s * s) / (v.length * s2);
}

/** Gini via mean absolute difference: Σᵢ Σⱼ |xᵢ − xⱼ| / (2 n² · mean). */
export function gini(xs: number[]): number {
  const v = xs.filter((x) => Number.isFinite(x));
  const n = v.length;
  if (!n) return 0;
  const mean = v.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let s = 0;
  for (const a of v) for (const b of v) s += Math.abs(a - b);
  return s / (2 * n * n * mean);
}

export function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(q * v.length))];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (x: number) => Math.round(x * 10) / 10;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

function genuineIncidents(sim: Simulation) {
  return [...sim.incidents.values()].filter((i) => i.isReal && i.status !== "merged");
}

export function computeKpis(sim: Simulation): Kpis {
  const inc = genuineIncidents(sim);
  const open = [...sim.incidents.values()].filter((i) => i.status === "open" || i.status === "assigned" || i.status === "in_progress");
  const waits = inc.map((i) => (i.firstServedTick ?? sim.tick) - i.createdTick);
  const byN: Record<string, number[]> = {};
  for (const i of inc) (byN[i.nbhd] ??= []).push((i.firstServedTick ?? sim.tick) - i.createdTick);
  let alive = 0;
  let idle = 0;
  for (const a of sim.agents) {
    alive += a.stats.alive;
    idle += a.stats.idle;
  }
  return {
    openSos: open.length,
    criticalWaiting: open.filter((i) => i.urgency === "critical" && i.firstServedTick === undefined).length,
    p90Wait: quantile(waits, 0.9),
    idlePct: alive ? Math.round((idle / alive) * 1000) / 10 : 0,
    violations: sim.violations.length,
    fairness: r3(jain(Object.values(byN).map(mean))),
    rescued: inc.reduce((s, i) => s + i.rescued, 0),
    invariantViolations: sim.invariantViolations.length,
  };
}

export interface RunMetrics {
  scenario: string;
  strategy: string;
  seed: number;
  ticks: number;
  incidents: number;
  people: number;
  rescued: number;
  timeToService: { mean: number; median: number; p90: number; weighted: number; byUrgency: Record<string, { mean: number; p90: number; n: number }>; byNbhd: Record<string, { mean: number; p90: number; n: number }> };
  unmet: { atEnd: number; peopleAtEnd: number; pastDeadline: number };
  idle: { overallPct: number; boatPct: number; groundPct: number; whileDemandPct: number };
  routeViolations: number;
  fairness: { jain: number; gini: number; worstNbhdP90: number; worstNbhd: string; maxMinGap: number };
  contradictions: { count: number; meanResolution: number | null; meanStabilisation: number | null; wastedTrips: number; churn: number; unresolved: number };
  churn: { decommits: number; perTask: number; byReason: Record<string, number> };
  invariantViolations: number;
  falseReportTrips: number;
  cascades: { count: number; cancelled: number; reassigned: number; meanRecovery: number | null };
}

export function runMetrics(sim: Simulation): RunMetrics {
  const inc = genuineIncidents(sim);
  const waitOf = (i: (typeof inc)[number]) => (i.firstServedTick ?? sim.tick) - i.createdTick;
  const waits = inc.map(waitOf);
  const group = (key: (i: (typeof inc)[number]) => string) => {
    const g: Record<string, number[]> = {};
    for (const i of inc) (g[key(i)] ??= []).push(waitOf(i));
    return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { mean: r1(mean(v)), p90: quantile(v, 0.9), n: v.length }]));
  };
  const byNbhd = group((i) => i.nbhd);
  const nbMeans = Object.values(byNbhd).map((v) => v.mean);
  let worst = { id: "-", p90: 0 };
  for (const [k, v] of Object.entries(byNbhd)) if (v.p90 > worst.p90) worst = { id: k, p90: v.p90 };

  const sum = (f: (a: (typeof sim.agents)[number]) => number, type?: string) => sim.agents.filter((a) => !type || a.type === type).reduce((s, a) => s + f(a), 0);
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

  const unmet = inc.filter((i) => i.status !== "resolved");
  const pastDeadline = inc.filter((i) => waitOf(i) > CONFIG.DEADLINE[i.urgency]).length;

  const decommits = sim.log.filter((e) => e.type === "DECOMMIT");
  const byReason: Record<string, number> = {};
  for (const d of decommits) byReason[String(d.reason)] = (byReason[String(d.reason)] ?? 0) + 1;

  const con = sim.contradictions;
  const resolved = con.filter((c) => c.resolvedTick !== undefined);
  const cas = sim.cascades;
  const recovered = cas.filter((c) => c.resolvedTick !== undefined);

  return {
    scenario: sim.scenario.id,
    strategy: sim.strategyName,
    seed: sim.scenario.seed,
    ticks: sim.tick,
    incidents: inc.length,
    people: inc.reduce((s, i) => s + i.realPeople, 0),
    rescued: inc.reduce((s, i) => s + i.rescued, 0),
    timeToService: {
      mean: r1(mean(waits)),
      median: quantile(waits, 0.5),
      p90: quantile(waits, 0.9),
      // triage objective: each minute of a critical wait counts 10×, urgent 4×, needs-help 1× (CONFIG.URGENCY_WEIGHT)
      weighted: r1(inc.reduce((s, i) => s + CONFIG.URGENCY_WEIGHT[i.urgency] * waitOf(i), 0) / Math.max(1, inc.reduce((s, i) => s + CONFIG.URGENCY_WEIGHT[i.urgency], 0))),
      byUrgency: group((i) => i.urgency),
      byNbhd,
    },
    unmet: { atEnd: unmet.length, peopleAtEnd: unmet.reduce((s, i) => s + Math.max(0, i.realPeople - i.rescued), 0), pastDeadline },
    idle: {
      overallPct: pct(sum((a) => a.stats.idle), sum((a) => a.stats.alive)),
      boatPct: pct(sum((a) => a.stats.idle, "boat"), sum((a) => a.stats.alive, "boat")),
      groundPct: pct(sum((a) => a.stats.idle, "ground"), sum((a) => a.stats.alive, "ground")),
      whileDemandPct: pct(sum((a) => a.stats.idleWhileDemand), sum((a) => a.stats.alive)),
    },
    routeViolations: sim.violations.length,
    fairness: { jain: r3(jain(nbMeans)), gini: r3(gini(nbMeans)), worstNbhdP90: worst.p90, worstNbhd: worst.id, maxMinGap: nbMeans.length ? r1(Math.max(...nbMeans) - Math.min(...nbMeans)) : 0 },
    contradictions: {
      count: con.length,
      meanResolution: resolved.length ? r1(mean(resolved.map((c) => c.resolvedTick! - c.tick))) : null,
      meanStabilisation: con.length ? r1(mean(con.map((c) => c.lastImpactTick - c.tick))) : null,
      wastedTrips: con.reduce((s, c) => s + c.wastedTrips, 0),
      churn: con.reduce((s, c) => s + c.churn, 0),
      unresolved: con.length - resolved.length,
    },
    churn: { decommits: decommits.length, perTask: sim.tasks.size ? Math.round((decommits.length / sim.tasks.size) * 100) / 100 : 0, byReason },
    invariantViolations: sim.invariantViolations.length,
    falseReportTrips: sim.falseTrips,
    cascades: {
      count: cas.length,
      cancelled: cas.reduce((s, c) => s + c.cancelled.length, 0),
      reassigned: cas.reduce((s, c) => s + c.reassigned.length, 0),
      meanRecovery: recovered.length ? r1(mean(recovered.map((c) => c.resolvedTick! - c.tick))) : null,
    },
  };
}
