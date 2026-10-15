/**
 * Earth-observation & infrastructure layer (RESEARCH §4.11–4.12).
 *
 * SATELLITES — Indian assets, modelled honestly:
 *  - EOS-04 (RISAT-1A, ISRO) C-band SAR: sees through monsoon cloud. Official repeat is 17 days, so in a real event
 *    you get ~1 tasked pass. NRSC flood bulletins appeared same-day to ~2 days after acquisition → latency modelled.
 *  - NISAR (NASA-ISRO), ISRO's S-band SAR: 12-day repeat (~6 days avg with asc/desc), pre-launch target <5 h for
 *    disaster products → latency modelled.
 *  - INSAT-3DS + INSAT-3DR (ISRO/IMD) geostationary imagers, staggered to 15-min imaging; IMSRA rainfall is
 *    half-hourly on MOSDAC → rain nowcast cadence 15 min, latency ~30 min (modelled).
 *  - Resourcesat-2A LISS-IV (optical): included to show why SAR matters — monsoon cloud makes it unusable.
 *  Pass times inside a 6-hour scenario are SYNTHETIC (compressed); latencies are the realistic part.
 *
 * DAMS — fictional upstream dams with NRLD-style register fields (CWC/NDSA National Register of Large Dams:
 * year of completion, type, height, capacity). Age + condition + hazard → downstream risk zone.
 */
import type { Scenario } from "./types";

export type SatKind = "sar" | "geo_rain" | "optical";

export interface SatelliteDef {
  id: string;
  name: string;
  agency: string;
  sensor: string;
  kind: SatKind;
  swath: string[]; // neighbourhoods covered by a pass
  passes: number[]; // acquisition ticks
  latency: number; // ticks from acquisition to product available at the control room
  accuracyM: number; // water-level retrieval error (m)
  note: string;
  portal: string;
}

export interface SatProduct {
  id: string;
  sat: string;
  kind: SatKind;
  acquiredTick: number;
  availableTick: number;
  levels?: Record<string, number>;
  floodedCells?: Record<string, number>;
  rain?: Record<string, number>; // mm/h
  cloudPct?: number;
  usable: boolean;
  applied: boolean;
}

export const ALL_NBHDS = ["GHT", "PRB", "SHN", "RLC", "MCH", "UCH"];
/** CWC-style river gauges exist only on the river-front neighbourhoods; inland areas depend on field reports + satellites. */
export const GAUGED = ["GHT", "PRB", "MCH"];

/**
 * River monitoring stations (CWC-style level-forecasting sites, fictional values). A gauge reads river **stage** in metres
 * above a datum; warning / danger levels and the highest flood level (HFL) are fixed per site as CWC publishes them.
 * Discharge is derived from stage with a power-law **rating curve** Q = C·(h − h₀)^b — exactly how stage-discharge sites
 * report flow. `levelOffset` maps the engine's flood depth (m over the riverbank) onto stage.
 */
export interface GaugeDef {
  id: string;
  nbhd: string;
  name: string;
  river: string;
  datum: number; // stage (m) when the bank is just at its edge (engine flood depth 0)
  warning: number; // stage (m)
  danger: number;
  hfl: number;
  rating: { c: number; h0: number; b: number };
}
export const GAUGES: GaugeDef[] = [
  { id: "JN-GHT", nbhd: "GHT", name: "Ghat Tola (main ghat)", river: "Jal river", datum: 48.2, warning: 48.9, danger: 49.4, hfl: 50.35, rating: { c: 310, h0: 44.6, b: 1.55 } },
  { id: "JN-PRB", nbhd: "PRB", name: "Purani Basti (old bridge)", river: "Jal river", datum: 47.6, warning: 48.3, danger: 48.8, hfl: 49.7, rating: { c: 280, h0: 44.1, b: 1.55 } },
  { id: "JN-MCH", nbhd: "MCH", name: "Machhua Tola (fishers' ghat)", river: "Jal river", datum: 46.9, warning: 47.5, danger: 48.0, hfl: 48.95, rating: { c: 295, h0: 43.5, b: 1.55 } },
];

