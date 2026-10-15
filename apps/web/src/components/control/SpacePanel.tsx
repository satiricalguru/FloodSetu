"use client";
import { clock, damRisk, DEFAULT_DAMS, defaultSatellites } from "@floodsetu/engine";
import { Badge, Button, cx, Icon } from "@/components/ui";
import { useControl } from "./store";

const fmt = (m: number | null | undefined) => (m === null || m === undefined ? "—" : m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`);
const RISK_TONE = { very_high: "sos", high: "sos", moderate: "warn", low: "mute" } as const;

/** Earth observation (Indian satellites) with live data age + dam register with downstream risk. */
export function SpacePanel() {
  const { frame, scenario, select, send } = useControl();
  if (!frame) return null;
  const meta = Object.fromEntries(defaultSatellites(scenario?.duration ?? 360).map((s) => [s.id, s]));
  return (
    <div className="scroll-thin h-full space-y-4 overflow-y-auto p-3">
      <section>
        <div className="label mb-2 flex items-center gap-2"><Icon name="globe" size={12} /> Indian earth observation · data age is live</div>
        <ul className="space-y-2">
          {frame.satellites.map((s) => {
            const m = meta[s.id];
            const processing = s.processing[0];
            const etaProd = processing ? processing.availableTick - frame.tick : null;
            const fresh = s.ageTicks !== null && s.ageTicks <= 30;
            return (
              <li key={s.id} className="rounded-[8px] bg-raised p-2.5 shadow-[inset_0_0_0_1px_var(--hairline)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] text-hi">{s.name}</span>
                  <span className="mono text-[10px] text-mute">{s.agency}</span>
                </div>
                <div className="mono text-[10.5px] text-mute">{m?.sensor}</div>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[10.5px]">
                  <div><div className="label !text-[9px]">Latency</div><div className="mono text-hi">{fmt(s.latency)}</div></div>
                  <div><div className="label !text-[9px]">Data age</div><div className={cx("mono", s.ageTicks === null ? "text-dim" : fresh ? "text-safe" : "text-warn")}>{s.ageTicks === null ? "no product" : fmt(s.ageTicks)}</div></div>
                  <div><div className="label !text-[9px]">Next pass</div><div className="mono text-hi">{s.nextPass === null ? "—" : `T-${fmt(s.nextPass - frame.tick)}`}</div></div>
                </div>
                {processing ? (
                  <div className="mt-1.5">
                    <div className="flex justify-between font-mono text-[10px] text-verify"><span>processing acq {clock(processing.acquiredTick)}</span><span>ready in {fmt(etaProd)}</span></div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--n-4)]"><div className="h-full bg-verify" style={{ width: `${Math.min(100, ((frame.tick - processing.acquiredTick) / s.latency) * 100)}%` }} /></div>
                  </div>
                ) : null}
                <p className="mt-1.5 text-[10.5px] leading-snug text-dim">{m?.note} Portal: {m?.portal}.</p>
              </li>
            );
          })}
        </ul>
        {Object.keys(frame.rain).length ? (
          <div className="mt-2 rounded-[8px] bg-raised p-2.5">
            <div className="label !text-[9px]">INSAT rain nowcast (mm/h)</div>
            <div className="mt-1 grid grid-cols-6 gap-1 text-center font-mono text-[10.5px]">
              {Object.entries(frame.rain).map(([nb, r]) => <div key={nb}><div className="text-dim">{nb}</div><div className={r >= 35 ? "text-warn" : "text-hi"}>{r}</div></div>)}
            </div>
          </div>
        ) : null}
        <p className="mt-2 text-[10.5px] leading-snug text-mute">Satellite downlink is independent of local mobile networks, so products still arrive over a comms blackout. Fusion is last-writer-wins by <b className="text-text">observation time</b>: a 2-hour-old image never overrides a fresher field reading.</p>
      </section>
      <section>
        <div className="label mb-2 flex items-center gap-2"><Icon name="bridge" size={12} /> Dam register (NRLD-style) · downstream risk</div>
        <ul className="space-y-2">
          {DEFAULT_DAMS.map((d) => {
            const st = frame.dams.find((x) => x.id === d.id);
            const r = damRisk(d);
            return (
              <li key={d.id}>
                <button onClick={() => select({ kind: "dam", id: d.id })} className="w-full rounded-[8px] bg-raised p-2.5 text-left shadow-[inset_0_0_0_1px_var(--hairline)] hover:bg-hover">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] text-hi">{d.name}</span>
                    <Badge tone={RISK_TONE[r.level]} icon="alert">{(st?.risk ?? r.level).replace("_", " ")}</Badge>
                  </div>
                  <div className="mono mt-0.5 text-[10.5px] text-mute">built {d.builtYear} · {2026 - d.builtYear} yrs · {d.type}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--n-4)]"><div className="h-full" style={{ width: `${Math.min(100, st?.reservoirPct ?? 0)}%`, background: (st?.reservoirPct ?? 0) >= 97 ? "var(--sos)" : (st?.reservoirPct ?? 0) >= 90 ? "var(--warn)" : "var(--water)" }} /></div>
                    <span className="mono text-[10.5px] text-hi">{st?.reservoirPct}% FRL</span>
                  </div>
                  <div className="mono mt-1 text-[10px] text-dim">zone {d.zone.join(", ")} · {st?.alert}{st?.releaseCumecs ? ` · releasing ${st.releaseCumecs.toLocaleString("en-IN")} m³/s` : ""}</div>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" variant="danger" icon="waves" onClick={() => send({ type: "inject", event: { type: "DAM_RELEASE", dam: "D1", cumecs: 5200, duration: 60 } })}>D1 emergency release</Button>
          <Button size="sm" variant="danger" icon="bolt" onClick={() => send({ type: "inject", event: { type: "DAM_BREACH", dam: "D1" } })}>D1 breach</Button>
        </div>
      </section>
    </div>
  );
}

export function DamDetail({ id }: { id: string }) {
  const { frame, select, send } = useControl();
  const d = DEFAULT_DAMS.find((x) => x.id === id);
  if (!d || !frame) return null;
  const st = frame.dams.find((x) => x.id === id);
  const r = damRisk(d);
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="mono text-[11px] text-mute">{d.id} · {d.river}</div>
          <h3 className="text-[17px] font-semibold text-hi">{d.name}</h3>
        </div>
        <button onClick={() => select(null)} className="text-mute hover:text-hi" aria-label="Close"><Icon name="x" /></button>
      </div>
      <Badge tone={RISK_TONE[r.level]} icon="alert">Downstream risk: {(st?.risk ?? r.level).replace("_", " ")}</Badge>
      <table className="w-full text-[12px]">
        <tbody>
          {[
            ["Year of completion", `${d.builtYear} (${2026 - d.builtYear} years)`],
            ["Type", d.type],
            ["Height / capacity", `${d.heightM} m · ${d.capacityMcm} MCM`],
            ["Spillway capacity", `${d.spillwayCumecs.toLocaleString("en-IN")} m³/s`],
            ["Last inspection", `${d.lastInspection} — ${d.health.replace("_", " ")}`],
            ["Hazard class", d.hazard],
            ["Reservoir", `${st?.reservoirPct}% of FRL · ${st?.alert}`],
            ["Downstream zone", d.zone.join(", ")],
          ].map(([k, v]) => (
            <tr key={k} className="border-t border-line"><td className="py-1.5 pr-3 text-mute">{k}</td><td className="text-hi">{v}</td></tr>
          ))}
        </tbody>
      </table>
      <div>
        <div className="label mb-1">Why this risk level (score {r.score})</div>
        <ul className="space-y-0.5">{r.reasons.map((x) => <li key={x} className="text-[12px] text-text">· {x}</li>)}</ul>
        <p className="mt-2 text-[11px] text-mute">Requests inside a high-risk zone get a documented priority bump (V + 0.25 × zone risk). Fields mirror CWC/NDSA's National Register of Large Dams; this dam is fictional.</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="danger" icon="waves" onClick={() => send({ type: "inject", event: { type: "DAM_RELEASE", dam: d.id, cumecs: Math.round(d.spillwayCumecs * 0.5), duration: 60 } })}>Release</Button>
        <Button size="sm" variant="danger" icon="bolt" onClick={() => send({ type: "inject", event: { type: "DAM_BREACH", dam: d.id } })}>Breach</Button>
      </div>
    </div>
  );
}
