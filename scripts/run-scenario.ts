import { readFileSync } from "node:fs";
import { Simulation, runMetrics, type Scenario, type StrategyName } from "@floodsetu/engine";

const file = process.argv[2] ?? "scenarios/baseline-monsoon.json";
const strategy = (process.argv[3] ?? "cnp") as StrategyName;
const scenario = JSON.parse(readFileSync(file, "utf8")) as Scenario;
const t0 = performance.now();
const sim = new Simulation(scenario, { strategy, recordFrames: false }).run();
const ms = performance.now() - t0;
const m = runMetrics(sim);
console.log(JSON.stringify(m, null, 2));
console.log(`ran ${sim.tick} ticks in ${ms.toFixed(0)} ms, ${sim.log.length} events`);
if (process.argv.includes("--log")) for (const e of sim.log.slice(0, 400)) console.log(e.tick, e.type, e.msg);
if (process.argv.includes("--inv")) for (const v of sim.invariantViolations.slice(0, 30)) console.log("INV", v);