export type RiverStatus = "normal" | "warning" | "danger" | "extreme";
export const stageOf = (g: GaugeDef, depth: number) => Math.round((g.datum + Math.max(-1.2, depth)) * 100) / 100;
export const ratingFlow = (g: GaugeDef, stage: number) => Math.round(g.rating.c * Math.pow(Math.max(0, stage - g.rating.h0), g.rating.b));
export const riverStatus = (g: GaugeDef, stage: number): RiverStatus => (stage >= g.hfl ? "extreme" : stage >= g.danger ? "danger" : stage >= g.warning ? "warning" : "normal");
/** least-squares slope of the readings in the last `windowMin` minutes, in cm/hour (0 with < 2 readings) */
export function trendCmPerHr(readings: [number, number][], windowMin = 60): number {
  if (readings.length < 2) return 0;
  const last = readings[readings.length - 1]![0];
  const r = readings.filter(([t]) => t >= last - windowMin);
  if (r.length < 2) return 0;
  const n = r.length;
  const mt = r.reduce((a, [t]) => a + t, 0) / n;
  const ms = r.reduce((a, [, s]) => a + s, 0) / n;
  const num = r.reduce((a, [t, s]) => a + (t - mt) * (s - ms), 0);
  const den = r.reduce((a, [t]) => a + (t - mt) ** 2, 0);
  return den ? Math.round((num / den) * 60 * 100) : 0;
}

export function defaultSatellites(duration: number): SatelliteDef[] {
  const at = (f: number) => Math.round(duration * f);
  const geo: number[] = [];
  for (let t = 5; t < duration; t += 15) geo.push(t);
  return [
    {
      id: "EOS-04",
      name: "EOS-04 (RISAT-1A)",
      agency: "ISRO",
      sensor: "C-band SAR · MRS ScanSAR",
      kind: "sar",
      swath: ["GHT", "PRB", "RLC", "MCH"],
      passes: [at(0.22)],
      latency: 110,
      accuracyM: 0.1,
      note: "All-weather radar. 17-day repeat → one tasked pass per event. Latency modelled (NRSC bulletins: same day to ~2 days).",
      portal: "NRSC Bhoonidhi / NDEM",
    },
    {
      id: "NISAR-S",
      name: "NISAR (S-band)",
      agency: "ISRO · NASA",
      sensor: "S-band SAR (ISRO payload)",
      kind: "sar",
      swath: ALL_NBHDS,
      passes: [at(0.48)],
      latency: 95,
      accuracyM: 0.12,
      note: "12-day repeat (~6 days avg asc/desc). Pre-launch target <5 h for disaster products; latency modelled.",
      portal: "ISRO / ASF",
    },
    {
      id: "INSAT-3DS",
      name: "INSAT-3DS + 3DR",
      agency: "ISRO · IMD",
      sensor: "Geostationary imager · IMSRA rainfall",
      kind: "geo_rain",
      swath: ALL_NBHDS,
      passes: geo,
      latency: 30,
      accuracyM: 0,
      note: "Staggered 15-min imaging; half-hourly rainfall (~4 km). Sees rain, not flood extent.",
      portal: "MOSDAC",
    },
    {
      id: "RS-2A",
      name: "Resourcesat-2A",
      agency: "ISRO",
      sensor: "LISS-IV optical",
      kind: "optical",
      swath: ["GHT", "PRB", "SHN"],
      passes: [at(0.3)],
      latency: 60,
      accuracyM: 0.05,
      note: "High-resolution optical — but monsoon cloud cover usually makes flood scenes unusable.",
      portal: "NRSC Bhoonidhi",
    },
  ];
}

// ───────────────────────────── dams ─────────────────────────────

export type DamHealth = "satisfactory" | "needs_attention" | "unsatisfactory";
export type RiskLevel = "very_high" | "high" | "moderate" | "low";

export interface DamDef {
  id: string;
  name: string;
  river: string;
  builtYear: number;
  type: string;
  heightM: number;
  capacityMcm: number;
  spillwayCumecs: number;
  lastInspection: string;
  health: DamHealth;
  hazard: "high" | "significant" | "low";
  x: number; // km (map)
  y: number;
  zone: string[]; // downstream neighbourhoods
  startPct: number; // initial reservoir level (% of FRL)
}

