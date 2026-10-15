import type { Scenario } from "@floodsetu/engine";
import baseline from "../../../../scenarios/baseline-monsoon.json";
import blackout from "../../../../scenarios/blackout.json";
import contradiction from "../../../../scenarios/contradiction.json";
import fraud from "../../../../scenarios/fraud-mix.json";
import surge from "../../../../scenarios/sos-surge.json";
import triple from "../../../../scenarios/triple-failure.json";
import dam from "../../../../scenarios/dam-release.json";

export const SCENARIOS: Scenario[] = [baseline, surge, contradiction, triple, blackout, fraud, dam] as unknown as Scenario[];
export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
