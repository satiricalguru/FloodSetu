import { describe, expect, it } from "vitest";
import { reliefFlags, sankey, seedRelief, totals, verifyLedger } from "../src";

describe("relief ledger", () => {
  it("seed ledger verifies; tampering is detected", () => {
    const st = seedRelief("pep");
    expect(verifyLedger(st).ok).toBe(true);
    (st.ledger[5].data as Record<string, unknown>).amountInr = 99999999;
    expect(verifyLedger(st).ok).toBe(false);
  });
  it("sankey flows are conserved (no stage emits more than it received)", () => {
    const st = seedRelief("pep", undefined, false);
    const s = sankey(st);
    const into = (n: number) => s.links.filter((l) => l.target === n).reduce((a, l) => a + l.value, 0);
    const out = (n: number) => s.links.filter((l) => l.source === n).reduce((a, l) => a + l.value, 0);
    for (const n of [1, 2, 3]) expect(out(n)).toBeLessThanOrEqual(into(n) + 1e-9);
    expect(totals(st).money).toBeGreaterThan(0);
  });
  it("fraud-mix: flags fake campaign, duplicate beneficiary, over-distribution, donation spike", () => {
    const kinds = new Set(reliefFlags(seedRelief("pep")).map((f) => f.kind));
    expect(kinds).toEqual(new Set(["unverified_campaign", "duplicate_beneficiary", "over_distribution", "donation_spike"]));
  });
  it("clean seed raises no flags", () => {
    expect(reliefFlags(seedRelief("pep", undefined, false))).toEqual([]);
  });
});
