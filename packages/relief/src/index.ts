/**
 * Relief & Donations module. ISOLATED from rescue dispatch (Section 3):
 *  - imports only @floodsetu/shared (never engine/dispatch internals);
 *  - consumes AffectedAreaSummary (aggregated, k-anonymous) — the one-way rescue → relief contract;
 *  - money here is SIMULATED; nothing in this module can reach dispatch scoring.
 */
import { appendEntry, hmac, suppress, verifyChain, type AffectedAreaSummary, type ChainEntry } from "@floodsetu/shared";

export type Item = "water_l" | "food_kits" | "medical_kits" | "shelter_kits";
export const ITEMS: { id: Item; label: string; unit: string }[] = [
  { id: "water_l", label: "Drinking water", unit: "L" },
  { id: "food_kits", label: "Food kits", unit: "kits" },
  { id: "medical_kits", label: "Medical kits", unit: "kits" },
  { id: "shelter_kits", label: "Shelter kits", unit: "kits" },
];

export interface Org {
  id: string;
  name: string;
  kind: "govt" | "ngo" | "agency" | "unknown";
  verified: boolean;
  badge?: { grantedBy: string; at: string; authority: string };
}

export interface CollectionPoint {
  id: string;
  name: string;
  area: string;
  orgId: string;
}

export interface Campaign {
  id: string;
  orgId: string;
  title: string;
  areaIds: string[];
  items: Item[];
  targetInr: number;
  createdAt: string;
}

export type LedgerType = "CAMPAIGN_CREATED" | "DONATION" | "IN_KIND_RECEIVED" | "ALLOCATED" | "DISPATCHED" | "DISTRIBUTED" | "BADGE_GRANTED";

export interface ReliefState {
  orgs: Org[];
  points: CollectionPoint[];
  campaigns: Campaign[];
  ledger: ChainEntry[];
  notify: { at: string; contactHash: string }[];
}

export function record(st: ReliefState, type: LedgerType, actor: string, data: Record<string, unknown>, at?: string) {
  return appendEntry(st.ledger, type, actor, data, at);
}

export const verifyLedger = (st: ReliefState) => verifyChain(st.ledger);

export function createCampaign(st: ReliefState, c: Omit<Campaign, "id" | "createdAt">, at = new Date().toISOString()): { campaign: Campaign; flagged: boolean } {
  const org = st.orgs.find((o) => o.id === c.orgId);
  const campaign: Campaign = { ...c, id: `CMP-${st.campaigns.length + 1}`, createdAt: at };
  st.campaigns.push(campaign);
  record(st, "CAMPAIGN_CREATED", c.orgId, { campaign: campaign.id, title: c.title, areas: c.areaIds, targetInr: c.targetInr, orgVerified: !!org?.verified }, at);
  return { campaign, flagged: !org?.verified };
}

/** Simulated donation; donor is a salted hash — no personal data on the public ledger. */
export function donate(st: ReliefState, campaignId: string, amountInr: number, donorContact: string, pepper: string, at?: string) {
  return record(st, "DONATION", "public", { campaign: campaignId, amountInr: Math.round(amountInr), donor: `d_${hmac(pepper, donorContact).slice(0, 10)}`, simulated: true }, at);
}

// ───────────────────────── aggregates ─────────────────────────

type Flow = Record<Item, number>;
const zero = (): Flow => ({ water_l: 0, food_kits: 0, medical_kits: 0, shelter_kits: 0 });

export function totals(st: ReliefState) {
  const received = zero();
  const allocated = zero();
  const dispatched = zero();
  const distributed = zero();
  let money = 0;
  const byCampaign: Record<string, number> = {};
  for (const e of st.ledger) {
    const d = e.data as { item?: Item; qty?: number; amountInr?: number; campaign?: string };
    if (e.type === "DONATION") {
      money += d.amountInr ?? 0;
      byCampaign[d.campaign!] = (byCampaign[d.campaign!] ?? 0) + (d.amountInr ?? 0);
    }
    if (!d.item) continue;
    if (e.type === "IN_KIND_RECEIVED") received[d.item] += d.qty ?? 0;
    if (e.type === "ALLOCATED") allocated[d.item] += d.qty ?? 0;
    if (e.type === "DISPATCHED") dispatched[d.item] += d.qty ?? 0;
    if (e.type === "DISTRIBUTED") distributed[d.item] += d.qty ?? 0;
  }
  return { money, byCampaign, received, allocated, dispatched, distributed };
}

