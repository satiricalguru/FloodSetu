import { fromLatLng, nbhdAt, scoreRisk, W_KM_H, type Need, type SosSpec, type Urgency } from "./deps";
import { z } from "zod";

export const NEEDS = ["elderly", "child", "pregnant", "disabled", "medical", "injured", "pets"] as const;
export const URGENCIES = ["critical", "urgent", "needs_help"] as const;

/** Tiny payload (works on 2G): ~200 bytes JSON. */
export const SosInput = z.object({
  clientId: z.string().min(8).max(64),
  people: z.number().int().min(1).max(500),
  urgency: z.enum(URGENCIES),
  needs: z.array(z.enum(NEEDS)).max(7).default([]),
  text: z.string().max(500).optional(),
  phone: z
    .string()
    .regex(/^\+?\d{10,13}$/)
    .optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy: z.number().optional(),
  nbhd: z.string().max(8).optional(),
  deviceId: z.string().min(4).max(128),
  lang: z.enum(["en", "hi"]).default("en"),
  hasPhoto: z.boolean().optional(),
  hasVoice: z.boolean().optional(),
  createdAt: z.string().optional(),
});
export type SosInput = z.infer<typeof SosInput>;

export type SosStatus = "received" | "verification_pending" | "assigned" | "rescue_in_progress" | "resolved" | "merged" | "needs_attention";
export const LIFECYCLE: SosStatus[] = ["received", "verification_pending", "assigned", "rescue_in_progress", "resolved"];

export interface SosRecord {
  id: string;
  clientId: string;
  createdAt: string;
  status: SosStatus;
  /** pseudonymous; raw phone is never stored */
  phoneHash?: string;
  uid?: string;
  deviceHash: string;
  /** rotating per-request handle shown to other roles */
  handle: string;
  people: number;
  urgency: Urgency;
  needs: Need[];
  text?: string;
  lang: "en" | "hi";
  /** precise location — visible only to assigned team + control room while active; purged after resolution */
  precise?: { lat: number; lng: number; accuracy?: number } | null;
  /** coarse 500 m grid cell for every other view */
  coarse: { lat: number; lng: number } | null;
  sim: { x: number; y: number; nbhd: string; snapped: boolean };
  timeline: { status: SosStatus | string; at: string; note?: string }[];
  risk: { score: number; reasons: string[] };
  assigned?: { unit: string; unitType: "boat" | "ground"; eta: number | null; at: string; position?: { x: number; y: number } };
  incidentId?: string;
  mergedInto?: string;
  resolvedAt?: string;
  injected?: boolean;
}

/** 500 m grid coarsening (location minimisation). */
export function coarsen(lat: number, lng: number): { lat: number; lng: number } {
  const step = 0.0045; // ≈ 500 m
  return { lat: Math.round(lat / step) * step, lng: Math.round(lng / step) * step };
}

/**
 * Map a real GPS fix into the synthetic town. If the fix lies outside Jalnagar (it will for real phones in a demo),
 * snap to the chosen neighbourhood's centre — clearly labelled as a demo snap.
 */
export function placeInSim(input: Pick<SosInput, "lat" | "lng" | "nbhd">, centres: Record<string, { x: number; y: number }>): SosRecord["sim"] {
  if (input.lat !== undefined && input.lng !== undefined) {
    const p = fromLatLng(input.lat, input.lng);
    if (p.x >= 0 && p.x <= W_KM_H.w && p.y >= 0 && p.y <= W_KM_H.h) return { x: p.x, y: p.y, nbhd: nbhdAt(p.x, p.y), snapped: false };
  }
  const nb = input.nbhd && centres[input.nbhd] ? input.nbhd : "GHT";
  const c = centres[nb];
  return { x: c.x, y: c.y, nbhd: nb, snapped: true };
}

export function toSosSpec(r: SosRecord, tick: number): SosSpec {
  return {
    id: r.id,
    tick,
    x: r.sim.x,
    y: r.sim.y,
    nbhd: r.sim.nbhd,
    people: r.people,
    urgency: r.urgency,
    needs: r.needs,
    text: r.text ?? "",
    phone: r.phoneHash ?? r.deviceHash,
    source: "live",
    real: true,
  };
}

/** Explainable risk for a live request — reuses the engine's single scoring function (one source of truth). */
export function liveRisk(r: Pick<SosRecord, "text" | "phoneHash" | "deviceHash" | "sim" | "urgency">, recent: SosRecord[], flags: { otpAbuse?: boolean; gpsMismatch?: boolean }) {
  return scoreRisk(
    { text: r.text ?? "", phone: r.phoneHash ?? r.deviceHash, x: r.sim.x, y: r.sim.y, tick: 0, urgency: r.urgency },
    {
      recent: recent.map((o) => ({ text: o.text ?? "", phone: o.phoneHash ?? o.deviceHash, x: o.sim.x, y: o.sim.y, tick: 0 })),
      depthAtNode: 1,
      areaFlooded: true,
      otpAbuse: flags.otpAbuse,
      gpsMismatch: flags.gpsMismatch,
    },
  );
}

/** SMS / USSD fallback (mocked): "SOS <people> <C|U|H> <landmark…>" */
export function parseSms(body: string): { people: number; urgency: Urgency; landmark: string } | null {
  const m = body.trim().match(/^(sos|bachao)\s+(\d{1,3})\s*([cuh])?\s*(.*)$/i);
  if (!m) return null;
  const u = (m[3] ?? "u").toLowerCase();
  return { people: Math.max(1, Number(m[2])), urgency: u === "c" ? "critical" : u === "h" ? "needs_help" : "urgent", landmark: m[4] ?? "" };
}
