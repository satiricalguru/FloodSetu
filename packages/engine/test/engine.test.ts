import { describe, expect, it } from "vitest";
import { applyReport, buildWorld, edgeStatus, estimatePeople, findCluster, gini, hashStr, hungarian, jain, priority, runMetrics, scoreRisk, Simulation, textSimilarity, type Incident, type Report } from "../src";
import { newBeliefs } from "../src/beliefs";
import { loadScenario, SCENARIOS } from "./helpers";

describe("world", () => {
  it("is connected for ground agents and has 3 bridges, 6 ghats, 6 shelters", () => {
    const w = buildWorld();
    expect(w.bridges).toEqual(["B1", "B2", "B3"]);
    expect(w.ghats).toHaveLength(6);
    expect(w.shelters).toHaveLength(6);
    const seen = new Set([0]);
    const st = [0];
    while (st.length) {
      const u = st.pop()!;
      for (const { to, edge } of w.adj[u]) if (w.edgeById.get(edge)!.kind !== "water" && !seen.has(to)) (seen.add(to), st.push(to));
    }
    expect(seen.size).toBe(w.nodes.filter((n) => n.kind !== "river").length);
  });
});

describe("hungarian", () => {
  it("finds the optimal assignment", () => {
    const C = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ];
    const a = hungarian(C);
    const cost = a.reduce((s, j, i) => s + C[i][j], 0);
    expect(cost).toBe(5);
  });
  it("matches brute force on random 5x5 matrices", () => {
    let seed = 1;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 100;
    for (let k = 0; k < 30; k++) {
      const C = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => Math.round(r())));
      const a = hungarian(C);
      const got = a.reduce((s, j, i) => s + C[i][j], 0);
      let best = Infinity;
      const perm = (p: number[], rest: number[]) => {
        if (!rest.length) best = Math.min(best, p.reduce((s, j, i) => s + C[i][j], 0));
        rest.forEach((x, i) => perm([...p, x], rest.filter((_, k2) => k2 !== i)));
      };
      perm([], [0, 1, 2, 3, 4]);
      expect(got).toBe(best);
    }
  });
});

describe("belief fusion", () => {
  it("opposing citizen vs rescuer reports mark the edge CONTESTED; a direct observation resolves it", () => {
    const b = newBeliefs({});
    applyReport(b, "B2", { claim: "open", confidence: 0.9, source: "citizen" }, 60);
    expect(edgeStatus(b, "B2", 60)).toBe("open");
    const r = applyReport(b, "B2", { claim: "closed", confidence: 0.9, source: "rescuer" }, 78);
    expect(r.contradiction).toBe(true);
    expect(edgeStatus(b, "B2", 78)).toBe("contested");
    const v = applyReport(b, "B2", { claim: "closed", confidence: 1, source: "rescuer" }, 100);
    expect(v.resolved).toBe(true);
    expect(edgeStatus(b, "B2", 100)).toBe("closed");
  });
  it("evidence decays toward the survey prior (closed → unknown → open)", () => {
    const b = newBeliefs({});
    applyReport(b, "e1", { claim: "closed", confidence: 1, source: "sensor" }, 0);
    expect(edgeStatus(b, "e1", 10)).toBe("closed");
    expect(edgeStatus(b, "e1", 120)).toBe("unknown");
    expect(edgeStatus(b, "e1", 400)).toBe("open");
  });
  it("a single citizen report against the prior does not create a contradiction", () => {
    const b = newBeliefs({});
    const r = applyReport(b, "e2", { claim: "closed", confidence: 0.8, source: "citizen" }, 5);
    expect(r.contradiction).toBe(false);
    expect(edgeStatus(b, "e2", 5)).toBe("unknown");
  });
});

const rep = (o: Partial<Report>): Report => ({ id: "R", sosId: "FS-X", tick: 0, receivedTick: 0, node: 0, x: 0, y: 0, nbhd: "GHT", people: 3, urgency: "urgent", needs: [], text: "", source: "citizen", real: true, risk: { score: 0, reasons: [] }, ...o });