/** Sankey: donated → received → allocated → dispatched → distributed, per item. */
export function sankey(st: ReliefState) {
  const t = totals(st);
  const nodes = ["Donated (₹ → kits)", "Received", "Allocated", "Dispatched", "Distributed", "In stock", "In transit"].map((name) => ({ name }));
  const links: { source: number; target: number; value: number; item: string }[] = [];
  for (const it of ITEMS) {
    const r = t.received[it.id];
    const a = Math.min(r, t.allocated[it.id]);
    const d = Math.min(a, t.dispatched[it.id]);
    const x = Math.min(d, t.distributed[it.id]);
    if (r) links.push({ source: 0, target: 1, value: r, item: it.id });
    if (a) links.push({ source: 1, target: 2, value: a, item: it.id });
    if (r - a > 0) links.push({ source: 1, target: 5, value: r - a, item: it.id });
    if (d) links.push({ source: 2, target: 3, value: d, item: it.id });
    if (a - d > 0) links.push({ source: 2, target: 5, value: a - d, item: it.id });
    if (x) links.push({ source: 3, target: 4, value: x, item: it.id });
    if (d - x > 0) links.push({ source: 3, target: 6, value: d - x, item: it.id });
  }
  return { nodes, links };
}

/** Needs (from verified rescue summaries) vs fulfilled (distributed) — k-anonymous. */
export function needsVsFulfilled(st: ReliefState, summaries: AffectedAreaSummary[]) {
  return summaries.map((s) => {
    const dist = zero();
    let beneficiaries = 0;
    for (const e of st.ledger) {
      const d = e.data as { area?: string; item?: Item; qty?: number; beneficiaries?: number };
      if (e.type === "DISTRIBUTED" && d.area === s.areaId && d.item) {
        dist[d.item] += d.qty ?? 0;
        beneficiaries += d.beneficiaries ?? 0;
      }
    }
    return {
      areaId: s.areaId,
      areaName: s.areaName,
      status: s.status,
      need: { water_l: s.needs.water, food_kits: s.needs.food, medical_kits: s.needs.medical, shelter_kits: s.needs.shelterKits },
      fulfilled: dist,
      beneficiaries: suppress(beneficiaries),
      verifiedIncidents: s.verifiedIncidents,
    };
  });
}

// ───────────────────────── fraud flags (never auto-reject; route to admin review) ─────────────────────────

export interface ReliefFlag {
  kind: "unverified_campaign" | "duplicate_beneficiary" | "over_distribution" | "donation_spike";
  severity: "warn" | "critical";
  detail: string;
  ref: string;
}

export function reliefFlags(st: ReliefState): ReliefFlag[] {
  const flags: ReliefFlag[] = [];
  for (const c of st.campaigns) {
    const org = st.orgs.find((o) => o.id === c.orgId);
    if (!org?.verified) flags.push({ kind: "unverified_campaign", severity: "critical", detail: `"${c.title}" by ${org?.name ?? c.orgId} — organisation not verified by an authority; hidden from public donation flow`, ref: c.id });
  }
  const seen = new Map<string, number>();
  for (const e of st.ledger) {
    const d = e.data as { beneficiaryHash?: string; item?: string; area?: string };
    if (e.type !== "DISTRIBUTED" || !d.beneficiaryHash) continue;
    const k = `${d.beneficiaryHash}|${d.item}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
    if (seen.get(k) === 2) flags.push({ kind: "duplicate_beneficiary", severity: "warn", detail: `Same beneficiary claimed ${d.item} twice (area ${d.area}) — verify at distribution point`, ref: `#${e.seq}` });
  }
  const t = totals(st);
  for (const it of ITEMS) {
    if (t.distributed[it.id] > t.dispatched[it.id]) flags.push({ kind: "over_distribution", severity: "critical", detail: `${it.label}: distributed ${t.distributed[it.id]} > dispatched ${t.dispatched[it.id]}`, ref: it.id });
    if (t.dispatched[it.id] > t.received[it.id]) flags.push({ kind: "over_distribution", severity: "critical", detail: `${it.label}: dispatched ${t.dispatched[it.id]} > received ${t.received[it.id]}`, ref: it.id });
  }
  // donation spikes: hourly totals vs the MEDIAN hour (robust — a single outlier can't hide in its own z-score)
  const hourly = new Map<string, number>();
  for (const e of st.ledger) if (e.type === "DONATION") hourly.set(e.at.slice(0, 13), (hourly.get(e.at.slice(0, 13)) ?? 0) + ((e.data as { amountInr?: number }).amountInr ?? 0));
  const vals = [...hourly.values()].sort((a, b) => a - b);
  if (vals.length >= 4) {
    const med = vals[Math.floor(vals.length / 2)];
    for (const [h, v] of hourly) if (med > 0 && v / med >= 5) flags.push({ kind: "donation_spike", severity: "warn", detail: `Donations in hour ${h.slice(11)}:00 = ₹${v.toLocaleString("en-IN")} (${(v / med).toFixed(1)}× the median hour) — check for bot or laundering activity`, ref: h });
  }
  return flags;
}

