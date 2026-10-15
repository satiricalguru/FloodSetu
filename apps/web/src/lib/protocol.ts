import type { CascadeEntry, Frame, InjectEvent, RunMetrics, ScenarioEvent, SimEvent, StrategyName, WhyExplanation } from "@floodsetu/engine";

export interface WorldGeom {
  nodes: { id: number; x: number; y: number; kind: string; nbhd: string; elev: number; label?: string }[];
  edges: { id: string; a: number; b: number; kind: string; label?: string; sensor?: boolean; nbhd: string }[];
  nbhds: { id: string; name: string; nameHi: string; cx: number; cy: number; population: number; vulnerability: number; note: string }[];
  shelters: { id: string; name: string; node: number; capacity: number; medical: boolean; nbhd: string }[];
  ghats: number[];
  bridges: string[];
  river: [number, number][];
  bounds: { w: number; h: number };
}

export type ToWorker =
  | { type: "init"; scenarioId: string; strategy: StrategyName; seed?: number; extraEvents?: ScenarioEvent[] }
  | { type: "play" }
  | { type: "pause" }
  | { type: "step"; n?: number }
  | { type: "speed"; value: number }
  | { type: "inject"; event: InjectEvent }
  | { type: "explain"; taskId?: string; incidentId?: string; reqId: number }
  | { type: "seek"; tick: number | null }
  | { type: "compare"; seeds: number; reqId: number }
  | { type: "runTo"; tick: number };

export interface LiveSosStatus {
  incident: string;
  status: string;
  verification: string;
  people: number;
  reports: number;
  unit?: string;
  unitType?: "boat" | "ground";
  eta?: number | null;
  pos?: { x: number; y: number };
  mergedWith?: number;
}

export type FromWorker =
  | { type: "world"; world: WorldGeom; scenario: { id: string; name: string; description: string; duration: number; seed: number }; strategy: StrategyName }
  | { type: "frame"; frame: Frame; events: SimEvent[]; cascades: CascadeEntry[]; contradictions: unknown[]; maxTick: number; playing: boolean; done: boolean; live: Record<string, LiveSosStatus>; units: unknown[]; areas: unknown[]; series: { tick: number; openSos: number; critical: number; p90: number; idlePct: number; violations: number; fairness: number; rescued: number }[]; metrics?: RunMetrics }
  | { type: "replayFrame"; frame: Frame }
  | { type: "explain"; reqId: number; why: WhyExplanation | null; incident?: unknown }
  | { type: "compare"; reqId: number; progress?: number; results?: RunMetrics[] }
  | { type: "error"; message: string };