export interface DamState {
  id: string;
  reservoirPct: number;
  releaseCumecs: number;
  alert: "normal" | "watch" | "release" | "breach";
}

export const CURRENT_YEAR = 2026;

export const DEFAULT_DAMS: DamDef[] = [
  { id: "D1", name: "Jalnagar Barrage", river: "main river (upstream, west)", builtYear: 1958, type: "Earthen embankment + masonry spillway", heightM: 21, capacityMcm: 182, spillwayCumecs: 9800, lastInspection: "2024-05 (pre-monsoon)", health: "needs_attention", hazard: "high", x: 0.25, y: 3.7, zone: ["GHT", "RLC"], startPct: 86 },
  { id: "D2", name: "Pahadi Nala Dam", river: "Pahadi nala (southern tributary)", builtYear: 1994, type: "Concrete gravity", heightM: 34, capacityMcm: 64, spillwayCumecs: 2600, lastInspection: "2025-04", health: "satisfactory", hazard: "significant", x: 8.9, y: 0.35, zone: ["MCH"], startPct: 72 },
  { id: "D3", name: "Shanti Check Dam", river: "seasonal stream (north)", builtYear: 2011, type: "Masonry check dam", heightM: 9, capacityMcm: 3, spillwayCumecs: 300, lastInspection: "2025-03", health: "satisfactory", hazard: "low", x: 4.4, y: 6.85, zone: ["SHN"], startPct: 60 },
];

export function damAge(d: DamDef): number {
  return CURRENT_YEAR - d.builtYear;
}

/** Explainable dam risk: age + condition + hazard class (each term is shown in the UI). */
export function damRisk(d: DamDef): { score: number; level: RiskLevel; reasons: string[] } {
  const age = damAge(d);
  const reasons: string[] = [];
  let s = 0;
  if (age >= 100) (s += 0.5), reasons.push(`${age} years old (≥100)`);
  else if (age >= 50) (s += 0.35), reasons.push(`${age} years old (≥50 — beyond typical design life)`);
  else if (age >= 25) (s += 0.15), reasons.push(`${age} years old`);
  else (s += 0.05), reasons.push(`${age} years old`);
  if (d.health === "unsatisfactory") (s += 0.35), reasons.push("last inspection: unsatisfactory");
  else if (d.health === "needs_attention") (s += 0.2), reasons.push("last inspection: needs attention");
  if (d.hazard === "high") (s += 0.15), reasons.push("high downstream hazard class");
  else if (d.hazard === "significant") (s += 0.08), reasons.push("significant downstream hazard class");
  const level: RiskLevel = s >= 0.6 ? "very_high" : s >= 0.4 ? "high" : s >= 0.2 ? "moderate" : "low";
  return { score: Math.round(s * 100) / 100, level, reasons };
}

const RANK: Record<RiskLevel, number> = { very_high: 3, high: 2, moderate: 1, low: 0 };

/** Highest dam risk per neighbourhood (dynamic: a release/breach raises the zone to very high). */
export function damZones(dams: DamDef[], states?: Map<string, DamState>): Record<string, RiskLevel> {
  const out: Record<string, RiskLevel> = {};
  for (const d of dams) {
    let lvl = damRisk(d).level;
    const st = states?.get(d.id);
    if (st && (st.alert === "release" || st.alert === "breach")) lvl = "very_high";
    else if (st && st.alert === "watch" && RANK[lvl] < RANK.high) lvl = "high";
    for (const nb of d.zone) if (!out[nb] || RANK[lvl] > RANK[out[nb]]) out[nb] = lvl;
  }
  return out;
}

export function zoneRiskValue(l: RiskLevel | undefined): number {
  return l === "very_high" ? 1 : l === "high" ? 0.7 : l === "moderate" ? 0.3 : 0;
}

export function satellitesFor(s: Scenario): SatelliteDef[] {
  const base = s.satellites ?? defaultSatellites(s.duration);
  return base.map((d) => (s.satPasses?.[d.id] ? { ...d, passes: s.satPasses[d.id] } : d));
}

export function damsFor(s: Scenario): DamDef[] {
  return s.dams ?? DEFAULT_DAMS;
}
