import { describe, expect, it } from "vitest";
import { GAUGES, ratingFlow, riverStatus, Simulation, stageOf, trendCmPerHr } from "../src";
import { loadScenario } from "./helpers";

describe("river monitoring", () => {
  const g = GAUGES[0]!;

  it("rating curve: more stage → more flow, monotonic", () => {
    let prev = -1;
    for (let s = g.datum - 1; s <= g.hfl + 0.5; s += 0.1) {
      const q = ratingFlow(g, s);
      expect(q).toBeGreaterThanOrEqual(prev);
      prev = q;
    }
  });

  it("status follows CWC-style thresholds", () => {
    expect(riverStatus(g, g.warning - 0.01)).toBe("normal");
    expect(riverStatus(g, g.warning)).toBe("warning");
    expect(riverStatus(g, g.danger)).toBe("danger");
    expect(riverStatus(g, g.hfl)).toBe("extreme");
  });

  it("trend is the slope in cm/hour", () => {
    expect(trendCmPerHr([[0, 48], [10, 48.1], [20, 48.2], [30, 48.3]])).toBe(60);
    expect(trendCmPerHr([[0, 48.3], [30, 48]])).toBe(-60);
    expect(trendCmPerHr([[0, 48]])).toBe(0);
  });

  it("simulation logs a reading every 10 min at each station; rising water shows a rising trend and more flow", () => {
    const sim = new Simulation(loadScenario("baseline-monsoon"), { strategy: "cnp", recordFrames: false });
    sim.run(30);
    const early = sim.frame().river.find((r) => r.nbhd === "GHT")!;
    sim.run(140);
    const later = sim.frame().river.find((r) => r.nbhd === "GHT")!;
    expect(later.history.length).toBeGreaterThan(early.history.length);
    expect(later.stage!).toBeGreaterThan(early.stage!);
    expect(later.flow!).toBeGreaterThan(early.flow!);
    expect(later.trendCmHr).toBeGreaterThan(0);
    expect(later.history.every(([t], i, a) => i === 0 || t - a[i - 1]![0] === 10)).toBe(true);
    expect(stageOf(g, 0)).toBe(g.datum);
  });

  it("a gauge in a blackout goes stale instead of reporting", () => {
    const sim = new Simulation(loadScenario("baseline-monsoon"), { strategy: "cnp", recordFrames: false });
    sim.run(40);
    sim.inject({ type: "BLACKOUT", nbhd: "GHT", duration: 120 });
    const before = sim.frame().river.find((r) => r.nbhd === "GHT")!.lastTick;
    sim.run(100);
    const st = sim.frame().river.find((r) => r.nbhd === "GHT")!;
    expect(st.lastTick).toBe(before);
    expect(st.ageMin!).toBeGreaterThanOrEqual(50);
  });
});

describe("multi-device corroboration", () => {
  it("3 different phones reporting the same place verify the incident; 3 reports from ONE phone do not", () => {
    const mk = (phones: string[]) => {
      const sim = new Simulation(loadScenario("baseline-monsoon"), { strategy: "cnp", recordFrames: false });
      sim.run(5);
      phones.forEach((phone, i) =>
        sim.inject({ type: "SOS", sos: { id: `T-${i}`, x: 2.2, y: 4.6, people: 3, urgency: "urgent", phone, text: "water entering ground floor", building: "BLD-test" } }),
      );
      sim.run(8);
      return [...sim.incidents.values()].find((i) => i.reports.some((r) => r.sosId === "T-0"))!;
    };
    expect(mk(["pA", "pB", "pC"]).verification).toBe("verified");
    expect(mk(["pA", "pA", "pA"]).verification).not.toBe("verified");
  });
});

describe("flood rescue engineers", () => {
  it("a ground rescue of people trapped in a structure requires the engineering skill", () => {
    const sim = new Simulation(loadScenario("baseline-monsoon"), { strategy: "cnp", recordFrames: false });
    sim.run(3);
    sim.inject({ type: "SOS", sos: { id: "TRAP-1", x: 3.1, y: 6.0, people: 2, urgency: "critical", needs: ["trapped"], phone: "pT", text: "wall collapsed, we are trapped" } });
    sim.run(40);
    const inc = [...sim.incidents.values()].find((i) => i.reports.some((r) => r.sosId === "TRAP-1"))!;
    const tasks = inc.taskIds.map((t) => sim.tasks.get(t)!).filter((t) => t.kind === "RESCUE" && t.mode === "ground");
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) expect(t.skills).toContain("engineering");
    const holders = sim.agents.filter((a) => a.queue.some((c) => tasks.some((t) => t.id === c.taskId)) || tasks.some((t) => t.assigned?.includes?.(a.id)));
    for (const a of holders) expect(a.skills).toContain("engineering");
    expect(sim.agents.filter((a) => a.skills.includes("engineering")).map((a) => a.id)).toEqual(["G-16", "G-17"]);
  });
});
