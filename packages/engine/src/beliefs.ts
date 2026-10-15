import { CONFIG } from "./config";
import type { BeliefStore, EdgeBelief, Source } from "./types";

/**
 * Reliability-weighted log-odds fusion with decay (RESEARCH §4.4).
 * L = log-odds that an edge is structurally OPEN. Unreported edges sit at the pre-flood survey prior.
 * Evidence decays toward the prior with time constant τ; contradictions flag the edge "contested".
 */
export type EdgeStatus = "open" | "closed" | "unknown" | "contested";

export function newBeliefs(levels: Record<string, number>): BeliefStore {
  const level = new Map<string, { level: number; t: number }>();
  for (const [k, v] of Object.entries(levels)) level.set(k, { level: v, t: 0 });
  return { edges: new Map(), level };
}

const logit = (p: number) => Math.log(p / (1 - p));
export const pOpen = (L: number) => 1 / (1 + Math.exp(-L));

export function effectiveL(b: EdgeBelief | undefined, now: number): number {
  if (!b) return CONFIG.PRIOR_L;
  const dt = Math.max(0, now - b.t);
  return CONFIG.PRIOR_L + (b.L - CONFIG.PRIOR_L) * Math.exp(-dt / CONFIG.BELIEF_DECAY_TAU);
}

export function edgeStatus(store: BeliefStore, edgeId: string, now: number): EdgeStatus {
  const b = store.edges.get(edgeId);
  if (b?.contested) return "contested";
  const p = pOpen(effectiveL(b, now));
  if (p >= CONFIG.OPEN_P) return "open";
  if (p <= CONFIG.CLOSED_P) return "closed";
  return "unknown";
}

export interface ReportInput {
  claim: "open" | "closed";
  confidence: number;
  source: Source;
  by?: string;
}

export interface FusionResult {
  before: number;
  after: number;
  contradiction: boolean;
  resolved: boolean;
  statusBefore: EdgeStatus;
  statusAfter: EdgeStatus;
}

export function applyReport(store: BeliefStore, edgeId: string, r: ReportInput, now: number): FusionResult {
  const prev = store.edges.get(edgeId);
  const statusBefore = edgeStatus(store, edgeId, now);
  const before = effectiveL(prev, now);
  const rel = CONFIG.RELIABILITY[r.source] ?? 0.5;
  const strength = Math.min(0.98, rel * r.confidence);
  const sign = r.claim === "open" ? 1 : -1;
  const direct = (r.source === "self" || r.source === "rescuer" || r.source === "sensor") && r.confidence >= 0.95;

  let contested = prev?.contested ?? false;
  let contestedSince = prev?.contestedSince;
  let contradiction = false;
  let resolved = false;
  let L: number;

  if (direct) {
    // direct observation by a trusted party resolves any contest
    if (contested) resolved = true;
    contested = false;
    contestedSince = undefined;
    L = sign * 4;
  } else {
    const hasEvidence = !!prev && prev.sources.length > 0;
    const recent = hasEvidence && now - prev!.t <= CONFIG.CONTRADICTION_WINDOW;
    // a contradiction = a sufficiently strong report opposing recent, confident evidence (not the survey prior)
    const opposing = Math.sign(before) !== sign;
    if (!contested && hasEvidence && recent && opposing && Math.abs(before) >= CONFIG.CONTRADICTION_PRIOR_L && strength >= CONFIG.CONTRADICTION_MIN_STRENGTH) {
      contradiction = true;
      contested = true;
      contestedSince = now;
    }
    L = before + sign * logit(0.5 + strength / 2);
  }

  const sources = [...(prev?.sources ?? []), { source: r.source, claim: r.claim, confidence: r.confidence, tick: now, by: r.by }].slice(-6);
  store.edges.set(edgeId, { L, t: now, contested, contestedSince, sources });
  return { before, after: L, contradiction, resolved, statusBefore, statusAfter: edgeStatus(store, edgeId, now) };
}

/** Agent's own direct observation (no fusion needed). Returns true if it changed the agent's status for the edge. */
export function observeEdge(store: BeliefStore, edgeId: string, open: boolean, now: number, by: string): boolean {
  const before = edgeStatus(store, edgeId, now);
  const prev = store.edges.get(edgeId);
  // avoid churning the map for repeat confirmations of the prior
  if (open && !prev) return false;
  store.edges.set(edgeId, {
    L: open ? 4 : -4,
    t: now,
    contested: false,
    sources: [...(prev?.sources ?? []), { source: "self" as Source, claim: open ? ("open" as const) : ("closed" as const), confidence: 1, tick: now, by }].slice(-6),
  });
  return before !== (open ? "open" : "closed");
}

/** Last-writer-wins merge by timestamp (COP broadcast → agent). */
export function mergeBeliefs(target: BeliefStore, src: BeliefStore) {
  for (const [k, v] of src.edges) {
    const t = target.edges.get(k);
    if (!t || v.t > t.t || (v.t === t.t && v.contested !== t.contested)) target.edges.set(k, v);
  }
  for (const [k, v] of src.level) {
    const t = target.level.get(k);
    if (!t || v.t > t.t) target.level.set(k, v);
  }
}

export function cloneBeliefs(b: BeliefStore): BeliefStore {
  return { edges: new Map(b.edges), level: new Map(b.level) };
}
