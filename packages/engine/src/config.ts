/** All tunable constants live here so DECISIONS/RESEARCH can point at one file. 1 tick = 1 simulated minute. */
export const CONFIG = {
  // passability (metres)
  GROUND_MAX_DEPTH: 0.5,
  GROUND_SLOW_DEPTH: 0.2,
  BOAT_MIN_DEPTH: 0.4,
  BOAT_FAST_DEPTH: 0.8,
  // speeds (km/h)
  GROUND_SPEED_DRY: 18,
  GROUND_SPEED_WADE: 4,
  GROUND_SPEED_ESCORT: 4.5,
  BOAT_SPEED_RIVER: 14,
  BOAT_SPEED_DEEP: 10,
  BOAT_SPEED_SHALLOW: 5,
  // uncertainty routing
  UNKNOWN_COST_MULT: 2.5,
  CONTESTED_BOAT_MULT: 3,
  // beliefs
  RELIABILITY: { sensor: 0.95, rescuer: 0.9, control_room: 0.85, citizen: 0.65, self: 1 } as Record<string, number>,
  BELIEF_DECAY_TAU: 90,
  OPEN_P: 0.7,
  CLOSED_P: 0.3,
  CONTRADICTION_PRIOR_L: 1.0,
  CONTRADICTION_MIN_STRENGTH: 0.3,
  CONTRADICTION_WINDOW: 60,
  PRIOR_L: 1.5,
  // network
  MSG_LOSS: 0.02,
  HEARTBEAT_TIMEOUT: 5,
  GAUGE_PERIOD: 10,
  GAUGE_NOISE: 0.05,
  // dedup
  DEDUP_RADIUS_KM: 0.12,
  DEDUP_WINDOW: 30,
  DEDUP_PHONE_WINDOW: 60,
  // priority
  URGENCY_WEIGHT: { critical: 10, urgent: 4, needs_help: 1 } as Record<string, number>,
  AGING_TAU: 30,
  MAX_WAIT: { critical: 30, urgent: 90, needs_help: 240 } as Record<string, number>,
  DEADLINE: { critical: 45, urgent: 120, needs_help: 360 } as Record<string, number>,
  ESCALATION_BOOST: 1.5,
  FAIRNESS_TIE: 0.05,
  // negotiation
  MAX_QUEUE: 1, // was 2; with per-tick leveled re-auction, pre-bundling hurt (DECISIONS D27)
  FIRST_WAVE: 12,
  QUEUE_PENALTY: 4,
  PREEMPT_GAIN: 10,
  SKILL_BONUS: 3,
  CAPACITY_SHORTFALL_PENALTY: 2,
  DECOMMIT_PENALTY: 8,
  // central baseline
  CENTRAL_TOP_K: 40,
  CENTRAL_UNSERVED_COST: 180,
  CENTRAL_INCUMBENCY: 0.85,
  // resources
  FUEL_RESERVE: 30,
  REFUEL_TICKS: 15,
  ESCORT_CAPACITY: 6,
  LOAD_BASE: 2,
  WORK_TICKS: { MEDICAL: 8, SUPPLY: 5, VERIFY: 1 } as Record<string, number>,
  STALE_TICKS: 2,
  // world anchor for display only (fictional town)
  ANCHOR_LAT: 25.4,
  ANCHOR_LNG: 85.0,
} as const;

export type Config = typeof CONFIG;
