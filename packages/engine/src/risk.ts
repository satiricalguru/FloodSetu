import { textSimilarity } from "./dedup";
import type { Report } from "./types";

/**
 * Explainable risk score for a request (Section 12.2). Output only ROUTES to a review queue —
 * it never blocks or delays a critical rescue (invariant 7). Many SOS from one area is NOT a feature.
 * score = 1 − Π(1 − wᵢ) over triggered features.
 */
export interface RiskFeatures {
  /** other reports seen in the last 15 min */
  recent: Pick<Report, "text" | "phone" | "x" | "y" | "tick">[];
  /** COP water depth at the reported location (m) */
  depthAtNode: number;
  areaFlooded: boolean;
  gpsMismatch?: boolean;
  /** previous report by same phone */
  lastByPhone?: Pick<Report, "x" | "y" | "tick">;
  otpAbuse?: boolean;
}

export const RISK_WEIGHTS = {
  identical_text_burst: 0.45,
  impossible_travel: 0.4,
  no_flood_signal: 0.35,
  otp_abuse: 0.3,
  gps_mismatch: 0.25,
} as const;

export function scoreRisk(r: Pick<Report, "text" | "phone" | "x" | "y" | "tick" | "urgency">, f: RiskFeatures): { score: number; reasons: string[] } {
  const hits: (keyof typeof RISK_WEIGHTS)[] = [];
  const reasons: string[] = [];

  if (r.text && r.text.length > 12) {
    const twins = f.recent.filter(
      (o) => o.phone !== r.phone && Math.abs(o.tick - r.tick) <= 15 && textSimilarity(o.text, r.text) >= 0.9 && Math.hypot(o.x - r.x, o.y - r.y) > 1,
    );
    if (twins.length >= 3) {
      hits.push("identical_text_burst");
      reasons.push(`identical text from ${twins.length} other phones >1 km apart`);
    }
  }
  if (f.lastByPhone) {
    const dt = Math.max(1, r.tick - f.lastByPhone.tick);
    const kmh = (Math.hypot(r.x - f.lastByPhone.x, r.y - f.lastByPhone.y) / dt) * 60;
    if (kmh > 60) {
      hits.push("impossible_travel");
      reasons.push(`same phone moved at ${Math.round(kmh)} km/h`);
    }
  }
  if (!f.areaFlooded && f.depthAtNode < 0.05 && r.urgency !== "needs_help") {
    hits.push("no_flood_signal");
    reasons.push("no flood signal at location (gauges + field reports)");
  }
  if (f.otpAbuse) {
    hits.push("otp_abuse");
    reasons.push("device flagged for OTP abuse");
  }
  if (f.gpsMismatch) {
    hits.push("gps_mismatch");
    reasons.push("GPS differs from claimed area (supporting signal only)");
  }
  let keep = 1;
  for (const h of hits) keep *= 1 - RISK_WEIGHTS[h];
  return { score: Math.round((1 - keep) * 100) / 100, reasons };
}
