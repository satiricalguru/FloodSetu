import { CONFIG } from "./config";
import type { Need, Urgency, Verification } from "./types";

/**
 * Priority = U × V × N × A × C × E × F  (documented, inspectable — RESEARCH §4.3)
 * The input type deliberately has NO money / donation / campaign / media fields:
 * Section 3 firewall — donation data can never reach dispatch scoring.
 */
export interface PriorityInput {
  urgency: Urgency;
  needs: Need[];
  people: number;
  nbhdVulnerability: number;
  waitTicks: number;
  verification: Verification;
  escalated: boolean;
  /** how far this neighbourhood's mean wait lags the global mean (0 = not lagging) */
  nbhdLag: number;
  /** downstream dam-risk zone value 0..1 (age/condition/hazard of upstream dams; release/breach → 1) */
  damRisk?: number;
  /** citizen device went silent mid-request */
  deviceLost?: boolean;
}

export interface PriorityBreakdown {
  U: number;
  V: number;
  N: number;
  A: number;
  C: number;
  E: number;
  F: number;
  total: number;
}

const VULNERABLE: Need[] = ["elderly", "child", "pregnant", "disabled", "medical", "injured", "in_water"];

export function priority(p: PriorityInput): PriorityBreakdown {
  const U = CONFIG.URGENCY_WEIGHT[p.urgency];
  const V =
    1 +
    0.15 * p.needs.filter((n) => VULNERABLE.includes(n)).length +
    (p.needs.includes("in_water") ? 0.5 : 0) + // person already in the water: seconds matter
    0.3 * p.nbhdVulnerability +
    0.25 * (p.damRisk ?? 0) + // downstream of an old / stressed dam
    (p.deviceLost ? 0.3 : 0); // phone went silent — assume worsening
  const N = 1 + 0.25 * Math.log2(1 + Math.max(1, p.people));
  const A = 1 + p.waitTicks / CONFIG.AGING_TAU;
  // verification never blocks: critical ignores it entirely; others are only re-ordered
  const C = p.urgency === "critical" ? 1 : p.verification === "verified" ? 1 : p.verification === "under_review" ? 0.6 : 0.8;
  const E = p.escalated ? CONFIG.ESCALATION_BOOST : 1;
  const F = 1 + 0.15 * Math.min(1, Math.max(0, p.nbhdLag));
  const total = U * V * N * A * C * E * F;
  return { U, V, N, A, C, E, F, total: Math.round(total * 100) / 100 };
}
