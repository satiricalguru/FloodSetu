"use client";
import { toSosSpec, type SosRecord } from "@floodsetu/dispatch";
import type { StrategyName } from "@floodsetu/engine";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, cx, Icon } from "@/components/ui";
import type { FromWorker } from "@/lib/protocol";
import { BottomDock, LeftRail, TopBar } from "./Chrome";
import { MapCanvas } from "./MapCanvas";
import { CascadeList, CascadePanel, Feed, LayerPanel, Legend, SelectionPanel, WhyDrawer } from "./Panels";
import { handleWorkerMessage, useControl } from "./store";
import { AgentsView, AuditView, CommandPalette, CompareView, IncidentsView, ReplaySummary, ScenariosView, SheltersView, VerificationView } from "./Views";

interface FieldEvent {
  seq: number;
  unit: string;
  kind: "ack" | "unable" | "road_blocked" | "bridge_damaged" | "water_level" | "status" | "picked_up" | "dropped";
  taskId?: string;
  incident?: string;
  reason?: string;
  note?: string;
  at: string;
}

export default function ControlRoom() {
  const st = useControl();
  const { world, frame, layers, selection, select, view, set, send, error } = st;
  const [rightTab, setRightTab] = useState<"feed" | "cascades" | "layers">("feed");
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: "safe" | "warn" | "info" }[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const toast = useCallback((text: string, tone: "safe" | "warn" | "info" = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  // ── engine in a Web Worker ──
  useEffect(() => {
    const w = new Worker(new URL("../../workers/sim.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<FromWorker>) => handleWorkerMessage(e.data);
    set({ worker: w });
    const params = new URLSearchParams(location.search);
    const scenarioId = params.get("scenario") ?? "baseline-monsoon";
    const strategy = (params.get("strategy") as StrategyName) ?? "cnp";
    w.postMessage({ type: "init", scenarioId, strategy });
    w.postMessage({ type: "speed", value: 5 });
    if (params.get("autoplay") !== "0") w.postMessage({ type: "play" });
    return () => w.terminate();
  }, [set]);

  const load = useCallback(
    (id: string, strategy: StrategyName, seed?: number) => {
      send({ type: "pause" });
      send({ type: "init", scenarioId: id, strategy, seed });
      send({ type: "speed", value: useControl.getState().speed });
      send({ type: "play" });
      set({ view: "live", compare: null });
      history.replaceState(null, "", `/control?scenario=${id}&strategy=${strategy}`);
    },
    [send, set],
  );

  // operator session (dev/demo mode signs in automatically; production requires OTP at /login)
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((me: { role?: string }) => {
        if (me.role === "operator" || me.role === "admin") return;
        return fetch("/api/auth/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "operator" }) });
      })
      .catch(() => {});
  }, []);

  // ── live bridge: real phones ↔ this control room (2 s polling, see DECISIONS D8/D19) ──
  const fieldSeq = useRef(0);
  const acked = useRef(new Set<string>());
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const s = useControl.getState();
      if (!s.frame) return;
      try {
        const res = await fetch("/api/dispatch/bridge", {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf": csrf() },
          body: JSON.stringify({ fieldSince: fieldSeq.current, tick: s.liveFrame?.tick ?? 0, statuses: s.live, units: s.units, scenario: s.scenario?.id, strategy: s.strategy, areas: s.areas }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { sos: SosRecord[]; field: FieldEvent[] };
        for (const r of data.sos) {
          if (acked.current.has(r.id)) continue;
          acked.current.add(r.id);
          s.send({ type: "inject", event: { type: "SOS", sos: toSosSpec(r, s.liveFrame?.tick ?? 0) } });
          toast(`Live SOS ${r.id}: ${r.people} people · ${r.urgency.replace("_", " ")} → injected into simulation${r.sim.snapped ? " (location snapped to " + r.sim.nbhd + ")" : ""}`, "warn");
        }
        for (const f of data.field) {
          fieldSeq.current = Math.max(fieldSeq.current, f.seq);
          applyField(f, toast);
        }
        if (alive) s.set({ bridge: { online: true, lastSync: Date.now(), injected: acked.current.size } });
      } catch {
        if (alive) useControl.getState().set({ bridge: { ...useControl.getState().bridge, online: false } });
      }
    };
    const i = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, [toast]);

  // ── keyboard ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || useControl.getState().paletteOpen) return;
      const s = useControl.getState();
      if (e.code === "Space") {
        e.preventDefault();
        s.send({ type: s.playing ? "pause" : "play" });
      } else if (e.key === ".") s.send({ type: "step" });
      else if (e.key === "Escape") s.set({ whyOpen: false, cascadeOpen: null, selection: null });
      else if (/^[1-9]$/.test(e.key)) s.set({ view: (["live", "incidents", "agents", "shelters", "verification", "scenarios", "compare", "replay", "audit"] as const)[Number(e.key) - 1] });
      else if (e.key === "t" && !e.metaKey) s.send({ type: "inject", event: { type: "TRIPLE_FAILURE", bridge: "auto", agent: "auto", shelter: "auto", walkIns: 60 } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const mapView = view === "live" || view === "replay";
  return (
    <div className="flex h-dvh overflow-hidden bg-bg text-text">
      <LeftRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex min-h-0 flex-1">
          <section className={cx("relative min-w-0 flex-1", !mapView && "p-3")} aria-label="Main view">
            {mapView ? (
              world ? (
                <>
                  <MapCanvas world={world} frame={frame} layers={layers} selection={selection} onSelect={select} focus={focus} />
                  <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
                    <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-[rgba(8,11,15,0.8)] p-1 shadow-[inset_0_0_0_1px_var(--hairline)]">
                      <Icon name="search" size={14} className="ml-2 text-mute" />
                      <select aria-label="Focus neighbourhood" value={focus ?? ""} onChange={(e) => setFocus(e.target.value || null)} className="h-7 bg-transparent pr-2 font-mono text-[11px] text-hi outline-none">
                        <option value="">Focus neighbourhood…</option>
                        {world.nbhds.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                      </select>
                    </div>
                    {frame?.blackout.length ? <Badge tone="verify" icon="wifiOff">Blackout: {frame.blackout.join(", ")} — showing last-known state</Badge> : null}
                    {layers.truth ? <Badge tone="warn" icon="eye">Ground-truth view (debug) — agents do NOT see this</Badge> : null}
                    {view === "replay" ? <Badge tone="verify" icon="history">After-action replay</Badge> : null}
                  </div>
                  <div className="absolute bottom-3 left-3 max-w-[70%]"><Legend /></div>
                  <div className="pointer-events-none absolute right-3 top-3 text-right font-mono text-[10px] leading-relaxed text-dim">
                    JALNAGAR (FICTIONAL) · 25.40°N 85.00°E SYNTHETIC GRID
                    <br />
                    10 × 7 KM · 279 NODES · 496 EDGES
                  </div>
                </>
              ) : (
                <div className="grid h-full place-items-center">
                  <div className="text-center">
                    <div className="skeleton mx-auto mb-3 h-2 w-48" />
                    <p className="mono text-[12px] text-mute">Booting @floodsetu/engine in a Web Worker…</p>
                  </div>
                </div>
              )
            ) : view === "incidents" ? (
              <IncidentsView />
            ) : view === "agents" ? (
              <AgentsView />
            ) : view === "shelters" ? (
              <SheltersView />
            ) : view === "verification" ? (
              <VerificationView />
            ) : view === "scenarios" ? (
              <ScenariosView onPick={load} />
            ) : view === "compare" ? (
              <CompareView />
            ) : (
              <AuditView />
            )}
            {error ? (
              <div className="absolute inset-x-3 bottom-3 rounded-[8px] bg-[var(--sos-dim)] p-3 text-[12px] text-hi shadow-[inset_0_0_0_1px_var(--sos)]">
                <b>Engine error</b> — {error.split("\n")[0]} <Button size="sm" variant="quiet" onClick={() => set({ error: null })}>Dismiss</Button>
              </div>
            ) : null}
          </section>
          <aside className="flex w-[340px] shrink-0 flex-col border-l border-line bg-panel xl:w-[380px]" aria-label="Context panel">
            {selection ? (
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
                <SelectionPanel />
              </div>
            ) : view === "replay" ? (
              <ReplaySummary />
            ) : (
              <>
                <div className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-2">
                  {(["feed", "cascades", "layers"] as const).map((t) => (
                    <button key={t} onClick={() => setRightTab(t)} className={cx("rounded-full px-2.5 py-0.5 font-mono text-[11px] capitalize", rightTab === t ? "bg-hover text-hi" : "text-mute hover:text-hi")}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="min-h-0 flex-1">
                  {rightTab === "feed" ? <Feed /> : rightTab === "cascades" ? <div className="scroll-thin h-full overflow-y-auto"><CascadeList /><p className="px-3 py-2 text-[11.5px] text-mute">Any closure, failure or overflow opens a cascade: what was cancelled (reason code), who was re-assigned (bids), and how long recovery took. Press <b className="text-hi">T</b> for a triple failure.</p></div> : <LayerPanel />}
                </div>
              </>
            )}
          </aside>
        </main>
        <BottomDock />
      </div>
      <WhyDrawer />
      <CascadePanel />
      <CommandPalette onPick={load} />
      <div className="pointer-events-none fixed bottom-24 right-4 z-40 flex w-[360px] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx("rounded-[10px] bg-[rgba(18,24,33,0.96)] px-3 py-2.5 text-[12px] text-hi", t.tone === "warn" ? "shadow-[inset_3px_0_0_var(--sos),inset_0_0_0_1px_var(--hairline)]" : t.tone === "safe" ? "shadow-[inset_3px_0_0_var(--safe),inset_0_0_0_1px_var(--hairline)]" : "shadow-[inset_3px_0_0_var(--info),inset_0_0_0_1px_var(--hairline)]")}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function csrf(): string {
  return document.cookie.match(/(?:^|; )js_csrf=([^;]+)/)?.[1] ?? "";
}

function nearestEdge(kind: "road" | "bridge", x: number, y: number): string | null {
  const w = useControl.getState().world;
  if (!w) return null;
  let best: string | null = null;
  let bd = Infinity;
  for (const e of w.edges) {
    if (e.kind !== kind) continue;
    const a = w.nodes[e.a];
    const b = w.nodes[e.b];
    const d = Math.hypot((a.x + b.x) / 2 - x, (a.y + b.y) / 2 - y);
    if (d < bd) {
      bd = d;
      best = e.id;
    }
  }
  return best;
}

function applyField(f: FieldEvent, toast: (t: string, tone?: "safe" | "warn" | "info") => void) {
  const s = useControl.getState();
  const unit = s.units.find((u) => u.id === f.unit);
  switch (f.kind) {
    case "ack":
      toast(`${f.unit} crew acknowledged ${f.incident ?? f.taskId ?? "assignment"} on their phone`, "safe");
      break;
    case "unable":
      if (f.taskId) s.send({ type: "inject", event: { type: "CONTROL_OVERRIDE", action: "veto", task: f.taskId, agent: f.unit, reason: `crew reported unable: ${f.reason ?? "unspecified"}` } });
      toast(`${f.unit} UNABLE (${f.reason}) → commitment vetoed, task re-auctioned`, "warn");
      break;
    case "road_blocked": {
      const e = unit ? nearestEdge("road", unit.x, unit.y) : null;
      if (e) {
        s.send({ type: "inject", event: { type: "EDGE_CLOSE", edge: e, announce: null } });
        s.send({ type: "inject", event: { type: "REPORT", edge: e, claim: "closed", source: "rescuer", confidence: 1, note: `field report from ${f.unit}` } });
      }
      toast(`${f.unit} field report: road blocked (${e}) → belief updated, routes re-planned`, "warn");
      break;
    }
    case "bridge_damaged": {
      const e = unit ? nearestEdge("bridge", unit.x, unit.y) : null;
      if (e) s.send({ type: "inject", event: { type: "BRIDGE_COLLAPSE", edge: e } });
      if (e) s.send({ type: "inject", event: { type: "REPORT", edge: e, claim: "closed", source: "rescuer", confidence: 1 } });
      toast(`${f.unit} field report: bridge ${e} damaged → closed`, "warn");
      break;
    }
    default:
      toast(`${f.unit}: ${f.kind.replace("_", " ")}${f.note ? ` — ${f.note}` : ""}`, "info");
  }
}
