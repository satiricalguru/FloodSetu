import { ITEMS, needsVsFulfilled, reliefFlags, sankey, totals, verifyLedger, type ReliefState } from "@floodsetu/relief";
import type { AffectedAreaSummary } from "@floodsetu/shared";
import { readSummaries } from "../contract";

/** Snapshot used before any control room has published live summaries (synthetic). */
const FALLBACK: AffectedAreaSummary[] = [
  ["GHT", "Ghat Tola", "flooded", 14, 96, 61],
  ["MCH", "Machhua Tola", "flooded", 11, 74, 40],
  ["PRB", "Purani Basti", "flooded", 12, 88, 52],
  ["RLC", "Rail Colony", "at_risk", 4, 21, 9],
  ["SHN", "Shanti Nagar", "at_risk", 0, 0, 0],
  ["UCH", "Unchi Pahadi", "normal", 0, 0, 0],
].map(([areaId, areaName, status, inc, ppl, sh]) => ({
  areaId: areaId as string,
  areaName: areaName as string,
  status: status as AffectedAreaSummary["status"],
  verifiedIncidents: (inc as number) > 0 && (inc as number) < 5 ? "<5" : (inc as number),
  peopleAffected: ppl as number,
  peopleSheltered: sh as number,
  needs: { water: (ppl as number) * 3, food: (ppl as number) * 2, medical: Math.round((inc as number) * 1.5), shelterKits: Math.ceil((sh as number) / 4) },
  updatedAt: "synthetic snapshot",
}));

export function publicState(st: ReliefState) {
  const live = readSummaries();
  const summaries = live.summaries.length ? live.summaries : FALLBACK;
  const flags = reliefFlags(st);
  const flaggedCampaigns = new Set(flags.filter((f) => f.kind === "unverified_campaign").map((f) => f.ref));
  const t = totals(st);
  return {
    totals: t,
    items: ITEMS,
    sankey: sankey(st),
    areas: needsVsFulfilled(st, summaries),
    summariesSource: live.summaries.length ? `live from control room · ${live.at}` : "synthetic snapshot (no live control room)",
    campaigns: st.campaigns.filter((c) => !flaggedCampaigns.has(c.id)).map((c) => ({ ...c, raised: t.byCampaign[c.id] ?? 0, org: st.orgs.find((o) => o.id === c.orgId) })),
    hiddenCampaigns: flaggedCampaigns.size,
    points: st.points.map((p) => ({ ...p, org: st.orgs.find((o) => o.id === p.orgId)?.name })),
    orgs: st.orgs.filter((o) => o.verified),
    feed: [...st.ledger].reverse().filter((e) => e.type !== "DONATION").slice(0, 40).map((e) => ({ seq: e.seq, at: e.at, type: e.type, actor: e.actor, data: { ...e.data, beneficiaryHash: undefined } , hash: e.hash.slice(0, 12) })),
    donations: [...st.ledger].reverse().filter((e) => e.type === "DONATION").slice(0, 20).map((e) => ({ seq: e.seq, at: e.at, data: e.data, hash: e.hash.slice(0, 12) })),
    ledger: { length: st.ledger.length, head: st.ledger[st.ledger.length - 1]?.hash ?? null, verify: verifyLedger(st) },
    flagsPublic: flags.filter((f) => f.kind !== "unverified_campaign").length,
  };
}
