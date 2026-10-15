import { CONFIG } from "./config";
import type { Incident, Report } from "./types";

/**
 * Duplicate SOS handling (RESEARCH §4.8). Reports MERGE into incident clusters — never rejected.
 * Linkage: same building, OR same phone within 60 min (≤1 km), OR ≤120 m and ≤30 min apart.
 * Text similarity only *supports* household grouping; it never creates a link on its own.
 */

const TRANSLIT: [RegExp, string][] = [
  [/paani|pani|paanee/g, "water"],
  [/ghar/g, "house"],
  [/chhat|chat|chhath/g, "roof"],
  [/bachao|bachaao/g, "help"],
  [/madad/g, "help"],
  [/log/g, "people"],
  [/baccha|bachche|bacche/g, "child"],
  [/buzurg|budhe/g, "elderly"],
];

export function normaliseText(s: string): string {
  let t = s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  for (const [re, rep] of TRANSLIT) t = t.replace(re, rep);
  return t.replace(/\s+/g, " ").trim();
}

function trigrams(s: string): Set<string> {
  const t = ` ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

export function textSimilarity(a: string, b: string): number {
  const A = trigrams(normaliseText(a));
  const B = trigrams(normaliseText(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface LinkResult {
  incident: Incident;
  why: string;
}

export function findCluster(active: Iterable<Incident>, r: Report): LinkResult | null {
  // strongest link wins: same building > same phone > proximity; then nearest
  let best: LinkResult | null = null;
  let bestKey = Infinity;
  for (const inc of active) {
    for (const rep of inc.reports) {
      const d = Math.hypot(rep.x - r.x, rep.y - r.y);
      const dt = Math.abs(rep.tick - r.tick);
      let why: string | null = null;
      let rank = 3;
      if (r.building && rep.building === r.building) (why = `same building ${r.building}`), (rank = 0);
      else if (r.phone && rep.phone === r.phone && dt <= CONFIG.DEDUP_PHONE_WINDOW && d <= 1) (why = "same phone within 60 min"), (rank = 1);
      else if (d <= CONFIG.DEDUP_RADIUS_KM && dt <= CONFIG.DEDUP_WINDOW) (why = `${Math.round(d * 1000)} m / ${dt} min apart`), (rank = 2);
      const key = rank * 100 + d;
      if (why && key < bestKey) {
        bestKey = key;
        best = { incident: inc, why };
      }
    }
  }
  return best;
}

/** People estimate: group reports into households (same phone, or near-identical text + count), sum per-household max. */
export function estimatePeople(reports: Report[]): { estimate: number; range: [number, number]; households: number } {
  const parent = reports.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < reports.length; i++) {
    for (let j = i + 1; j < reports.length; j++) {
      const a = reports[i];
      const b = reports[j];
      const samePhone = !!a.phone && a.phone === b.phone;
      const sameText = Math.abs(a.people - b.people) <= 1 && textSimilarity(a.text, b.text) >= 0.8;
      if (samePhone || sameText) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number>();
  for (let i = 0; i < reports.length; i++) {
    const g = find(i);
    groups.set(g, Math.max(groups.get(g) ?? 0, reports[i].people));
  }
  let estimate = 0;
  for (const v of groups.values()) estimate += v;
  const max = Math.max(...reports.map((r) => r.people));
  const sum = reports.reduce((s, r) => s + r.people, 0);
  return { estimate, range: [max, sum], households: groups.size };
}