// ───────────────────────── seed (synthetic) ─────────────────────────

export function seedRelief(pepper: string, base = Date.parse("2026-07-14T06:00:00Z"), withFraud = true): ReliefState {
  const st: ReliefState = {
    orgs: [
      { id: "ORG-SDMA", name: "Jalnagar District Disaster Management Authority", kind: "govt", verified: true, badge: { grantedBy: "admin", at: new Date(base).toISOString(), authority: "SDMA order (synthetic)" } },
      { id: "ORG-RC", name: "Riverbank Relief Collective", kind: "ngo", verified: true, badge: { grantedBy: "admin", at: new Date(base).toISOString(), authority: "NGO Darpan-style registration (synthetic)" } },
      { id: "ORG-MED", name: "Jalnagar Medical Volunteers", kind: "ngo", verified: true, badge: { grantedBy: "admin", at: new Date(base).toISOString(), authority: "District health dept. (synthetic)" } },
      { id: "ORG-FAKE", name: "Jalnagar Flood Help Trust", kind: "unknown", verified: false },
    ],
    points: [
      { id: "CP-1", name: "Shanti Nagar School gate", area: "SHN", orgId: "ORG-SDMA" },
      { id: "CP-2", name: "Rail Colony community centre", area: "RLC", orgId: "ORG-RC" },
      { id: "CP-3", name: "Unchi Pahadi college ground", area: "UCH", orgId: "ORG-SDMA" },
      { id: "CP-4", name: "District Hospital annexe", area: "SHN", orgId: "ORG-MED" },
    ],
    campaigns: [],
    ledger: [],
    notify: [],
  };
  const at = (min: number) => new Date(base + min * 60_000).toISOString();
  createCampaign(st, { orgId: "ORG-SDMA", title: "Clean water for Ghat Tola & Machhua Tola", areaIds: ["GHT", "MCH"], items: ["water_l"], targetInr: 400000 }, at(10));
  createCampaign(st, { orgId: "ORG-RC", title: "Food kits for Purani Basti elders", areaIds: ["PRB"], items: ["food_kits"], targetInr: 250000 }, at(15));
  createCampaign(st, { orgId: "ORG-MED", title: "Medical kits for shelters", areaIds: ["GHT", "PRB", "MCH", "RLC"], items: ["medical_kits"], targetInr: 150000 }, at(20));
  let r = 1;
  const rand = () => ((r = (r * 48271) % 2147483647) / 2147483647);
  for (let k = 0; k < 60; k++) donate(st, `CMP-${1 + (k % 3)}`, 200 + Math.round(rand() * 4800), `donor${k}@example.org`, pepper, at(30 + k * 6));
  const flows: [string, Item, number, string][] = [
    ["CP-1", "water_l", 6000, "GHT"], ["CP-2", "food_kits", 900, "PRB"], ["CP-4", "medical_kits", 160, "MCH"], ["CP-3", "shelter_kits", 240, "RLC"], ["CP-1", "water_l", 3000, "MCH"],
  ];
  let m = 60;
  for (const [cp, item, qty, area] of flows) {
    record(st, "IN_KIND_RECEIVED", cp, { point: cp, item, qty }, at((m += 7)));
    record(st, "ALLOCATED", "ORG-SDMA", { item, qty: Math.round(qty * 0.9), area }, at((m += 9)));
    record(st, "DISPATCHED", cp, { item, qty: Math.round(qty * 0.8), area }, at((m += 13)));
    for (let b = 0; b < 6; b++) record(st, "DISTRIBUTED", `${cp}-team`, { item, qty: Math.round((qty * 0.7) / 6), area, beneficiaries: 12 + b, beneficiaryHash: `b_${hmac(pepper, `${area}-${item}-${b}`).slice(0, 10)}` }, at((m += 5)));
  }
  if (withFraud) {
    createCampaign(st, { orgId: "ORG-FAKE", title: "URGENT: 50 trapped at the old temple — donate now", areaIds: ["GHT"], items: ["food_kits"], targetInr: 500000 }, at((m += 4)));
    const dupe = `b_${hmac(pepper, "GHT-water_l-0").slice(0, 10)}`;
    for (let k = 0; k < 2; k++) record(st, "DISTRIBUTED", "CP-1-team", { item: "water_l", qty: 40, area: "GHT", beneficiaries: 1, beneficiaryHash: dupe }, at((m += 3)));
    record(st, "DISTRIBUTED", "CP-4-team", { item: "medical_kits", qty: 400, area: "PRB", beneficiaries: 30 }, at((m += 3)));
    for (let k = 0; k < 8; k++) donate(st, "CMP-2", 45000, `burst${k}@example.org`, pepper, at(m + 1 + k));
  }
  return st;
}
