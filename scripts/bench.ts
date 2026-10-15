/**
 * pnpm bench [--seeds 5] [--scenarios a,b] — N seeds × M scenarios × 4 strategies.
 * Writes bench/results.json, bench/results.csv, bench/RESULTS.md and copies JSON for the dashboard Compare view.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runMetrics, Simulation, type RunMetrics, type Scenario, type StrategyName } from "@jalsetu/engine";

const ROOT = resolve(import.meta.dirname, "..");
const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const SEEDS = Number(arg("seeds", "5"));
const STRATS: StrategyName[] = ["cnp", "central", "omniscient", "greedy"];
const files = arg("scenarios", "")
  ? arg("scenarios", "").split(",").map((s) => `${s}.json`)
  : readdirSync(resolve(ROOT, "scenarios")).filter((f) => f.endsWith(".json"));

const LABEL: Record<StrategyName, string> = { cnp: "Decentralised CNP", central: "Central (same-info)", omniscient: "Central (omniscient, upper bound)", greedy: "Greedy floor" };

type Row = RunMetrics & { ms: number };
const rows: Row[] = [];
const t0 = performance.now();
for (const f of files) {
  const sc = JSON.parse(readFileSync(resolve(ROOT, "scenarios", f), "utf8")) as Scenario;
  for (let k = 0; k < SEEDS; k++) {
    const seed = sc.seed + k * 101;
    for (const s of STRATS) {
      const t = performance.now();
      const sim = new Simulation({ ...sc, seed }, { strategy: s, recordFrames: false }).run();
      rows.push({ ...runMetrics(sim), ms: Math.round(performance.now() - t) });
    }
  }
  process.stdout.write(`✓ ${sc.id}\n`);
}

// ── aggregate ─────────────────────────────────────────────
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const METRICS: { key: string; label: string; get: (r: Row) => number; better: "low" | "high"; unit: string }[] = [
  { key: "tts_mean", label: "Time to service (mean)", get: (r) => r.timeToService.mean, better: "low", unit: "min" },
  { key: "tts_p90", label: "Time to service (P90)", get: (r) => r.timeToService.p90, better: "low", unit: "min" },
  { key: "tts_weighted", label: "Urgency-weighted time to service", get: (r) => r.timeToService.weighted, better: "low", unit: "min" },
  { key: "tts_critical", label: "Critical time to service", get: (r) => r.timeToService.byUrgency.critical?.mean ?? 0, better: "low", unit: "min" },
  { key: "rescued_pct", label: "People rescued", get: (r) => (r.people ? (100 * r.rescued) / r.people : 0), better: "high", unit: "%" },
  { key: "unmet", label: "Unmet requests at end", get: (r) => r.unmet.atEnd, better: "low", unit: "" },
  { key: "past_deadline", label: "Requests past deadline", get: (r) => r.unmet.pastDeadline, better: "low", unit: "" },
  { key: "idle_demand", label: "Idle while demand open", get: (r) => r.idle.whileDemandPct, better: "low", unit: "%" },
  { key: "idle", label: "Resource idle time", get: (r) => r.idle.overallPct, better: "low", unit: "%" },
  { key: "violations", label: "Route violations", get: (r) => r.routeViolations, better: "low", unit: "" },
  { key: "jain", label: "Fairness (Jain, nbhd waits)", get: (r) => r.fairness.jain, better: "high", unit: "" },
  { key: "gini", label: "Fairness (Gini, nbhd waits)", get: (r) => r.fairness.gini, better: "low", unit: "" },
  { key: "worst_p90", label: "Worst-neighbourhood P90", get: (r) => r.fairness.worstNbhdP90, better: "low", unit: "min" },
  { key: "churn", label: "Decommits per task", get: (r) => r.churn.perTask, better: "low", unit: "" },
  { key: "contra_resolve", label: "Contradiction resolution", get: (r) => r.contradictions.meanResolution ?? NaN, better: "low", unit: "min" },
  { key: "contra_stab", label: "Plan stabilisation after contradiction", get: (r) => r.contradictions.meanStabilisation ?? NaN, better: "low", unit: "min" },
  { key: "recovery", label: "Cascade recovery (re-assign all)", get: (r) => r.cascades.meanRecovery ?? NaN, better: "low", unit: "min" },
  { key: "invariants", label: "Invariant violations", get: (r) => r.invariantViolations, better: "low", unit: "" },
];

const scenarios = [...new Set(rows.map((r) => r.scenario))];
const agg: Record<string, Record<string, Record<string, { mean: number; sd: number; n: number }>>> = {};
for (const sc of scenarios) {
  agg[sc] = {};
  for (const s of STRATS) {
    agg[sc][s] = {};
    const rs = rows.filter((r) => r.scenario === sc && r.strategy === s);
    for (const m of METRICS) {
      const xs = rs.map(m.get).filter((x) => Number.isFinite(x));
      agg[sc][s][m.key] = { mean: Math.round(mean(xs) * 100) / 100, sd: Math.round(sd(xs) * 100) / 100, n: xs.length };
    }
  }
}
const overall: Record<string, Record<string, number>> = {};
for (const s of STRATS) {
  overall[s] = {};
  for (const m of METRICS) {
    const xs = rows.filter((r) => r.strategy === s).map(m.get).filter((x) => Number.isFinite(x));
    overall[s][m.key] = Math.round(mean(xs) * 100) / 100;
  }
}

// ── honest verdict (fair comparison = CNP vs same-info central; omniscient is a reference) ──
const fair: StrategyName[] = ["cnp", "central", "greedy"];
const verdict: string[] = [];
const wins: Record<string, string[]> = { cnp: [], central: [], greedy: [] };
for (const m of METRICS.filter((x) => !["invariants", "idle", "gini"].includes(x.key))) {
  const vals = fair.map((s) => ({ s, v: overall[s][m.key] })).filter((x) => Number.isFinite(x.v));
  if (vals.length < 2) continue;
  vals.sort((a, b) => (m.better === "low" ? a.v - b.v : b.v - a.v));
  if (vals[0].v === vals[1].v) continue;
  wins[vals[0].s].push(m.label);
}
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0);
const o = overall;
verdict.push(`Across ${scenarios.length} scenarios × ${SEEDS} seeds (${rows.length} runs), all invariant checks: ${rows.every((r) => r.invariantViolations === 0) ? "0 violations in every run" : `${rows.reduce((s, r) => s + r.invariantViolations, 0)} violations`}.`);
verdict.push(`Decentralised CNP wins on: ${wins.cnp.join("; ") || "—"}.`);
verdict.push(`Centralised (same-info) wins on: ${wins.central.join("; ") || "—"}.`);
verdict.push(`Greedy floor wins on: ${wins.greedy.join("; ") || "—"}.`);
verdict.push(
  `Critical time-to-service: CNP ${o.cnp.tts_critical} min vs central ${o.central.tts_critical} min (${pct(o.cnp.tts_critical, o.central.tts_critical)}%) vs greedy ${o.greedy.tts_critical} min — central's per-tick global re-optimisation of every unstarted job serves the most urgent cases faster; greedy (urgency-blind) is worst.`,
);
verdict.push(`Price of partial information: omniscient reaches ${o.omniscient.tts_mean} min mean TTS and ${o.omniscient.violations} route violations vs CNP ${o.cnp.tts_mean} min / ${o.cnp.violations} — the gap is what perfect sensing + comms would buy.`);
verdict.push(`Churn: CNP ${o.cnp.churn} vs central ${o.central.churn} decommits/task — leveled commitment means agents only switch when the gain beats an ${8}-min penalty; greedy never re-plans (${o.greedy.churn}).`);
const bySc = scenarios.map((sc) => {
  const c = agg[sc].cnp.tts_mean.mean;
  const z = agg[sc].central.tts_mean.mean;
  return `${sc}: CNP ${c} vs central ${z} min mean TTS → ${c < z ? "CNP better" : c > z ? "central better" : "tie"}`;
});
verdict.push(...bySc);

const out = { generatedAt: new Date().toISOString(), seeds: SEEDS, strategies: STRATS.map((s) => ({ id: s, label: LABEL[s] })), metrics: METRICS.map(({ key, label, better, unit }) => ({ key, label, better, unit })), scenarios, agg, overall, verdict, runs: rows };
mkdirSync(resolve(ROOT, "bench"), { recursive: true });
writeFileSync(resolve(ROOT, "bench/results.json"), JSON.stringify(out, null, 1));
const csvKeys = METRICS.map((m) => m.key);
writeFileSync(resolve(ROOT, "bench/results.csv"), ["scenario,strategy,seed," + csvKeys.join(","), ...rows.map((r) => [r.scenario, r.strategy, r.seed, ...METRICS.map((m) => m.get(r))].join(","))].join("\n"));

let md = `# Benchmark results\n\n_Generated ${out.generatedAt} · ${rows.length} runs · ${SEEDS} seeds per scenario · \`pnpm bench\`_\n\n## Verdict (auto-generated, honest)\n\n${verdict.map((v) => `- ${v}`).join("\n")}\n\n## Overall means\n\n| Metric | ${STRATS.map((s) => LABEL[s]).join(" | ")} |\n|---|${STRATS.map(() => "---").join("|")}|\n`;
for (const m of METRICS) md += `| ${m.label}${m.unit ? ` (${m.unit})` : ""} ${m.better === "low" ? "↓" : "↑"} | ${STRATS.map((s) => overall[s][m.key]).join(" | ")} |\n`;
for (const sc of scenarios) {
  md += `\n### ${sc}\n\n| Metric | ${STRATS.map((s) => LABEL[s]).join(" | ")} |\n|---|${STRATS.map(() => "---").join("|")}|\n`;
  for (const m of METRICS) md += `| ${m.label} | ${STRATS.map((s) => `${agg[sc][s][m.key].mean} ± ${agg[sc][s][m.key].sd}`).join(" | ")} |\n`;
}
writeFileSync(resolve(ROOT, "bench/RESULTS.md"), md);
mkdirSync(resolve(ROOT, "apps/web/public/bench"), { recursive: true });
copyFileSync(resolve(ROOT, "bench/results.json"), resolve(ROOT, "apps/web/public/bench/results.json"));
console.log(`\n${rows.length} runs in ${((performance.now() - t0) / 1000).toFixed(1)} s → bench/RESULTS.md`);
console.log(verdict.map((v) => "  • " + v).join("\n"));
