"use client";
import { clock, INVARIANTS, type InjectEvent } from "@floodsetu/engine";
import { useEffect, useState } from "react";
import { Badge, Button, cx, Icon, Kbd, Segmented, Sparkline } from "@/components/ui";
import { nextReq, useControl, type View } from "./store";

const NAV: { id: View; label: string; icon: string; key: string }[] = [
  { id: "live", label: "Live Ops", icon: "map", key: "1" },
  { id: "incidents", label: "Incidents", icon: "siren", key: "2" },
  { id: "agents", label: "Agents", icon: "boat", key: "3" },
  { id: "shelters", label: "Shelters", icon: "shelter", key: "4" },
  { id: "verification", label: "Verification", icon: "shield", key: "5" },
  { id: "scenarios", label: "Scenarios", icon: "layers", key: "6" },
  { id: "compare", label: "Compare", icon: "compare", key: "7" },
  { id: "replay", label: "Replay", icon: "history", key: "8" },
  { id: "audit", label: "Audit", icon: "ledger", key: "9" },
];

export function LeftRail() {
  const { view, set, frame, contradictions } = useControl();
  const reviewCount = (frame?.incidents.filter((i) => i.verification === "under_review" || i.escalated).length ?? 0) + contradictions.filter((c) => c.resolvedTick === undefined).length;
  return (
    <nav aria-label="Control room sections" className="flex w-[64px] shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-3 xl:w-[184px] xl:items-stretch xl:px-2">
      <a href="/" className="mb-4 flex items-center gap-2 px-2" aria-label="FloodSetu home">
        <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden>
          <path d="M10 40c6 0 6-4 11-4s5 4 11 4 6-4 11-4 5 4 11 4" fill="none" stroke="#2ec5d3" strokeWidth="5" strokeLinecap="round" />
          <path d="M14 30 L32 14 L50 30" fill="none" stroke="#eceae3" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="32" cy="30" r="5" fill="#ff5a36" />
        </svg>
        <span className="hidden text-[15px] font-semibold tracking-tight text-hi xl:inline">FloodSetu</span>
        <span className="hidden font-mono text-[9px] text-mute xl:inline">CTRL</span>
      </a>
      {NAV.map((n) => (
        <button
          key={n.id}
          onClick={() => set({ view: n.id })}
          aria-current={view === n.id ? "page" : undefined}
          title={`${n.label} (${n.key})`}
          className={cx("group relative flex h-10 items-center gap-3 rounded-[8px] px-3 text-[13px] transition-colors", view === n.id ? "bg-hover text-hi shadow-[inset_0_0_0_1px_var(--hairline)]" : "text-mute hover:bg-raised hover:text-hi")}
        >
          <Icon name={n.icon} size={17} />
          <span className="hidden xl:inline">{n.label}</span>
          {n.id === "verification" && reviewCount > 0 ? <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-verify px-1 font-mono text-[9px] text-black xl:static xl:ml-auto">{reviewCount}</span> : null}
          <span className="ml-auto hidden font-mono text-[10px] text-dim xl:inline">{n.id === "verification" && reviewCount ? "" : n.key}</span>
        </button>
      ))}
      <div className="mt-auto hidden px-2 xl:block">
        <a href="/sos" className="flex items-center gap-2 py-1 text-[12px] text-mute hover:text-hi"><Icon name="phone" size={14} /> Citizen app</a>
        <a href="/rescuer" className="flex items-center gap-2 py-1 text-[12px] text-mute hover:text-hi"><Icon name="boat" size={14} /> Rescuer app</a>
        <a href="/relief" className="flex items-center gap-2 py-1 text-[12px] text-mute hover:text-hi"><Icon name="ledger" size={14} /> Public ledger</a>
        <a href="/admin" className="flex items-center gap-2 py-1 text-[12px] text-mute hover:text-hi"><Icon name="lock" size={14} /> Admin</a>
      </div>
    </nav>
  );
}

function Kpi({ label, value, unit, data, tone, invert, hint }: { label: string; value: string | number; unit?: string; data: number[]; tone: "sos" | "warn" | "safe" | "info" | "verify" | "water" | "mute"; invert?: boolean; hint: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 border-l border-line px-3 first:border-l-0" title={hint}>
      <div className="min-w-0">
        <div className="label truncate !text-[9.5px]">{label}</div>
        <div className="num mono text-[17px] leading-tight text-hi">
          {value}
          {unit ? <span className="ml-0.5 text-[11px] text-mute">{unit}</span> : null}
        </div>
      </div>
      <div className="hidden 2xl:block">
        <Sparkline data={data} tone={tone} invert={invert} width={56} height={22} />
      </div>
    </div>
  );
}

export function TopBar() {
  const { frame, series, scenario, strategy, bridge, playing, done, replayTick, set } = useControl();
  const [now, setNow] = useState("");
  useEffect(() => {
    const f = () => setNow(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    f();
    const i = setInterval(f, 1000);
    return () => clearInterval(i);
  }, []);
  const k = frame?.kpis;
  const s = (key: keyof (typeof series)[number]) => series.slice(-90).map((x) => Number(x[key]));
  const tick = frame?.tick ?? 0;
  return (
    <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
      <div className="flex min-w-[168px] flex-col">
        <div className="flex items-center gap-2">
          <span className="num mono text-[20px] leading-none text-hi">{clock(tick)}</span>
          {replayTick !== null ? <Badge tone="verify" icon="history">Replay</Badge> : playing ? <Badge tone="safe" icon="play">Live</Badge> : done ? <Badge tone="mute" icon="check">Ended</Badge> : <Badge tone="warn" icon="pause">Paused</Badge>}
        </div>
        <div className="mono mt-1 text-[10px] text-mute">
          T+{String(tick).padStart(3, "0")} · real {now}
        </div>
      </div>
      <div className="hidden min-w-0 flex-col lg:flex">
        <div className="truncate text-[12px] text-hi">{scenario?.name ?? "—"}</div>
        <div className="mono truncate text-[10px] text-mute">
          {strategy.toUpperCase()} · seed {scenario?.seed ?? "—"}
        </div>
      </div>
      <div className="ml-auto flex min-w-0 items-center overflow-hidden">
        <Kpi label="Open SOS" value={k?.openSos ?? 0} data={s("openSos")} tone="sos" hint="Incidents not yet resolved" />
        <Kpi label="Critical waiting" value={k?.criticalWaiting ?? 0} data={s("critical")} tone="sos" hint="Critical incidents with no unit on site yet" />
        <Kpi label="P90 wait" value={k?.p90Wait ?? 0} unit="min" data={s("p90")} tone="warn" hint="90th percentile time-to-service (censored waits included)" />
        <Kpi label="Idle" value={k?.idlePct ?? 0} unit="%" data={s("idlePct")} tone="mute" hint="Share of agent-minutes spent idle" />
        <Kpi label="Violations" value={k?.violations ?? 0} data={s("violations")} tone="warn" hint="Route violations vs ground truth (agent reached an impassable edge it planned to use)" />
        <Kpi label="Fairness" value={(k?.fairness ?? 1).toFixed(2)} data={s("fairness")} tone="safe" hint="Jain's index over neighbourhood mean waits (1 = equal)" />
        <Kpi label="Rescued" value={k?.rescued ?? 0} data={s("rescued")} tone="safe" hint="People delivered to shelters" />
        <SatChip />
        <div className="flex items-center gap-2 border-l border-line px-3" title={`Safety invariants: ${Object.values(INVARIANTS).join(" · ")}`}>
          <Icon name="shield" size={16} className={k?.invariantViolations ? "text-sos" : "text-safe"} />
          <div>
            <div className="label !text-[9.5px]">Invariants</div>
            <div className={cx("mono text-[12px]", k?.invariantViolations ? "text-sos" : "text-safe")}>{k?.invariantViolations ? `${k.invariantViolations} broken` : `${Object.keys(INVARIANTS).length}/${Object.keys(INVARIANTS).length} held`}</div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-l border-line pl-3">
        <span className={cx("flex items-center gap-1.5 font-mono text-[10.5px]", bridge.online ? "text-safe" : "text-mute")} title="Live bridge to citizen & rescuer phones">
          <Icon name={bridge.online ? "wifi" : "wifiOff"} size={14} />
          <span className="hidden md:inline">{bridge.online ? "Phones linked" : "Offline"}</span>
        </span>
        <button onClick={() => set({ paletteOpen: true })} className="hidden items-center gap-1 rounded-full px-2 py-1 text-mute hover:text-hi md:flex" aria-label="Open command palette">
          <Kbd>⌘K</Kbd>
        </button>
      </div>
    </header>
  );
}

function SatChip() {
  const frame = useControl((s) => s.frame);
  const sar = frame?.satellites.filter((s) => s.kind === "sar") ?? [];
  const best = sar.filter((s) => s.ageTicks !== null).sort((a, b) => a.ageTicks! - b.ageTicks!)[0];
  const proc = sar.flatMap((s) => s.processing.map((p) => ({ ...p, name: s.id }))).sort((a, b) => a.availableTick - b.availableTick)[0];
  const f = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m}m`);
  return (
    <div className="hidden items-center gap-2 border-l border-line px-3 xl:flex" title="Freshest satellite (SAR) flood map: data age = now − acquisition time">
      <Icon name="globe" size={16} className="text-[#ebfc72]" />
      <div>
        <div className="label !text-[9.5px]">SAR data age</div>
        <div className="mono text-[12px] text-hi">{best ? `${best.id} ${f(best.ageTicks!)}` : proc ? `${proc.name} in ${f(proc.availableTick - (frame?.tick ?? 0))}` : "awaiting pass"}</div>
      </div>
    </div>
  );
}

const SPEEDS = [1, 5, 15, 60];

export function BottomDock() {
  const st = useControl();
  const { playing, speed, send, set, maxTick, replayTick, frame, liveFrame, world, scenario } = st;
  const tick = replayTick ?? liveFrame?.tick ?? 0;
  const [target, setTarget] = useState({ bridge: "B2", boat: "B-3", shelter: "S2", nbhd: "GHT" });
  const inject = (event: InjectEvent) => send({ type: "inject", event });
  const boats = st.units.filter((u) => u.type === "boat");
  return (
    <footer className="shrink-0 border-t border-line bg-panel">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="primary"
            size="sm"
            icon={playing ? "pause" : "play"}
            aria-label={playing ? "Pause (space)" : "Play (space)"}
            onClick={() => {
              if (replayTick !== null) set({ replayTick: null }), send({ type: "seek", tick: null });
              send({ type: playing ? "pause" : "play" });
            }}
          >
            {playing ? "Pause" : "Play"}
          </Button>
          <Button size="sm" icon="step" aria-label="Step one tick (.)" onClick={() => send({ type: "step" })}>
            Step
          </Button>
          <Segmented value={speed} options={SPEEDS.map((s) => ({ value: s, label: `${s}×`, title: `${s} sim-minutes per second` }))} onChange={(v) => (set({ speed: v }), send({ type: "speed", value: v }))} />
        </div>
        <div className="mx-1 h-6 w-px bg-line" />
        <span className="label hidden md:inline">Inject</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="quiet" icon="waves" onClick={() => inject({ type: "RAIN_SURGE", nbhds: [target.nbhd], delta: 0.5, duration: 45 })}>
            Rain surge
          </Button>
          <select aria-label="Bridge" value={target.bridge} onChange={(e) => setTarget({ ...target, bridge: e.target.value })} className="h-7 rounded-[6px] bg-raised px-2 font-mono text-[11px] text-hi shadow-[inset_0_0_0_1px_var(--hairline)]">
            {(world?.bridges ?? ["B1", "B2", "B3"]).map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <Button size="sm" variant="quiet" icon="bridge" onClick={() => inject({ type: "BRIDGE_COLLAPSE", edge: target.bridge })}>
            Collapse
          </Button>
          <Button size="sm" variant="quiet" icon="alert" title="Contradictory reports: a citizen says OPEN, a rescuer says COLLAPSED" onClick={() => (inject({ type: "REPORT", edge: target.bridge, claim: "open", source: "citizen", confidence: 0.9, note: "citizen: bridge fine" }), setTimeout(() => inject({ type: "REPORT", edge: target.bridge, claim: "closed", source: "rescuer", confidence: 0.9, note: "radio: bridge down" }), 300))}>
            Conflict
          </Button>
          <select aria-label="Boat" value={target.boat} onChange={(e) => setTarget({ ...target, boat: e.target.value })} className="h-7 rounded-[6px] bg-raised px-2 font-mono text-[11px] text-hi shadow-[inset_0_0_0_1px_var(--hairline)]">
            {(boats.length ? boats.map((b) => b.id) : ["B-1", "B-2", "B-3", "B-4", "B-5", "B-6", "B-7", "B-8"]).map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <Button size="sm" variant="quiet" icon="boat" onClick={() => inject({ type: "AGENT_FAILURE", agent: target.boat, cause: "engine failure (injected)" })}>
            Fail
          </Button>
          <select aria-label="Shelter" value={target.shelter} onChange={(e) => setTarget({ ...target, shelter: e.target.value })} className="h-7 rounded-[6px] bg-raised px-2 font-mono text-[11px] text-hi shadow-[inset_0_0_0_1px_var(--hairline)]">
            {(world?.shelters ?? []).map((s) => (
              <option key={s.id}>{s.id}</option>
            ))}
          </select>
          <Button size="sm" variant="quiet" icon="shelter" onClick={() => inject({ type: "SHELTER_OVERFLOW", shelter: target.shelter, walkIns: 60 })}>
            Overflow
          </Button>
          <select aria-label="Neighbourhood" value={target.nbhd} onChange={(e) => setTarget({ ...target, nbhd: e.target.value })} className="h-7 rounded-[6px] bg-raised px-2 font-mono text-[11px] text-hi shadow-[inset_0_0_0_1px_var(--hairline)]">
            {(world?.nbhds ?? []).map((n) => (
              <option key={n.id} value={n.id}>
                {n.id}
              </option>
            ))}
          </select>
          <Button size="sm" variant="quiet" icon="siren" onClick={() => inject({ type: "SOS_BURST", nbhd: target.nbhd, count: 20, duplicates: 5, sameBuilding: 1 })}>
            SOS burst
          </Button>
          <Button size="sm" variant="quiet" icon="wifiOff" onClick={() => inject({ type: "BLACKOUT", nbhd: target.nbhd, duration: 45 })}>
            Blackout
          </Button>
          <Button size="sm" variant="quiet" icon="bridge" title="Old Jalnagar Barrage (1958) emergency release" onClick={() => inject({ type: "DAM_RELEASE", dam: "D1", cumecs: 5200, duration: 60 })}>
            Dam release
          </Button>
          <Button size="sm" variant="quiet" icon="phone" title="A waiting caller's phone goes silent (drowned / battery dead)" onClick={() => inject({ type: "DEVICE_LOST" })}>
            Phone lost
          </Button>
        </div>
        <div className="ml-auto">
          <Button size="sm" variant="sos" icon="bolt" onClick={() => inject({ type: "TRIPLE_FAILURE", bridge: "auto", agent: "auto", shelter: "auto", walkIns: 60 })} title="Bridge collapse + boat failure + shelter overflow, simultaneously (most disruptive targets)">
            Triple failure
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-line px-3 py-1.5">
        <span className="label w-[58px]">Timeline</span>
        <input
          type="range"
          aria-label="After-action replay scrubber"
          min={0}
          max={Math.max(1, maxTick)}
          value={tick}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (playing) send({ type: "pause" });
            set({ replayTick: v >= maxTick ? null : v });
            send({ type: "seek", tick: v >= maxTick ? null : v });
          }}
          className="h-1 flex-1 cursor-pointer accent-[var(--cta)]"
        />
        <span className="num mono w-[120px] text-right text-[11px] text-mute">
          {clock(tick)} / {clock(maxTick)} {scenario ? `· ${scenario.duration}m` : ""}
        </span>
        <Button size="sm" variant={replayTick === null ? "quiet" : "primary"} onClick={() => (set({ replayTick: null }), send({ type: "seek", tick: null }))} disabled={replayTick === null}>
          Go live
        </Button>
        <span className="mono hidden text-[10px] text-dim lg:inline">{frame ? `${frame.agents.length} agents · ${frame.incidents.length} incidents` : ""}</span>
      </div>
    </footer>
  );
}

export function useExplain() {
  const send = useControl((s) => s.send);
  return (incidentId?: string, taskId?: string) => send({ type: "explain", incidentId, taskId, reqId: nextReq() });
}