describe("duplicate SOS", () => {
  it("merges same-phone re-sends and counts the household once", () => {
    const a = rep({ id: "a", phone: "p1", people: 4, text: "water entering house" });
    const b = rep({ id: "b", phone: "p1", people: 4, tick: 5, text: "water entering house" });
    expect(estimatePeople([a, b]).estimate).toBe(4);
  });
  it("same building, many phones = one LARGE genuine incident (sum of households)", () => {
    const rs = [1, 2, 3, 4, 5, 6].map((k) => rep({ id: `r${k}`, phone: `p${k}`, building: "BLD-1", people: 5, text: `roof ${k} different words entirely ${k * 7}` }));
    const est = estimatePeople(rs);
    expect(est.estimate).toBe(30);
    expect(est.range).toEqual([5, 30]);
  });
  it("links within 120 m / 30 min but not 500 m apart", () => {
    const inc = { reports: [rep({ x: 1, y: 1 })] } as Incident;
    expect(findCluster([inc], rep({ x: 1.08, y: 1, tick: 10 }))).not.toBeNull();
    expect(findCluster([inc], rep({ x: 1.5, y: 1, tick: 10 }))).toBeNull();
  });
  it("Hindi transliteration normalises for similarity", () => {
    expect(textSimilarity("Paani ghar mein ghus gaya", "pani ghar mein ghus gaya")).toBeGreaterThan(0.8);
  });
});

describe("risk score never depends on report density", () => {
  it("many genuine reports from one area are not flagged", () => {
    const recent = Array.from({ length: 30 }, (_, i) => ({ text: `help family ${i} on roof number ${i * 13}`, phone: `p${i}`, x: 1 + i * 0.001, y: 1, tick: 1 }));
    const r = scoreRisk({ text: "we are on the roof, two kids", phone: "pX", x: 1, y: 1, tick: 2, urgency: "critical" }, { recent, depthAtNode: 1.2, areaFlooded: true });
    expect(r.score).toBe(0);
  });
  it("identical text from many phones far apart is flagged (but only routed to review)", () => {
    const text = "URGENT 50 people trapped at the old temple call now";
    const recent = [0, 1, 2, 3].map((i) => ({ text, phone: `s${i}`, x: i * 2, y: 0, tick: 1 }));
    const r = scoreRisk({ text, phone: "s9", x: 9, y: 0, tick: 2, urgency: "critical" }, { recent, depthAtNode: 1, areaFlooded: true });
    expect(r.score).toBeGreaterThan(0.4);
  });
});

describe("fairness metrics", () => {
  it("jain = 1 for equal, ~1/n for one-hot; gini 0 for equal", () => {
    expect(jain([5, 5, 5])).toBe(1);
    expect(jain([1, 0, 0, 0])).toBeCloseTo(0.25);
    expect(gini([3, 3, 3])).toBe(0);
    expect(gini([0, 0, 0, 10])).toBeCloseTo(0.75);
  });
});

describe("priority has no money inputs (firewall at the type level)", () => {
  it("rejects unknown fields at compile time and grows with aging", () => {
    const base = { urgency: "urgent" as const, needs: [], people: 3, nbhdVulnerability: 0.5, verification: "pending" as const, escalated: false, nbhdLag: 0 };
    expect(priority({ ...base, waitTicks: 60 }).total).toBeGreaterThan(priority({ ...base, waitTicks: 0 }).total);
    // @ts-expect-error donations must never be a dispatch input
    priority({ ...base, waitTicks: 0, donationVolume: 1e6 });
  });
  it("critical is never discounted by verification status", () => {
    const p = { urgency: "critical" as const, needs: [], people: 3, nbhdVulnerability: 0.5, waitTicks: 0, escalated: false, nbhdLag: 0 };
    expect(priority({ ...p, verification: "under_review" }).C).toBe(1);
  });
});

describe("determinism", () => {
  it("same seed + same events → identical event log", () => {
    const sc = loadScenario("triple-failure");
    const h = (s: Simulation) => hashStr(s.log.map((e) => `${e.tick}|${e.type}|${e.msg}`).join("\n"));
    const a = new Simulation(sc, { strategy: "cnp", recordFrames: false }).run(200);
    const b = new Simulation(sc, { strategy: "cnp", recordFrames: false }).run(200);
    expect(h(a)).toBe(h(b));
  });
});

describe("all scenarios × all strategies: zero safety-invariant violations", () => {
  for (const id of SCENARIOS) {
    for (const strategy of ["cnp", "central", "omniscient", "greedy"] as const) {
      it(`${id} / ${strategy}`, () => {
        const sim = new Simulation(loadScenario(id), { strategy, recordFrames: false }).run();
        expect(sim.invariantViolations).toEqual([]);
        const m = runMetrics(sim);
        expect(m.rescued).toBeGreaterThan(0);
        if (strategy === "omniscient") expect(m.routeViolations).toBe(0);
      });
    }
  }
});
