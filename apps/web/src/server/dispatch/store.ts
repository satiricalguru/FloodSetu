import { emptyOtpState, type OtpState, type RefreshStore, type Role, type SosRecord } from "@floodsetu/dispatch";
import type { ChainEntry } from "@floodsetu/shared";
import { fileStore } from "../persist";

export interface FieldEvent {
  seq: number;
  unit: string;
  kind: "ack" | "unable" | "road_blocked" | "bridge_damaged" | "water_level" | "status" | "picked_up" | "dropped" | "device_lost" | "battery_low";
  sos?: string;
  taskId?: string;
  incident?: string;
  reason?: string;
  note?: string;
  count?: number;
  at: string;
  lamport?: number;
  deviceId?: string;
}

export interface User {
  uid: string;
  phoneHash: string;
  phoneMasked: string;
  role: Role;
  unit?: string;
  createdAt: string;
  deviceHashes: string[];
}

export interface DispatchDb {
  sos: SosRecord[];
  field: FieldEvent[];
  fieldSeq: number;
  live: { statuses: Record<string, { incident: string; status: string; verification: string; people: number; reports: number; unit?: string; unitType?: "boat" | "ground"; eta?: number | null; pos?: { x: number; y: number }; mergedWith?: number }>; units: { id: string; type: string; status: string; task: unknown; x: number; y: number; [k: string]: unknown }[]; tick: number; at: string; scenario?: string; strategy?: string } | null;
  otp: OtpState;
  refresh: RefreshStore;
  users: User[];
  audit: ChainEntry[];
  threads: Record<string, { at: string; from: string; role: Role | "system"; text: string; public: boolean }[]>;
  broadcasts: { id: string; at: string; area: string; headline: string; text: string; severity: "Extreme" | "Severe" | "Moderate"; urgency: "Immediate" | "Expected"; certainty: "Observed" | "Likely"; sender: string }[];
  devInbox: { at: string; to: string; text: string }[];
  /** latest river monitoring readings pushed by the control room (see bridge) */
  river?: { stations: RiverStation[]; at: string; tick: number } | null;
  /** last alerting state per gauge / dam, so automatic alerts fire on threshold *changes* only */
  alertState?: Record<string, string>;
}

export interface RiverStation {
  id: string;
  nbhd: string;
  name: string;
  river: string;
  stage: number | null;
  flow: number | null;
  trendCmHr: number;
  status: "normal" | "warning" | "danger" | "extreme" | "no_data";
  warning: number;
  danger: number;
  hfl: number;
  ageMin: number | null;
  history: [number, number][];
}

export const dispatchDb = fileStore<DispatchDb>("dispatch", () => ({
  sos: [],
  field: [],
  fieldSeq: 0,
  live: null,
  otp: emptyOtpState(),
  refresh: { tokens: {}, revokedFamilies: [] },
  users: [],
  audit: [],
  threads: {},
  broadcasts: [],
  devInbox: [],
}));
