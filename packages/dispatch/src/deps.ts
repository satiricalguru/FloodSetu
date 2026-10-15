// The dispatch module depends on the rescue engine (one source of truth for scoring/dedup) — NEVER on relief.
export { fromLatLng, nbhdAt, scoreRisk, W_KM, H_KM, type Need, type SosSpec, type Urgency } from "@floodsetu/engine";
import { H_KM, W_KM } from "@floodsetu/engine";
export const W_KM_H = { w: W_KM, h: H_KM };
