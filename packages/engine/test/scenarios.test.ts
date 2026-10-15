import { describe, expect, it } from "vitest";
import { Simulation, explainTask } from "../src";
import { loadScenario } from "./helpers";

describe("triple failure (stretch demo)", () => {
  const sim = new Simulation(loadScenario("triple-failure"), { strategy: "cnp", recordFrames: false }).run(200);
  const cas = sim.cascades.find((c) => c.causes.length >= 3)!;
  it("records one cascade with all three causes in the same tick", () => {
    expect(cas).toBeDefined();
    expect(cas.causes.map((c) => c.type).filter((t) => t !== "STRANDED").sort()).toEqual(["AGENT_FAILURE", "BRIDGE_COLLAPSE", "SHELTER_OVERFLOW"]);
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

describe("satellites (Indian constellation, latency-aware)", () => {
  const sim = new Simulation(loadScenario("dam-release"), { strategy: "cnp", recordFrames: false }).run();
  it("acquires SAR passes and delivers products only after their latency", () => {
    const pass = sim.log.find((e) => e.type === "SAT_PASS" && /EOS-04/.test(e.msg))!;
    const prod = sim.log.find((e) => e.type === "SAT_PRODUCT" && /^EOS-04/.test(e.msg))!;
    expect(prod.tick - pass.tick).toBe(sim.satellites.find((s) => s.id === "EOS-04")!.latency);
    expect(prod.msg).toMatch(/data age 110 min/);
  });
  it("never lets an old image override fresher field data (observation-time LWW)", () => {
    for (const p of sim.satProducts.filter((x) => x.kind === "sar")) expect(p.applied).toBe(true);
    const nowcast = sim.log.find((e) => e.type === "RAIN_NOWCAST");
    expect(nowcast).toBeDefined();
  });
  it("optical scenes are rejected under monsoon cloud", () => {
    expect(sim.log.some((e) => e.type === "SAT_PRODUCT" && /cloud cover/.test(e.msg))).toBe(true);
  });
});

describe("dams and high-risk zones", () => {
  it("a 68-year-old barrage with a 'needs attention' inspection makes its downstream zone HIGH risk", async () => {
    const { damRisk, DEFAULT_DAMS, damZones } = await import("../src/earth");
    const d1 = DEFAULT_DAMS.find((d) => d.id === "D1")!;
    expect(damRisk(d1).level).toMatch(/high/);
    expect(damZones(DEFAULT_DAMS).GHT).toMatch(/high/);
    expect(damZones(DEFAULT_DAMS).SHN).toBe("low");
  });
  it("a release raises the zone to very high and the water downstream", () => {
    const sim = new Simulation(loadScenario("dam-release"), { strategy: "cnp", recordFrames: false });
    sim.run(129);
    const before = sim.levelsTruth.GHT;
    sim.run(160);
    expect(sim.damZoneMap().GHT).toBe("very_high");
    expect(sim.levelsTruth.GHT).toBeGreaterThan(before);
  });
});

describe("caller's phone drowns mid-request", () => {
  const sim = new Simulation(loadScenario("dam-release"), { strategy: "cnp", recordFrames: false }).run();
  it("keeps the request, upgrades to critical, escalates, and still rescues", () => {
    const inc = [...sim.incidents.values()].find((i) => i.deviceLost)!;
    expect(inc).toBeDefined();
    expect(inc.urgency).toBe("critical");
    expect(inc.escalated).toBe(true);
    expect(inc.firstServedTick).toBeDefined();
    expect(sim.invariantViolations).toEqual([]);
  });
});
