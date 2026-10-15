import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Simulation, type ScenarioEvent, type StrategyName } from "../src";
import { loadScenario } from "./helpers";

/**
 * Property: for ANY random mix of injected disruptions (closures, collapses, failures, overflows, blackouts,
 * contradictory reports, SOS bursts), every strategy keeps every safety invariant.
 */
const edges = ["B1", "B2", "B3", "e13", "e40", "e61", "e128", "e155", "e215", "e300"];
const boats = ["B-1", "B-2", "B-3", "B-4", "B-5", "B-6", "B-7", "B-8"];
const ground = ["G-01", "G-03", "G-05", "G-07", "G-09"];
const shelters = ["S1", "S2", "S3", "S4", "S5", "S6"];
const nbhds = ["GHT", "PRB", "MCH", "RLC", "SHN", "UCH"];

const event: fc.Arbitrary<ScenarioEvent> = fc.oneof(
  fc.record({ tick: fc.integer({ min: 5, max: 140 }), type: fc.constant("BRIDGE_COLLAPSE" as const), edge: fc.constantFrom("B1", "B2", "B3") }),
  fc.record({ tick: fc.integer({ min: 5, max: 140 }), type: fc.constant("EDGE_CLOSE" as const), edge: fc.constantFrom(...edges), announce: fc.constantFrom(null, "control_room" as const) }),
  fc.record({ tick: fc.integer({ min: 5, max: 140 }), type: fc.constant("AGENT_FAILURE" as const), agent: fc.constantFrom(...boats, ...ground) }),
  fc.record({ tick: fc.integer({ min: 5, max: 140 }), type: fc.constant("SHELTER_OVERFLOW" as const), shelter: fc.constantFrom(...shelters), walkIns: fc.integer({ min: 10, max: 200 }) }),
  fc.record({ tick: fc.integer({ min: 5, max: 140 }), type: fc.constant("BLACKOUT" as const), nbhd: fc.constantFrom(...nbhds), duration: fc.integer({ min: 5, max: 60 }) }),
  fc.record({ tick: fc.integer({ min: 5, max: 140 }), type: fc.constant("REPORT" as const), edge: fc.constantFrom(...edges), claim: fc.constantFrom("open" as const, "closed" as const), source: fc.constantFrom("citizen" as const, "rescuer" as const), confidence: fc.double({ min: 0.3, max: 1, noNaN: true }) }),
  fc.record({ tick: fc.integer({ min: 5, max: 140 }), type: fc.constant("SOS_BURST" as const), nbhd: fc.constantFrom("GHT", "MCH", "PRB"), count: fc.integer({ min: 5, max: 25 }), duplicates: fc.integer({ min: 0, max: 5 }), sameBuilding: fc.integer({ min: 0, max: 1 }) }),
  fc.record({ tick: fc.integer({ min: 5, max: 140 }), type: fc.constant("TRIPLE_FAILURE" as const), bridge: fc.constant("auto"), agent: fc.constant("auto"), shelter: fc.constant("auto"), walkIns: fc.integer({ min: 20, max: 80 }) }),
);

describe("safety invariants hold under random disruption (fast-check)", () => {
  for (const strategy of ["cnp", "central", "greedy", "omniscient"] as StrategyName[]) {
    it(`${strategy}`, () => {
      fc.assert(
        fc.property(fc.array(event, { minLength: 1, maxLength: 8 }), fc.integer({ min: 1, max: 1000 }), (events, seed) => {
          const base = loadScenario("baseline-monsoon");
          const sim = new Simulation({ ...base, seed, duration: 160, events: [...base.events, ...events] }, { strategy, recordFrames: false }).run();
          expect(sim.invariantViolations).toEqual([]);
          for (const a of sim.agents) expect(a.onboard).toBeLessThanOrEqual(a.capacity);
        }),
        { numRuns: 12 },
      );
    });
  }
});
