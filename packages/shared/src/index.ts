import { sha256 } from "./sha256";

export { sha256, hmac, sha256Bytes } from "./sha256";

// ───────────────────────── Tamper-evident hash chain (audit log + relief ledger) ─────────────────────────

export interface ChainEntry<T = Record<string, unknown>> {
  seq: number;
  at: string; // ISO time
  type: string;
  actor: string;
  data: T;
  prev: string;
  hash: string;
}

export const GENESIS = "0".repeat(64);

function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}

export function entryHash(e: Omit<ChainEntry, "hash">): string {
  return sha256(`${e.seq}|${e.at}|${e.type}|${e.actor}|${canonical(e.data)}|${e.prev}`);
}

export function appendEntry<T extends Record<string, unknown>>(chain: ChainEntry<T>[], type: string, actor: string, data: T, at = new Date().toISOString()): ChainEntry<T> {
  const prev = chain.length ? chain[chain.length - 1].hash : GENESIS;
  const base = { seq: chain.length, at, type, actor, data, prev };
  const e = { ...base, hash: entryHash(base) };
  chain.push(e);
  return e;
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  brokenAt?: number;
  reason?: string;
  head: string;
}

/** Recompute every link; any edit/insert/delete breaks the chain at that point. */
export function verifyChain(chain: ChainEntry[]): ChainVerification {
  let prev = GENESIS;
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i];
    if (e.seq !== i) return { ok: false, checked: i, brokenAt: i, reason: `sequence gap at ${i}`, head: prev };
    if (e.prev !== prev) return { ok: false, checked: i, brokenAt: i, reason: `entry ${i} does not link to previous hash`, head: prev };
    const h = entryHash({ seq: e.seq, at: e.at, type: e.type, actor: e.actor, data: e.data, prev: e.prev });
    if (h !== e.hash) return { ok: false, checked: i, brokenAt: i, reason: `entry ${i} content was modified`, head: prev };
    prev = e.hash;
  }
  return { ok: true, checked: chain.length, head: prev };
}

// ───────────────────────── The ONE cross-module contract: rescue → relief ─────────────────────────
/**
 * Aggregated, anonymised affected-area summary. Produced by dispatch, consumed by relief. Flow is one-way.
 * Neighbourhood granularity only; counts below K_ANON are suppressed (reported as "<5").
 */
export const K_ANON = 5;

export interface AffectedAreaSummary {
  areaId: string;
  areaName: string;
  status: "normal" | "at_risk" | "flooded" | "verification_pending";
  verifiedIncidents: number | "<5";
  peopleAffected: number | "<5";
  peopleSheltered: number | "<5";
  needs: { water: number; food: number; medical: number; shelterKits: number };
  updatedAt: string;
}

export function suppress(n: number): number | "<5" {
  return n > 0 && n < K_ANON ? "<5" : n;
}

export const LANGS = ["en", "hi"] as const;
export type Lang = (typeof LANGS)[number];
