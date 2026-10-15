"use client";
import type { CascadeEntry, Frame, RunMetrics, SimEvent, StrategyName, WhyExplanation } from "@floodsetu/engine";
import { create } from "zustand";
import type { FromWorker, LiveSosStatus, ToWorker, WorldGeom } from "@/lib/protocol";

export type View = "live" | "incidents" | "agents" | "shelters" | "verification" | "scenarios" | "compare" | "replay" | "audit";
export type Selection = { kind: "incident" | "agent" | "shelter" | "edge" | "nbhd" | "dam"; id: string } | null;

export interface Layers {
  floodProne: boolean;
  floodExtent: boolean;
  areaStatus: boolean;
  sos: boolean;
  agents: boolean;
  shelters: boolean;
  edges: boolean;
  routes: boolean;
  heatmap: boolean;
  truth: boolean;
  labels: boolean;
  damZones: boolean;
  satFlood: boolean;
}

export interface UnitCard {
  id: string;
  name: string;
  type: "boat" | "ground";
  status: string;
  onboard: number;
  capacity: number;
  fuel: number | null;
  fuelMax: number | null;
  skills: string[];
  connected: boolean;
  x: number;
  y: number;
  queue: number;
  task: null | { id: string; kind: string; incident?: string; people: number; urgency: string; needs: string[]; phase: string; eta: number | null; site: { x: number; y: number }; shelter?: { id: string; name: string }; why?: string; sos: string[] };
}

type Series = { tick: number; openSos: number; critical: number; p90: number; idlePct: number; violations: number; fairness: number; rescued: number }[];

interface State {
  worker: Worker | null;
  world: WorldGeom | null;
  scenario: { id: string; name: string; description: string; duration: number; seed: number } | null;
  strategy: StrategyName;
  frame: Frame | null;
  liveFrame: Frame | null;
  replayTick: number | null;
  maxTick: number;
  playing: boolean;
  done: boolean;
  speed: number;
  events: SimEvent[];
  cascades: CascadeEntry[];
  contradictions: { id: string; edge: string; tick: number; sources: { source: string; claim: string; confidence: number; tick: number }[]; resolvedTick?: number; resolvedAs?: string; wastedTrips: number; churn: number; lastImpactTick: number }[];
  live: Record<string, LiveSosStatus>;
  units: UnitCard[];
  areas: unknown[];
  series: Series;
  metrics: RunMetrics | null;
  view: View;
  selection: Selection;
  layers: Layers;
  why: { why: WhyExplanation | null; incident?: unknown } | null;
  whyOpen: boolean;
  cascadeOpen: CascadeEntry | null;
  compare: { progress: number; results: RunMetrics[] | null } | null;
  error: string | null;
  bridge: { online: boolean; lastSync: number | null; injected: number };
  paletteOpen: boolean;
  set: (p: Partial<State>) => void;
  send: (m: ToWorker) => void;
  select: (s: Selection) => void;
  toggleLayer: (k: keyof Layers) => void;
}

let reqId = 1;
export const nextReq = () => reqId++;

export const useControl = create<State>((set, get) => ({
  worker: null,
  world: null,
  scenario: null,
  strategy: "cnp",
  frame: null,
  liveFrame: null,
  replayTick: null,
  maxTick: 0,
  playing: false,
  done: false,
  speed: 5,
  events: [],
  cascades: [],
  contradictions: [],
  live: {},
  units: [],
  areas: [],
  series: [],
  metrics: null,
  view: "live",
  selection: null,
  layers: { floodProne: false, floodExtent: true, areaStatus: true, sos: true, agents: true, shelters: true, edges: true, routes: true, heatmap: false, truth: false, labels: true, damZones: true, satFlood: true },
  why: null,
  whyOpen: false,
  cascadeOpen: null,
  compare: null,
  error: null,
  bridge: { online: false, lastSync: null, injected: 0 },
  paletteOpen: false,
  set: (p) => set(p),
  send: (m) => get().worker?.postMessage(m),
  select: (s) => set({ selection: s }),
  toggleLayer: (k) => set({ layers: { ...get().layers, [k]: !get().layers[k] } }),
}));

const SEEN_CASCADE = new Set<string>();

export function handleWorkerMessage(m: FromWorker) {
  const st = useControl.getState();
  switch (m.type) {
    case "world":
      SEEN_CASCADE.clear();
      st.set({ world: m.world, scenario: m.scenario, strategy: m.strategy, events: [], cascades: [], frame: null, liveFrame: null, replayTick: null, metrics: null, done: false, selection: null, cascadeOpen: null });
      break;
    case "frame": {
      const events = m.events.length ? [...st.events, ...m.events].slice(-4000) : st.events;
      // auto-open the cascade panel on a multi-cause shock (the triple failure)
      let cascadeOpen = st.cascadeOpen;
      for (const c of m.cascades) {
        const key = `${c.tick}|${c.causes.length}`;
        if (c.causes.length >= 3 && !SEEN_CASCADE.has(key)) {
          SEEN_CASCADE.add(key);
          cascadeOpen = c;
        }
        if (cascadeOpen && cascadeOpen.tick === c.tick) cascadeOpen = c;
      }
      st.set({
        liveFrame: m.frame,
        frame: st.replayTick === null ? m.frame : st.frame,
        events,
        cascades: m.cascades,
        contradictions: m.contradictions as State["contradictions"],
        maxTick: m.maxTick,
        playing: m.playing,
        done: m.done,
        live: m.live,
        units: m.units as UnitCard[],
        areas: m.areas,
        series: m.series,
        metrics: m.metrics ?? st.metrics,
        cascadeOpen,
      });
      break;
    }
    case "replayFrame":
      st.set({ frame: m.frame });
      break;
    case "explain":
      st.set({ why: { why: m.why, incident: m.incident }, whyOpen: true });
      break;
    case "compare":
      st.set({ compare: { progress: m.progress ?? 1, results: m.results ?? st.compare?.results ?? null } });
      break;
    case "error":
      console.error(m.message);
      st.set({ error: m.message });
      break;
  }
}
