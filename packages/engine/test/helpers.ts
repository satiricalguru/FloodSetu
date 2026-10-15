import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Scenario } from "../src";

export const ROOT = resolve(__dirname, "../../..");
export function loadScenario(id: string): Scenario {
  return JSON.parse(readFileSync(resolve(ROOT, "scenarios", `${id}.json`), "utf8")) as Scenario;
}
export const SCENARIOS = ["baseline-monsoon", "sos-surge", "contradiction", "triple-failure", "blackout", "fraud-mix", "dam-release"];
