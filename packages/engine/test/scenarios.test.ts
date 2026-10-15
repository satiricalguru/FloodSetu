import { describe, expect, it } from "vitest";
import { Simulation, explainTask } from "../src";
import { loadScenario } from "./helpers";

describe("triple failure (stretch demo)", () => {
  const sim = new Simulation(loadScenario("triple-failure"), { strategy: "cnp", recordFrames: false }).run(200);
  const cas = sim.cascades.find((c) => c.causes.length >= 3)!;
  it("records one cascade with all three causes in the same tick", () => {
    expect(cas).toBeDefined();
    expect(cas.causes.map((c) => c.type).sort()).toEqual(["AGENT_FAILURE", "BRIDGE_COLLAPSE", "SHELTER_OVERFLOW"]);
  });
  it("releases the failed boat's commitments with RESOURCE_FAILURE and re-auctions them", () => {
    expect(cas.cancelled.length).toBeGreaterThan(0);
    expect(cas.cancelled.every((c) => typeof c.reason === "string")).toBe(true);
    expect(cas.cancelled.some((c) => c.reason === "RESOURCE_FAILURE")).toBe(true);
    expect(cas.reassigned.length).toBeGreaterThan(0);
  });
  it("produces a plain-language explanation", () => {
    expect(cas.explanation.join(" ")).toMatch(/failed|collapsed|overflow/);
    expect(cas.explanation.join(" ")).toMatch(/won with ETA/);
  });
  it("the failed boat holds no commitments (invariant 5)", () => {
    const failed = sim.agents.find((a) => a.status === "failed")!;
    expect(failed.queue).toHaveLength(0);
  });
});

describe("contradictory reports", () => {
  const sim = new Simulation(loadScenario("contradiction"), { strategy: "cnp", recordFrames: false }).run();
  it("flags B2 as contested and resolves it by verification", () => {
    const rec = sim.contradictions.find((c) => c.edge === "B2")!;
    expect(rec).toBeDefined();
    expect(rec.resolvedTick).toBeDefined();
    expect(rec.resolvedAs).toBe("closed");
  });
  it("flags the stale shelter report as a conflict", () => {
    expect(sim.log.some((e) => e.type === "SHELTER_REPORT" && /CONFLICTS/.test(e.msg))).toBe(true);
  });
});

describe("blackout", () => {
  it("delays SOS from the blackout zone and flushes rescuer outboxes on reconnect", () => {
    const sim = new Simulation(loadScenario("blackout"), { strategy: "cnp", recordFrames: false }).run();
    expect(sim.log.some((e) => e.type === "SOS_RECEIVED" && /delayed/.test(e.msg))).toBe(true);
    expect(sim.log.some((e) => e.type === "BLACKOUT_END")).toBe(true);
  });
});

describe("fraud mix", () => {
  const sim = new Simulation(loadScenario("fraud-mix"), { strategy: "cnp", recordFrames: false }).run();
  it("genuine same-building cluster is merged into ONE incident and NOT flagged", () => {
    const tower = [...sim.incidents.values()].find((i) => i.reports.some((r) => r.building === "BLD-PRB-TOWER"))!;
    expect(tower.reports.length).toBeGreaterThanOrEqual(5);
    expect(tower.people).toBeGreaterThanOrEqual(20);
    expect(tower.risk.score).toBeLessThan(0.5);
    expect(tower.status).not.toBe("false_report");
  });
  it("copy-paste text burst gets routed to review (flag, not reject)", () => {
    const spam = [...sim.incidents.values()].filter((i) => i.reports.some((r) => r.phone?.startsWith("ph_spam")));
    expect(spam.some((i) => i.risk.reasons.some((r) => /identical text/.test(r)))).toBe(true);
    // flagged incidents still exist as incidents (never auto-rejected)
    expect(spam.length).toBeGreaterThan(0);
  });
  it("impossible travel is detected for the jumping phone", () => {
    const j = [...sim.incidents.values()].filter((i) => i.reports.some((r) => r.phone === "ph_jumper"));
    expect(j.some((i) => i.risk.reasons.some((r) => /km\/h/.test(r)))).toBe(true);
  });
});

describe("Why? explanation", () => {
  it("returns bids, utility breakdown and constraints for an awarded task", () => {
    const sim = new Simulation(loadScenario("baseline-monsoon"), { strategy: "cnp", recordFrames: false }).run(120);
    const awarded = sim.log.find((e) => e.type === "AWARD")!;
    const why = explainTask(sim, awarded.task!)!;
    expect(why.bids.length).toBeGreaterThan(0);
    expect(why.constraints.length).toBeGreaterThan(0);
    expect(why.summary).toMatch(/priority/);
  });
});
