"use client";
import { CONFIG } from "@jalsetu/engine";
import { clock, type RunMetrics, type StrategyName } from "@jalsetu/engine";
import { Command } from "cmdk";
import { useEffect, useMemo, useState } from "react";
import { AGENT_STATUS_META, Badge, Button, cx, Empty, Icon, Panel, Segmented, Stat, URGENCY_META, VERIFY_META } from "@/components/ui";
import { SCENARIOS } from "@/lib/scenarios";
import { useExplain } from "./Chrome";
import { nextReq, useControl } from "./store";

const th = "label py-2 pr-3 text-left font-normal";
const td = "py-1.5 pr-3 text-[12px]";

export function IncidentsView() {
  const { frame, select, units } = useControl();
  const explain = useExplain();
  const [sort, setSort] = useState<"wait" | "people" | "urgency">("wait");
  const rows = useMemo(() => {
    const r = [...(frame?.incidents ?? [])];
    const u = { critical: 3, urgent: 2, needs_help: 1 } as const;
    r.sort((a, b) => (sort === "wait" ? b.wait - a.wait : sort === "people" ? b.people - a.people : u[b.urgency] - u[a.urgency]));
    return r;
  }, [frame, sort]);
  if (!frame) return <Skeletons />;
  return (
    <Panel title={`Incidents · ${rows.length}`} right={<Segmented value={sort} onChange={setSort} options={[{ value: "wait", label: "wait" }, { value: "people", label: "people" }, { value: "urgency", label: "urgency" }]} />} className="h-full" bodyClass="overflow-auto scroll-thin">
      {rows.length === 0 ? <Empty icon="siren" title="No incidents yet">SOS reports cluster into incidents here.</Empty> : null}
      <table className="w-full px-3">
        <thead className="sticky top-0 bg-panel"><tr className="border-b border-line"><th className={cx(th, "pl-3")}>ID</th><th className={th}>Area</th><th className={th}>Urgency</th><th className={th}>People</th><th className={th}>Reports</th><th className={th}>Verification</th><th className={th}>Status</th><th className={th}>Wait</th><th className={th}>Unit</th><th className={th}></th></tr></thead>
        <tbody>
          {rows.map((i) => {
            const u = URGENCY_META[i.urgency];
            const v = VERIFY_META[i.verification];
            const unit = units.find((x) => x.task?.incident === i.id);
            return (
              <tr key={i.id} className="cursor-pointer border-b border-line/60 hover:bg-raised" onClick={() => select({ kind: "incident", id: i.id })}>
                <td className={cx(td, "mono pl-3 text-hi")}>{i.id}{i.escalated ? <Icon name="alert" size={12} className="ml-1 inline text-sos" /> : null}</td>
                <td className={cx(td, "mono")}>{i.nbhd}</td>
                <td className={td}><Badge tone={u.tone} icon={u.icon}>{u.label}</Badge></td>
                <td className={cx(td, "mono num text-hi")}>{i.people}</td>
                <td className={cx(td, "mono num")}>{i.reports}</td>
                <td className={td}><Badge tone={v.tone} icon={v.icon}>{v.label}</Badge></td>
                <td className={cx(td, "text-mute")}>{i.status.replace("_", " ")}</td>
                <td className={cx(td, "mono num", i.wait > 45 ? "text-warn" : "text-hi")}>{i.wait}m</td>
                <td className={cx(td, "mono")}>{unit ? `${unit.id}${unit.task?.eta != null ? ` · ${unit.task.eta}m` : ""}` : "—"}</td>
                <td className={td}><button className="text-mute hover:text-hi" onClick={(e) => (e.stopPropagation(), explain(i.id))} aria-label={`Why for ${i.id}`}><Icon name="info" size={14} /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

export function AgentsView() {
  const { units, select } = useControl();
  if (!units.length) return <Skeletons />;
  return (
    <Panel title={`Agents · ${units.filter((u) => u.type === "boat").length} boats · ${units.filter((u) => u.type === "ground").length} ground teams`} className="h-full" bodyClass="overflow-auto scroll-thin">
      <table className="w-full">
        <thead className="sticky top-0 bg-panel"><tr className="border-b border-line"><th className={cx(th, "pl-3")}>Unit</th><th className={th}>Type</th><th className={th}>Status</th><th className={th}>Skills</th><th className={th}>Load</th><th className={th}>Fuel</th><th className={th}>Bundle</th><th className={th}>Commitment</th><th className={th}>Comms</th></tr></thead>
        <tbody>
          {units.map((u) => {
            const m = AGENT_STATUS_META[u.status] ?? AGENT_STATUS_META.idle;
            return (
              <tr key={u.id} className="cursor-pointer border-b border-line/60 hover:bg-raised" onClick={() => select({ kind: "agent", id: u.id })}>
                <td className={cx(td, "mono pl-3 text-hi")}>{u.id}</td>
                <td className={td}><Icon name={u.type === "boat" ? "boat" : "users"} size={14} /></td>
                <td className={td}><Badge tone={m.tone} icon={m.icon}>{m.label}</Badge></td>
                <td className={cx(td, "text-mute")}>{u.skills.join(", ") || "—"}</td>
                <td className={cx(td, "mono num")}>{u.onboard}/{u.capacity}</td>
                <td className={cx(td, "mono num", u.fuel !== null && u.fuel < 60 && "text-warn")}>{u.fuel !== null ? `${u.fuel}m` : "—"}</td>
                <td className={cx(td, "mono num")}>{u.queue}/{CONFIG.MAX_QUEUE}</td>
                <td className={cx(td, "text-text")}>{u.task ? `${u.task.kind} ${u.task.incident ?? ""} · ${u.task.phase.replace("_", " ")}${u.task.eta != null ? ` · ${u.task.eta}m` : ""}` : "—"}</td>
                <td className={td}>{u.connected ? <Badge tone="safe" icon="wifi">ok</Badge> : <Badge tone="verify" icon="wifiOff">blackout</Badge>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

export function SheltersView() {
  const { frame, world, select } = useControl();
  if (!frame || !world) return <Skeletons />;
  return (
    <div className="grid h-full auto-rows-min gap-3 overflow-auto p-1 md:grid-cols-2 xl:grid-cols-3">
      {world.shelters.map((s) => {
        const ss = frame.shelters.find((x) => x.id === s.id)!;
        const fr = ss.occupancy / Math.max(1, ss.capacity);
        const fr2 = (ss.occupancy + ss.reserved) / Math.max(1, ss.capacity);
        return (
          <button key={s.id} onClick={() => select({ kind: "shelter", id: s.id })} className="panel p-4 text-left hover:bg-raised">
            <div className="flex items-center justify-between">
              <span className="mono text-[11px] text-mute">{s.id} · {s.nbhd}{s.medical ? " · medical" : ""}</span>
              <Badge tone={fr >= 0.95 ? "sos" : fr >= 0.7 ? "warn" : "safe"} icon={fr >= 0.95 ? "alert" : "check"}>{fr >= 0.95 ? "Full" : fr >= 0.7 ? "Filling" : "Accepting"}</Badge>
            </div>
            <div className="mt-1 text-[14px] text-hi">{s.name}</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--n-4)]">
              <div className="h-full" style={{ width: `${Math.min(100, fr2 * 100)}%`, background: "rgba(236,234,227,0.25)" }}>
                <div className="h-full" style={{ width: `${(fr / Math.max(fr2, 0.0001)) * 100}%`, background: fr >= 0.95 ? "var(--sos)" : fr >= 0.7 ? "var(--warn)" : "var(--safe)" }} />
              </div>
            </div>
            <div className="mono mt-2 flex justify-between text-[11px] text-mute"><span>{ss.occupancy} in · {ss.reserved} reserved</span><span>{ss.capacity} cap</span></div>
          </button>
        );
      })}
    </div>
  );
}

export function VerificationView() {
  const { frame, contradictions, events, select, send } = useControl();
  const explain = useExplain();
  if (!frame) return <Skeletons />;
  const review = frame.incidents.filter((i) => i.verification === "under_review" || i.verification === "needs_attention");
  const pending = frame.incidents.filter((i) => i.verification === "pending" && i.status !== "resolved");
  const esc = frame.incidents.filter((i) => i.escalated && i.status !== "resolved");
  const open = contradictions.filter((c) => c.resolvedTick === undefined);
  const resolved = contradictions.filter((c) => c.resolvedTick !== undefined);
  const shelterConflicts = events.filter((e) => e.type === "SHELTER_REPORT" && /CONFLICTS/.test(e.msg));
  return (
    <div className="grid h-full gap-3 overflow-auto p-1 lg:grid-cols-2">
      <Panel title={`Review queue · ${review.length}`} bodyClass="p-2">
        <p className="px-1 pb-2 text-[11.5px] text-mute">Risk-flagged requests are <b className="text-hi">routed here, never rejected</b>. Critical requests are dispatched in parallel (invariant 7). Many SOS from one area is <b className="text-hi">not</b> a fraud signal.</p>
        {review.length === 0 ? <Empty icon="shield" title="Nothing to review" /> : null}
        {review.map((i) => (
          <div key={i.id} className="mb-1.5 flex items-center gap-2 rounded-[8px] bg-raised px-2.5 py-2">
            <Badge tone={VERIFY_META[i.verification].tone} icon={VERIFY_META[i.verification].icon}>{VERIFY_META[i.verification].label}</Badge>
            <button className="mono text-[12px] text-hi hover:underline" onClick={() => select({ kind: "incident", id: i.id })}>{i.id}</button>
            <span className="text-[12px] text-mute">{i.people} ppl · {i.urgency} · {i.nbhd}</span>
            <Button size="sm" variant="quiet" className="ml-auto" icon="info" onClick={() => explain(i.id)}>Reasons</Button>
          </div>
        ))}
      </Panel>
      <Panel title={`Escalations (starvation guard) · ${esc.length}`} bodyClass="p-2">
        {esc.length === 0 ? <Empty icon="check" title="No request beyond MAX_WAIT" /> : null}
        {esc.map((i) => (
          <div key={i.id} className="mb-1.5 flex items-center gap-2 rounded-[8px] bg-raised px-2.5 py-2">
            <Badge tone="sos" icon="alert">Escalated</Badge>
            <button className="mono text-[12px] text-hi hover:underline" onClick={() => select({ kind: "incident", id: i.id })}>{i.id}</button>
            <span className="text-[12px] text-mute">waiting {i.wait} min · {i.urgency}</span>
          </div>
        ))}
      </Panel>
      <Panel title={`Contradictory reports · ${open.length} open · ${resolved.length} resolved`} bodyClass="p-2" className="lg:col-span-2">
        {contradictions.length === 0 ? <Empty icon="alert" title="No conflicts">Inject “Conflict” from the dock, or run the Contradictory reports scenario.</Empty> : null}
        <div className="grid gap-2 md:grid-cols-2">
          {contradictions.map((c) => (
            <button key={c.id} onClick={() => select({ kind: "edge", id: c.edge })} className="rounded-[8px] bg-raised p-3 text-left hover:bg-hover">
              <div className="flex items-center justify-between">
                <span className="mono text-[12px] text-hi">{c.edge} · {c.id}</span>
                {c.resolvedTick !== undefined ? <Badge tone="safe" icon="check">resolved {c.resolvedAs}</Badge> : <Badge tone="verify" icon="hourglass">contested</Badge>}
              </div>
              <ul className="mt-1.5 space-y-0.5">{c.sources.map((s, k) => <li key={k} className="text-[11.5px] text-text"><span className="mono">{clock(s.tick)}</span> {s.source} → <b className={s.claim === "closed" ? "text-sos" : "text-safe"}>{s.claim}</b> ({s.confidence})</li>)}</ul>
              <div className="mono mt-1.5 text-[10.5px] text-mute">resolution {c.resolvedTick !== undefined ? `${c.resolvedTick - c.tick}m` : "—"} · stabilised {c.lastImpactTick - c.tick}m · wasted trips {c.wastedTrips} · churn {c.churn}</div>
            </button>
          ))}
        </div>
        {shelterConflicts.map((e) => <p key={e.seq} className="mt-2 text-[12px] text-warn">{clock(e.tick)} · {e.msg}</p>)}
      </Panel>
      <Panel title={`Pending verification · ${pending.length}`} bodyClass="p-2" className="lg:col-span-2">
        <div className="flex flex-wrap gap-1.5">{pending.slice(0, 60).map((i) => <button key={i.id} onClick={() => select({ kind: "incident", id: i.id })} className="mono rounded-[4px] bg-raised px-2 py-1 text-[11px] text-text hover:text-hi">{i.id} · {i.urgency === "critical" ? "dispatching" : "queued"}</button>)}</div>
        <div className="mt-3"><Button size="sm" variant="quiet" icon="alert" onClick={() => send({ type: "inject", event: { type: "REPORT", edge: "B2", claim: "open", source: "citizen", confidence: 0.9 } })}>Inject citizen report on B2</Button></div>
      </Panel>
    </div>
  );
}

export function ScenariosView({ onPick }: { onPick: (id: string, strategy: StrategyName, seed?: number) => void }) {
  const { scenario, strategy } = useControl();
  const [strat, setStrat] = useState<StrategyName>(strategy);
  const [seed, setSeed] = useState<string>("");
  return (
    <div className="h-full overflow-auto p-1">
      <div className="panel mb-3 flex flex-wrap items-center gap-3 p-3">
        <span className="label">Strategy</span>
        <Segmented value={strat} onChange={setStrat} options={[{ value: "cnp", label: "CNP (decentralised)" }, { value: "central", label: "Central same-info" }, { value: "omniscient", label: "Omniscient" }, { value: "greedy", label: "Greedy" }]} />
        <span className="label ml-2">Seed</span>
        <input value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))} placeholder="scenario default" aria-label="Seed" className="mono h-7 w-[140px] rounded-[6px] bg-raised px-2 text-[12px] text-hi outline-none shadow-[inset_0_0_0_1px_var(--hairline)]" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SCENARIOS.map((s) => (
          <article key={s.id} className={cx("panel flex flex-col p-4", scenario?.id === s.id && "shadow-[inset_0_0_0_1px_var(--cta)]")}>
            <div className="flex items-center justify-between">
              <span className="mono text-[11px] text-mute">{s.id}.json · seed {s.seed} · {s.duration} min</span>
              {scenario?.id === s.id ? <Badge tone="safe" icon="play">Loaded</Badge> : null}
            </div>
            <h3 className="mt-1 text-[16px] font-semibold text-hi">{s.name}</h3>
            <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-text">{s.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">{(s.tags ?? []).map((t) => <Badge key={t}>{t}</Badge>)}</div>
            <Button variant="primary" size="sm" className="mt-3 self-start" icon="play" onClick={() => onPick(s.id, strat, seed ? Number(seed) : undefined)}>Load & run</Button>
          </article>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── Compare ─────────────────────────────

const STRAT_META: Record<string, { label: string; color: string; dash?: boolean }> = {
  cnp: { label: "Decentralised CNP", color: "#eceae3" },
  central: { label: "Central (same-info)", color: "#7fb2ff" },
  omniscient: { label: "Central omniscient (upper bound)", color: "#7fb2ff", dash: true },
  greedy: { label: "Greedy floor", color: "#6b7788" },
};

interface BenchFile {
  generatedAt: string;
  seeds: number;
  metrics: { key: string; label: string; better: "low" | "high"; unit: string }[];
  scenarios: string[];
  agg: Record<string, Record<string, Record<string, { mean: number; sd: number; n: number }>>>;
  overall: Record<string, Record<string, number>>;
  verdict: string[];
}

function Bars({ title, unit, better, values }: { title: string; unit: string; better: "low" | "high"; values: { s: string; v: number; sd?: number }[] }) {
  const valid = values.filter((x) => Number.isFinite(x.v));
  const max = Math.max(1e-9, ...valid.map((x) => x.v + (x.sd ?? 0)));
  const fair = valid.filter((x) => x.s !== "omniscient");
  const best = fair.length ? (better === "low" ? Math.min(...fair.map((x) => x.v)) : Math.max(...fair.map((x) => x.v))) : NaN;
  return (
    <div className="panel p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[12.5px] text-hi">{title}</h4>
        <span className="label">{better === "low" ? "lower is better" : "higher is better"}</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {values.map((x) => {
          const m = STRAT_META[x.s];
          const w = Number.isFinite(x.v) ? (x.v / max) * 100 : 0;
          return (
            <div key={x.s} className="flex items-center gap-2">
              <span className="w-[88px] shrink-0 truncate text-[10.5px] text-mute" title={m.label}>{m.label.split(" (")[0].replace("Decentralised ", "")}{x.s === "omniscient" ? " ⓘ" : ""}</span>
              <div className="relative h-4 flex-1 rounded-[3px] bg-[var(--n-2)]">
                <div className="h-full rounded-[3px]" style={{ width: `${w}%`, background: m.dash ? "transparent" : m.color, boxShadow: m.dash ? `inset 0 0 0 1px ${m.color}` : undefined, opacity: x.s === "greedy" ? 0.8 : 1 }} />
              </div>
              <span className={cx("num mono w-[64px] text-right text-[11px]", x.v === best && x.s !== "omniscient" ? "text-safe" : "text-hi")}>{Number.isFinite(x.v) ? `${x.v}${unit === "%" ? "%" : unit ? "" : ""}` : "n/a"}{x.v === best && x.s !== "omniscient" ? " ★" : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const LIVE_KEYS: { key: string; label: string; better: "low" | "high"; unit: string; get: (m: RunMetrics) => number }[] = [
  { key: "tts_mean", label: "Time to service (mean, min)", better: "low", unit: "min", get: (m) => m.timeToService.mean },
  { key: "tts_weighted", label: "Urgency-weighted TTS (min)", better: "low", unit: "min", get: (m) => m.timeToService.weighted },
  { key: "tts_critical", label: "Critical TTS (min)", better: "low", unit: "min", get: (m) => m.timeToService.byUrgency.critical?.mean ?? NaN },
  { key: "rescued_pct", label: "People rescued (%)", better: "high", unit: "%", get: (m) => Math.round((m.rescued / Math.max(1, m.people)) * 1000) / 10 },
  { key: "unmet", label: "Unmet requests", better: "low", unit: "", get: (m) => m.unmet.atEnd },
  { key: "idle_demand", label: "Idle while demand (%)", better: "low", unit: "%", get: (m) => m.idle.whileDemandPct },
  { key: "violations", label: "Route violations", better: "low", unit: "", get: (m) => m.routeViolations },
  { key: "jain", label: "Fairness — Jain", better: "high", unit: "", get: (m) => m.fairness.jain },
  { key: "worst_p90", label: "Worst-nbhd P90 (min)", better: "low", unit: "min", get: (m) => m.fairness.worstNbhdP90 },
  { key: "churn", label: "Decommits per task", better: "low", unit: "", get: (m) => m.churn.perTask },
  { key: "recovery", label: "Cascade recovery (min)", better: "low", unit: "min", get: (m) => m.cascades.meanRecovery ?? NaN },
  { key: "contra", label: "Contradiction resolution (min)", better: "low", unit: "min", get: (m) => m.contradictions.meanResolution ?? NaN },
];

export function CompareView() {
  const { compare, send, set, scenario } = useControl();
  const [bench, setBench] = useState<BenchFile | null>(null);
  const [tab, setTab] = useState<"bench" | "live">("bench");
  const [sc, setSc] = useState<string>("__overall");
  useEffect(() => {
    fetch("/bench/results.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setBench)
      .catch(() => setBench(null));
  }, []);
  const strategies = ["cnp", "central", "omniscient", "greedy"];
  const liveAgg = useMemo(() => {
    if (!compare?.results) return null;
    const out: Record<string, Record<string, number>> = {};
    for (const s of strategies) {
      const rs = compare.results.filter((r) => r.strategy === s);
      out[s] = Object.fromEntries(LIVE_KEYS.map((k) => {
        const xs = rs.map(k.get).filter((x) => Number.isFinite(x));
        return [k.key, xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : NaN];
      }));
    }
    return out;
  }, [compare]);
  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-1">
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <Segmented value={tab} onChange={setTab} options={[{ value: "bench", label: "Benchmark (pnpm bench)" }, { value: "live", label: "Live: this scenario" }]} />
        {tab === "bench" && bench ? (
          <select value={sc} onChange={(e) => setSc(e.target.value)} className="mono h-7 rounded-[6px] bg-raised px-2 text-[12px] text-hi shadow-[inset_0_0_0_1px_var(--hairline)]" aria-label="Scenario">
            <option value="__overall">All scenarios (mean)</option>
            {bench.scenarios.map((s) => <option key={s}>{s}</option>)}
          </select>
        ) : null}
        {tab === "live" ? (
          <Button size="sm" variant="primary" icon="play" onClick={() => (set({ compare: { progress: 0, results: null } }), send({ type: "compare", seeds: 2, reqId: nextReq() }))}>
            Run 4 strategies × 2 seeds on “{scenario?.name}”
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-3">{strategies.map((s) => <span key={s} className="flex items-center gap-1.5 text-[11px] text-text"><span className="h-2.5 w-4 rounded-[2px]" style={{ background: STRAT_META[s].dash ? "transparent" : STRAT_META[s].color, boxShadow: STRAT_META[s].dash ? `inset 0 0 0 1px ${STRAT_META[s].color}` : undefined }} />{STRAT_META[s].label}</span>)}</div>
      </div>
      {tab === "bench" ? (
        bench ? (
          <>
            <div className="panel p-4">
              <div className="label mb-2">Verdict — auto-generated from {bench.seeds} seeds × {bench.scenarios.length} scenarios · {new Date(bench.generatedAt).toLocaleString()}</div>
              <ul className="space-y-1.5 font-serif text-[14px] leading-relaxed text-hi">{bench.verdict.map((v, i) => <li key={i} className="flex gap-2"><span className="text-dim">—</span>{v}</li>)}</ul>
              <p className="mt-3 text-[11.5px] text-mute">Fair comparison = CNP vs central same-info (identical information & comms). Omniscient has perfect sensing and comms — shown only as an upper bound (ⓘ). ★ marks the best fair strategy per metric.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {bench.metrics.filter((m) => m.key !== "invariants" && m.key !== "gini").map((m) => (
                <Bars key={m.key} title={m.label} unit={m.unit} better={m.better} values={strategies.map((s) => ({ s, v: sc === "__overall" ? bench.overall[s][m.key] : bench.agg[sc][s][m.key].mean, sd: sc === "__overall" ? 0 : bench.agg[sc][s][m.key].sd }))} />
              ))}
            </div>
          </>
        ) : (
          <Empty icon="compare" title="No benchmark file yet">Run <code className="mono">pnpm bench</code> to generate bench/results.json (copied to /public/bench).</Empty>
        )
      ) : compare === null ? (
        <Empty icon="compare" title="Run a live comparison">Runs every strategy headless in the worker with the same scenario and seeds.</Empty>
      ) : !compare.results ? (
        <div className="panel p-6"><div className="label mb-2">Running… {Math.round(compare.progress * 100)}%</div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--n-3)]"><div className="h-full bg-cta transition-all" style={{ width: `${compare.progress * 100}%` }} /></div></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{LIVE_KEYS.map((k) => <Bars key={k.key} title={k.label} unit={k.unit} better={k.better} values={strategies.map((s) => ({ s, v: liveAgg![s][k.key] }))} />)}</div>
      )}
    </div>
  );
}

// ───────────────────────────── Audit (assignment log) ─────────────────────────────

export function AuditView() {
  const { events, select } = useControl();
  const [type, setType] = useState("ALL");
  const rows = useMemo(() => events.filter((e) => ["AWARD", "DECOMMIT", "OVERRIDE", "REROUTE", "OVERRIDE_REJECTED", "ESCALATED", "INVARIANT"].includes(e.type) && (type === "ALL" || e.type === type)).slice(-600).reverse(), [events, type]);
  const reasons = useMemo(() => {
    const r: Record<string, number> = {};
    for (const e of events) if (e.type === "DECOMMIT") r[String(e.reason)] = (r[String(e.reason)] ?? 0) + 1;
    return r;
  }, [events]);
  return (
    <div className="flex h-full flex-col gap-3 p-1">
      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <Segmented value={type} onChange={setType} options={["ALL", "AWARD", "DECOMMIT", "REROUTE", "OVERRIDE"].map((x) => ({ value: x, label: x.toLowerCase() }))} />
        <div className="ml-3 flex flex-wrap gap-1.5">{Object.entries(reasons).map(([k, v]) => <Badge key={k} tone="warn">{k} · {v}</Badge>)}</div>
        <a href="/admin" className="ml-auto flex items-center gap-1 text-[12px] text-mute hover:text-hi"><Icon name="lock" size={13} /> Hash-chained audit log</a>
      </div>
      <Panel title={`Assignment log · every row has a reason (invariant 9)`} className="min-h-0 flex-1" bodyClass="overflow-auto scroll-thin">
        <table className="w-full font-serif">
          <thead className="sticky top-0 bg-panel font-sans"><tr className="border-b border-line"><th className={cx(th, "pl-3")}>Time</th><th className={th}>Event</th><th className={th}>Reason</th><th className={th}>Agent</th><th className={th}>Details</th></tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.seq} className="cursor-pointer border-b border-line/60 hover:bg-raised" onClick={() => e.agent && select({ kind: "agent", id: e.agent })}>
                <td className={cx(td, "mono pl-3 text-dim")}>{clock(e.tick)}</td>
                <td className={td}><Badge tone={e.type === "AWARD" ? "info" : e.type === "INVARIANT" || e.type === "ESCALATED" ? "sos" : "warn"}>{e.type}</Badge></td>
                <td className={cx(td, "mono text-[11px] text-warn")}>{e.reason ?? "—"}</td>
                <td className={cx(td, "mono text-hi")}>{e.agent ?? "—"}</td>
                <td className={cx(td, "text-[13px] text-text")}>{e.msg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

export function ReplaySummary() {
  const { metrics, cascades, contradictions, replayTick, maxTick, send, set, events } = useControl();
  const keyMoments = useMemo(() => events.filter((e) => ["TRIPLE_FAILURE", "BRIDGE_COLLAPSE", "AGENT_FAILURE", "SHELTER_OVERFLOW", "CONTRADICTION", "CONTRADICTION_RESOLVED", "BLACKOUT", "BLACKOUT_END", "ESCALATED", "RAIN_SURGE"].includes(e.type)).slice(-40), [events]);
  const jump = (t: number) => (send({ type: "pause" }), set({ replayTick: t }), send({ type: "seek", tick: t }));
  return (
    <div className="scroll-thin h-full space-y-3 overflow-y-auto p-3">
      <div>
        <div className="label">After-action review</div>
        <p className="mt-1 font-serif text-[14px] leading-relaxed text-hi">Scrub the timeline or jump to a key moment. The map, KPIs and feed rewind to that tick (every tick is a stored frame; the log is append-only).</p>
      </div>
      {metrics ? (
        <div className="grid grid-cols-2 gap-3 rounded-[8px] bg-raised p-3">
          <Stat label="Mean TTS" value={`${metrics.timeToService.mean}m`} />
          <Stat label="P90 TTS" value={`${metrics.timeToService.p90}m`} />
          <Stat label="Rescued" value={`${metrics.rescued}/${metrics.people}`} />
          <Stat label="Unmet at end" value={metrics.unmet.atEnd} />
          <Stat label="Route violations" value={metrics.routeViolations} />
          <Stat label="Jain fairness" value={metrics.fairness.jain} />
          <Stat label="Decommits/task" value={metrics.churn.perTask} />
          <Stat label="Invariant breaks" value={metrics.invariantViolations} tone={metrics.invariantViolations ? "sos" : "safe"} />
        </div>
      ) : (
        <p className="text-[12px] text-mute">Pause or finish the run to compute the full metric set.</p>
      )}
      <div>
        <div className="label mb-1">Key moments</div>
        {keyMoments.length === 0 ? <p className="text-[12px] text-mute">None yet.</p> : null}
        <ol className="space-y-1">
          {keyMoments.map((e) => (
            <li key={e.seq}>
              <button onClick={() => jump(e.tick)} className={cx("flex w-full gap-2 rounded-[6px] px-2 py-1 text-left text-[12px] hover:bg-raised", replayTick === e.tick && "bg-hover")}>
                <span className="mono text-dim">{clock(e.tick)}</span>
                <span className="text-text">{e.msg}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="mono text-[11px] text-mute">{cascades.length} cascades · {contradictions.length} contradictions · {maxTick + 1} frames stored</div>
    </div>
  );
}

function Skeletons() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-8" />)}
    </div>
  );
}

// ───────────────────────────── ⌘K command palette ─────────────────────────────

export function CommandPalette({ onPick }: { onPick: (id: string, strategy: StrategyName) => void }) {
  const { paletteOpen, set, send, units, frame, world, playing, strategy } = useControl();
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        set({ paletteOpen: !useControl.getState().paletteOpen });
      }
      if (e.key === "Escape") set({ paletteOpen: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set]);
  if (!paletteOpen) return null;
  const run = (fn: () => void) => () => {
    fn();
    set({ paletteOpen: false });
    setQ("");
  };
  const jumpMatch = q.match(/(?:jump to |go to )?tick\s*(\d+)/i);
  const inject = (event: Record<string, unknown>) => send({ type: "inject", event: event as never });
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[14vh] backdrop-blur-[2px]" onClick={() => set({ paletteOpen: false })}>
      <Command label="Command palette" className="w-full max-w-[600px] overflow-hidden rounded-[14px] bg-panel shadow-[inset_0_0_0_1px_var(--hairline-strong),0_30px_80px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()} loop>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Icon name="command" size={16} className="text-mute" />
          <Command.Input autoFocus value={q} onValueChange={setQ} placeholder="close bridge B2 · fail boat B-3 · jump to tick 140 · find I-012…" className="h-12 flex-1 bg-transparent text-[14px] text-hi outline-none placeholder:text-dim" />
        </div>
        <Command.List className="scroll-thin max-h-[380px] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-[13px] text-mute">No matching command.</Command.Empty>
          {jumpMatch ? (
            <Item onSelect={run(() => (send({ type: "pause" }), set({ replayTick: Number(jumpMatch[1]), view: "replay" }), send({ type: "seek", tick: Number(jumpMatch[1]) })))} icon="history">Jump to tick {jumpMatch[1]}</Item>
          ) : null}
          <Command.Group heading="Simulation">
            <Item onSelect={run(() => send({ type: playing ? "pause" : "play" }))} icon={playing ? "pause" : "play"} k="space">{playing ? "Pause" : "Play"}</Item>
            <Item onSelect={run(() => send({ type: "step" }))} icon="step" k=".">Step one tick</Item>
            {[1, 5, 15, 60].map((s) => <Item key={s} onSelect={run(() => (set({ speed: s }), send({ type: "speed", value: s })))} icon="clock">Speed {s}×</Item>)}
            <Item onSelect={run(() => inject({ type: "TRIPLE_FAILURE", bridge: "auto", agent: "auto", shelter: "auto", walkIns: 60 }))} icon="bolt">Trigger TRIPLE FAILURE</Item>
          </Command.Group>
          <Command.Group heading="Inject">
            {(world?.bridges ?? []).map((b) => <Item key={b} onSelect={run(() => inject({ type: "BRIDGE_COLLAPSE", edge: b }))} icon="bridge">Close bridge {b}</Item>)}
            {units.filter((u) => u.type === "boat").map((u) => <Item key={u.id} onSelect={run(() => inject({ type: "AGENT_FAILURE", agent: u.id, cause: "palette" }))} icon="boat">Fail boat {u.id}</Item>)}
            {(world?.shelters ?? []).map((s) => <Item key={s.id} onSelect={run(() => inject({ type: "SHELTER_OVERFLOW", shelter: s.id, walkIns: 60 }))} icon="shelter">Overflow shelter {s.id}</Item>)}
            {(world?.nbhds ?? []).map((n) => <Item key={n.id} onSelect={run(() => inject({ type: "BLACKOUT", nbhd: n.id, duration: 45 }))} icon="wifiOff">Blackout {n.name}</Item>)}
            {(world?.nbhds ?? []).map((n) => <Item key={`s${n.id}`} onSelect={run(() => inject({ type: "SOS_BURST", nbhd: n.id, count: 20, duplicates: 5, sameBuilding: 1 }))} icon="siren">SOS burst in {n.name}</Item>)}
          </Command.Group>
          <Command.Group heading="Go to">
            {(["live", "incidents", "agents", "shelters", "verification", "scenarios", "compare", "replay", "audit"] as const).map((v) => <Item key={v} onSelect={run(() => set({ view: v }))} icon="chevronR">View: {v}</Item>)}
            {(frame?.incidents ?? []).slice(-40).map((i) => <Item key={i.id} onSelect={run(() => set({ selection: { kind: "incident", id: i.id }, view: "live" }))} icon="siren">{i.id} · {i.people} people · {i.urgency}</Item>)}
            {units.map((u) => <Item key={`a${u.id}`} onSelect={run(() => set({ selection: { kind: "agent", id: u.id }, view: "live" }))} icon={u.type === "boat" ? "boat" : "users"}>{u.id} · {u.status}</Item>)}
          </Command.Group>
          <Command.Group heading="Scenario">
            {SCENARIOS.map((s) => <Item key={s.id} onSelect={run(() => onPick(s.id, strategy))} icon="layers">Load {s.name}</Item>)}
            {(["cnp", "central", "omniscient", "greedy"] as const).map((s) => <Item key={s} onSelect={run(() => onPick(useControl.getState().scenario?.id ?? "baseline-monsoon", s))} icon="cpu">Strategy: {s}</Item>)}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

function Item({ children, onSelect, icon, k }: { children: React.ReactNode; onSelect: () => void; icon: string; k?: string }) {
  return (
    <Command.Item onSelect={onSelect} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] text-text data-[selected=true]:bg-hover data-[selected=true]:text-hi">
      <Icon name={icon} size={15} className="text-mute" />
      <span className="flex-1">{children}</span>
      {k ? <span className="mono text-[10px] text-dim">{k}</span> : null}
    </Command.Item>
  );
}
