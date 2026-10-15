"use client";
import { clock, type CascadeEntry, type SimEvent } from "@jalsetu/engine";
import { useMemo, useState } from "react";
import { AGENT_STATUS_META, AREA_META, Badge, Button, cx, Empty, Icon, Panel, Stat, URGENCY_META, VERIFY_META, type Tone } from "@/components/ui";
import { useExplain } from "./Chrome";
import { useControl } from "./store";

// ───────────────────────────── Live feed ─────────────────────────────

const FEED_FILTERS: { id: string; label: string; types: string[] | null }[] = [
  { id: "all", label: "All", types: null },
  { id: "neg", label: "Negotiation", types: ["ANNOUNCE", "BID", "AWARD", "DECOMMIT", "OVERRIDE", "REROUTE"] },
  { id: "dis", label: "Disruptions", types: ["BRIDGE_COLLAPSE", "AGENT_FAILURE", "SHELTER_OVERFLOW", "TRIPLE_FAILURE", "EDGE_CLOSE", "BLACKOUT", "RAIN_SURGE", "VIOLATION", "CONTRADICTION", "ESCALATED", "INVARIANT"] },
  { id: "sos", label: "SOS", types: ["SOS_RECEIVED", "SOS_MERGED", "VERIFY_TASK", "VERIFIED", "FALSE_REPORT", "RESOLVED", "PICKUP", "DROP"] },
];

const TYPE_TONE: Record<string, Tone> = {
  AWARD: "info",
  BID: "mute",
  ANNOUNCE: "mute",
  DECOMMIT: "warn",
  REROUTE: "warn",
  VIOLATION: "warn",
  CONTRADICTION: "verify",
  CONTRADICTION_RESOLVED: "safe",
  BELIEF: "verify",
  ESCALATED: "sos",
  BRIDGE_COLLAPSE: "sos",
  AGENT_FAILURE: "sos",
  SHELTER_OVERFLOW: "sos",
  TRIPLE_FAILURE: "sos",
  BLACKOUT: "sos",
  SOS_RECEIVED: "sos",
  SOS_MERGED: "info",
  RESOLVED: "safe",
  DROP: "safe",
  PICKUP: "safe",
  VERIFIED: "safe",
  FALSE_REPORT: "warn",
  INVARIANT: "sos",
  OVERRIDE: "warn",
};

export function Feed({ max = 250, compact }: { max?: number; compact?: boolean }) {
  const { events, replayTick, select } = useControl();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const f = FEED_FILTERS.find((x) => x.id === filter)!;
    const out: SimEvent[] = [];
    for (let i = events.length - 1; i >= 0 && out.length < max; i--) {
      const e = events[i];
      if (replayTick !== null && e.tick > replayTick) continue;
      if (f.types && !f.types.includes(e.type)) continue;
      if (!f.types && (e.type === "ANNOUNCE" || e.type === "BID" || e.type === "RESERVATION")) continue;
      if (q && !e.msg.toLowerCase().includes(q.toLowerCase())) continue;
      out.push(e);
    }
    return out;
  }, [events, filter, q, replayTick, max]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-1.5">
        {FEED_FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={cx("rounded-full px-2 py-0.5 font-mono text-[10.5px]", filter === f.id ? "bg-hover text-hi shadow-[inset_0_0_0_1px_var(--hairline-strong)]" : "text-mute hover:text-hi")}>
            {f.label}
          </button>
        ))}
        {!compact ? <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter…" aria-label="Filter feed" className="ml-auto h-6 w-[90px] rounded-[6px] bg-raised px-2 font-mono text-[11px] text-hi outline-none placeholder:text-dim" /> : null}
      </div>
      <ol className="scroll-thin min-h-0 flex-1 overflow-y-auto" aria-live="polite" aria-label="Negotiation and event feed">
        {list.length === 0 ? <Empty icon="list" title="Quiet so far">Events appear as the simulation runs: SOS, bids, awards, decommits with reason codes.</Empty> : null}
        {list.map((e) => (
          <li
            key={e.seq}
            className="group flex cursor-pointer gap-2 border-b border-line/60 px-2.5 py-1.5 hover:bg-raised"
            onClick={() => {
              if (e.incident) select({ kind: "incident", id: e.incident });
              else if (e.agent) select({ kind: "agent", id: e.agent });
              else if (e.shelter) select({ kind: "shelter", id: e.shelter });
              else if (e.edge) select({ kind: "edge", id: e.edge });
            }}
          >
            <span className="num mono shrink-0 pt-px text-[10px] text-dim">{clock(e.tick)}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Badge tone={TYPE_TONE[e.type] ?? "mute"}>{e.type.replace(/_/g, " ").toLowerCase()}</Badge>
                {e.reason && e.type === "DECOMMIT" ? <span className="mono text-[10px] text-warn">{e.reason}</span> : null}
              </div>
              <p className={cx("mt-0.5 text-[12px] leading-snug", e.severity === "critical" ? "text-hi" : "text-text")}>{e.msg}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ───────────────────────────── Selection detail ─────────────────────────────

export function SelectionPanel() {
  const { selection, frame, world, units, contradictions, select, send, events } = useControl();
  const explain = useExplain();
  if (!selection || !frame || !world) return null;

  if (selection.kind === "incident") {
    const inc = frame.incidents.find((i) => i.id === selection.id);
    if (!inc) return <Empty title="Incident not in view">It may have been resolved more than 20 minutes ago.</Empty>;
    const u = URGENCY_META[inc.urgency];
    const v = VERIFY_META[inc.verification];
    const assigned = units.filter((x) => x.task?.incident === inc.id);
    const recent = events.filter((e) => e.incident === inc.id).slice(-8).reverse();
    return (
      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="mono text-[11px] text-mute">{inc.nbhd} · {inc.reports} report{inc.reports > 1 ? "s" : ""}</div>
            <h3 className="text-[18px] font-semibold text-hi">{inc.id}</h3>
          </div>
          <button onClick={() => select(null)} className="text-mute hover:text-hi" aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={u.tone} icon={u.icon}>{u.label}</Badge>
          <Badge tone={v.tone} icon={v.icon}>{v.label}</Badge>
          <Badge tone="mute" icon="clock">{inc.status.replace("_", " ")}</Badge>
          {inc.escalated ? <Badge tone="sos" icon="alert">Escalated</Badge> : null}
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-[8px] bg-raised p-3">
          <Stat label="People (est.)" value={inc.people} />
          <Stat label="Waiting" value={`${inc.wait}m`} tone={inc.wait > 30 ? "warn" : undefined} />
          <Stat label="Units" value={assigned.length} />
        </div>
        {assigned.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-[8px] p-2 shadow-[inset_0_0_0_1px_var(--hairline)]">
            <div className="flex items-center gap-2">
              <Icon name={a.type === "boat" ? "boat" : "users"} size={15} className="text-hi" />
              <span className="mono text-[12px] text-hi">{a.id}</span>
              <span className="text-[11px] text-mute">{a.task?.phase.replace("_", " ")}</span>
            </div>
            <span className="mono text-[12px] text-hi">{a.task?.eta != null ? `ETA ${a.task.eta}m` : "on site"}</span>
          </div>
        ))}
        <Button variant="primary" size="sm" icon="info" className="w-full" onClick={() => explain(inc.id)}>
          Why this assignment?
        </Button>
        <div>
          <div className="label mb-1">History</div>
          <ol className="space-y-1">
            {recent.map((e) => (
              <li key={e.seq} className="flex gap-2 text-[11.5px]"><span className="mono text-dim">{clock(e.tick)}</span><span className="text-text">{e.msg}</span></li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  if (selection.kind === "agent") {
    const a = units.find((x) => x.id === selection.id);
    const fa = frame.agents.find((x) => x.id === selection.id);
    if (!a || !fa) return null;
    const m = AGENT_STATUS_META[a.status] ?? AGENT_STATUS_META.idle;
    const myEvents = events.filter((e) => e.agent === a.id).slice(-8).reverse();
    return (
      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="mono text-[11px] text-mute">{a.name}</div>
            <h3 className="flex items-center gap-2 text-[18px] font-semibold text-hi"><Icon name={a.type === "boat" ? "boat" : "users"} size={18} /> {a.id}</h3>
          </div>
          <button onClick={() => select(null)} className="text-mute hover:text-hi" aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={m.tone} icon={m.icon}>{m.label}</Badge>
          <Badge tone={a.connected ? "safe" : "verify"} icon={a.connected ? "wifi" : "wifiOff"}>{a.connected ? "Connected" : `Last seen T-${frame.tick - (fa.lastSeen ?? frame.tick)}m`}</Badge>
          {a.skills.map((s) => <Badge key={s} tone="mute">{s.replace("_", " ")}</Badge>)}
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-[8px] bg-raised p-3">
          <Stat label="On board" value={`${a.onboard}/${a.capacity}`} />
          <Stat label="Bundle" value={`${a.queue}/2`} />
          <Stat label={a.type === "boat" ? "Fuel" : "Mode"} value={a.type === "boat" ? `${a.fuel}m` : "ground"} tone={a.fuel !== null && a.fuel < 60 ? "warn" : undefined} />
        </div>
        {a.task ? (
          <div className="rounded-[8px] p-3 shadow-[inset_0_0_0_1px_var(--hairline)]">
            <div className="label">Current commitment</div>
            <div className="mt-1 text-[13px] text-hi">{a.task.kind} · {a.task.incident ?? a.task.id} · {a.task.people} {a.task.kind === "RESCUE" ? "people" : ""}</div>
            <div className="mono mt-1 text-[11px] text-mute">{a.task.phase.replace("_", " ")}{a.task.eta != null ? ` · ETA ${a.task.eta} min` : ""}{a.task.shelter ? ` · → ${a.task.shelter.id}` : ""}</div>
            {a.task.why ? <div className="mt-2 text-[12px] text-text">{a.task.why}</div> : null}
            {a.task.incident ? <Button size="sm" className="mt-2" icon="info" onClick={() => explain(a.task!.incident)}>Why?</Button> : null}
          </div>
        ) : (
          <Empty icon="clock" title="No commitment">Bids on announced tasks it can serve.</Empty>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="danger" icon="x" onClick={() => send({ type: "inject", event: { type: "AGENT_FAILURE", agent: a.id, cause: "operator-injected failure" } })}>Fail unit</Button>
          {a.status === "failed" ? <Button size="sm" icon="check" onClick={() => send({ type: "inject", event: { type: "AGENT_RECOVER", agent: a.id } })}>Restore</Button> : null}
        </div>
        <div>
          <div className="label mb-1">Recent</div>
          <ol className="space-y-1">{myEvents.map((e) => <li key={e.seq} className="flex gap-2 text-[11.5px]"><span className="mono text-dim">{clock(e.tick)}</span><span className="text-text">{e.msg}</span></li>)}</ol>
        </div>
      </div>
    );
  }

  if (selection.kind === "shelter") {
    const s = world.shelters.find((x) => x.id === selection.id)!;
    const ss = frame.shelters.find((x) => x.id === selection.id)!;
    const fr = ss.occupancy / Math.max(1, ss.capacity);
    return (
      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="mono text-[11px] text-mute">{s.id} · {s.nbhd}{s.medical ? " · medical" : ""}</div>
            <h3 className="text-[16px] font-semibold text-hi">{s.name}</h3>
          </div>
          <button onClick={() => select(null)} className="text-mute hover:text-hi" aria-label="Close"><Icon name="x" /></button>
        </div>
        <Badge tone={fr >= 0.95 ? "sos" : fr >= 0.7 ? "warn" : "safe"} icon={fr >= 0.95 ? "alert" : "check"}>{fr >= 0.95 ? "Full / overflow" : fr >= 0.7 ? "Filling" : "Accepting"}</Badge>
        <div className="grid grid-cols-3 gap-3 rounded-[8px] bg-raised p-3">
          <Stat label="Occupancy" value={ss.occupancy} />
          <Stat label="Reserved" value={ss.reserved} />
          <Stat label="Capacity" value={ss.capacity} />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--n-4)]"><div className="h-full" style={{ width: `${Math.min(100, fr * 100)}%`, background: fr >= 0.95 ? "var(--sos)" : fr >= 0.7 ? "var(--warn)" : "var(--safe)" }} /></div>
        <p className="text-[12px] text-mute">Drop-off requires a confirmed reservation from this ShelterAgent (invariant 4). On overflow, the newest reservations are cancelled and boats re-reserve elsewhere in the same tick.</p>
        <Button size="sm" variant="danger" icon="shelter" onClick={() => send({ type: "inject", event: { type: "SHELTER_OVERFLOW", shelter: s.id, walkIns: 50 } })}>Inject overflow (+50)</Button>
      </div>
    );
  }

  if (selection.kind === "edge") {
    const e = world.edges.find((x) => x.id === selection.id)!;
    const i = world.edges.indexOf(e);
    const status = frame.edgeCop[i];
    const truth = frame.edgeTruth[i];
    const con = contradictions.filter((c) => c.edge === e.id);
    const label = { o: "Open", c: "Closed", u: "Unknown", x: "Contested" }[status] ?? status;
    return (
      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="mono text-[11px] text-mute">{e.id} · {e.kind}{e.sensor ? " · sensor" : ""}</div>
            <h3 className="text-[16px] font-semibold text-hi">{e.label ?? `Road ${e.id}`}</h3>
          </div>
          <button onClick={() => select(null)} className="text-mute hover:text-hi" aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="flex gap-1.5">
          <Badge tone={status === "c" ? "sos" : status === "x" ? "verify" : status === "u" ? "warn" : "safe"} icon={status === "c" ? "x" : status === "x" ? "alert" : status === "u" ? "hourglass" : "check"}>COP: {label}</Badge>
          <Badge tone="mute">Truth: {truth === "c" ? "closed" : "open"}</Badge>
        </div>
        {con.map((c) => (
          <div key={c.id} className="rounded-[8px] p-3 shadow-[inset_0_0_0_1px_rgba(164,139,255,0.35)]">
            <div className="label !text-verify">Conflict {c.id} · {clock(c.tick)}</div>
            <ul className="mt-1 space-y-1">
              {c.sources.map((s, k) => <li key={k} className="text-[12px] text-text"><span className="mono text-hi">{s.source}</span> said <b className={s.claim === "closed" ? "text-sos" : "text-safe"}>{s.claim}</b> (conf {s.confidence}) at {clock(s.tick)}</li>)}
            </ul>
            <div className="mt-2 text-[12px] text-mute">{c.resolvedTick !== undefined ? `Resolved ${c.resolvedAs?.toUpperCase()} after ${c.resolvedTick - c.tick} min · wasted trips ${c.wastedTrips} · churn ${c.churn}` : "Unresolved — verification task auctioned to a ground team; ground routing avoids, boats ×3 cost."}</div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="danger" icon="x" onClick={() => send({ type: "inject", event: e.kind === "bridge" ? { type: "BRIDGE_COLLAPSE", edge: e.id } : { type: "EDGE_CLOSE", edge: e.id, announce: "control_room" } })}>{e.kind === "bridge" ? "Collapse" : "Close road"}</Button>
          <Button size="sm" icon="alert" onClick={() => send({ type: "inject", event: { type: "REPORT", edge: e.id, claim: status === "c" ? "open" : "closed", source: "citizen", confidence: 0.85 } })}>Citizen report (contradict)</Button>
        </div>
      </div>
    );
  }

  if (selection.kind === "nbhd") {
    const n = world.nbhds.find((x) => x.id === selection.id)!;
    const stt = frame.areaStatus[n.id];
    const meta = AREA_META[stt];
    const incs = frame.incidents.filter((i) => i.nbhd === n.id && i.status !== "resolved");
    return (
      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="mono text-[11px] text-mute">{n.id} · pop {n.population.toLocaleString("en-IN")} · vulnerability {n.vulnerability}</div>
            <h3 className="text-[16px] font-semibold text-hi">{n.name} <span className="text-mute">{n.nameHi}</span></h3>
          </div>
          <button onClick={() => select(null)} className="text-mute hover:text-hi" aria-label="Close"><Icon name="x" /></button>
        </div>
        <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
        <p className="text-[12px] text-mute">{n.note}</p>
        <div className="grid grid-cols-3 gap-3 rounded-[8px] bg-raised p-3">
          <Stat label="Water (COP)" value={`${frame.levelsCop[n.id]?.toFixed(2)}m`} />
          <Stat label="Open SOS" value={incs.length} />
          <Stat label="Max wait" value={`${Math.max(0, ...incs.map((i) => i.wait))}m`} />
        </div>
      </div>
    );
  }
  return null;
}

// ───────────────────────────── Why? drawer ─────────────────────────────

export function WhyDrawer() {
  const { why, whyOpen, set } = useControl();
  if (!whyOpen || !why) return null;
  const w = why.why;
  const inc = why.incident as { reports?: { sosId: string; text: string; people: number; urgency: string; source: string; risk: { score: number; reasons: string[] } }[]; peopleRange?: [number, number]; risk?: { score: number; reasons: string[] } } | undefined;
  const pr = w?.priority as Record<string, number> | undefined;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={() => set({ whyOpen: false })} role="dialog" aria-modal="true" aria-label="Why this assignment">
      <aside className="scroll-thin h-full w-full max-w-[560px] overflow-y-auto bg-panel shadow-[inset_1px_0_0_var(--hairline-strong)]" onClick={(e) => e.stopPropagation()}>
        <header className="sticky top-0 flex items-center justify-between border-b border-line bg-panel px-5 py-3">
          <div>
            <div className="label">Why? · deterministic explanation from the event log</div>
            <h2 className="text-[16px] font-semibold text-hi">{w?.title ?? "No assignment yet"}</h2>
          </div>
          <button onClick={() => set({ whyOpen: false })} aria-label="Close" className="text-mute hover:text-hi"><Icon name="x" size={18} /></button>
        </header>
        <div className="space-y-5 p-5">
          <p className="font-serif text-[15px] leading-relaxed text-hi">{w?.summary ?? "No award recorded."}</p>
          {pr ? (
            <div>
              <div className="label mb-2">Utility breakdown (priority)</div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[12px]">
                {[["U", "urgency"], ["V", "vulnerability"], ["N", "people"], ["A", "aging"], ["C", "verification"], ["E", "escalation"], ["F", "fairness"]].map(([k, l], i) => (
                  <span key={k} className="flex items-center gap-1.5">
                    {i ? <span className="text-dim">×</span> : null}
                    <span className="rounded-[4px] bg-raised px-2 py-1 shadow-[inset_0_0_0_1px_var(--hairline)]" title={l}>
                      <span className="text-mute">{l} </span>
                      <span className="text-hi">{Number(pr[k]).toFixed(2)}</span>
                    </span>
                  </span>
                ))}
                <span className="text-dim">=</span>
                <span className="rounded-[4px] bg-cta px-2 py-1 text-cta-text">{pr.total}</span>
              </div>
              <p className="mt-2 text-[11.5px] text-mute">Award utility = priority ÷ (1 + bid/20). No money, donation or media input exists in this formula (architecture-tested).</p>
            </div>
          ) : null}
          {w?.bids.length ? (
            <div>
              <div className="label mb-2">Bids received</div>
              <table className="w-full text-left text-[12px]">
                <thead className="label"><tr><th className="py-1">Agent</th><th>Bid</th><th>Breakdown / exclusion</th></tr></thead>
                <tbody>
                  {w.bids.slice(0, 14).map((b) => (
                    <tr key={b.agent} className={cx("border-t border-line", b.winner && "bg-[rgba(236,234,227,0.06)]")}>
                      <td className="mono py-1.5 text-hi">{b.winner ? "★ " : ""}{b.agent}</td>
                      <td className="mono num">{b.bid !== null ? `${b.bid.toFixed(1)}m` : "—"}</td>
                      <td className="text-mute">{b.excluded ? <span className="text-warn">{b.excluded}</span> : Object.entries(b.breakdown ?? {}).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {w?.constraints.length ? (
            <div>
              <div className="label mb-2">Constraints applied</div>
              <ul className="space-y-1">{w.constraints.map((c) => <li key={c} className="flex items-center gap-2 text-[12px] text-text"><Icon name="check" size={13} className="text-safe" />{c}</li>)}</ul>
            </div>
          ) : null}
          {inc?.reports?.length ? (
            <div>
              <div className="label mb-2">Original reports ({inc.reports.length}) · est. range {inc.peopleRange?.join("–")}</div>
              <ul className="space-y-1.5">
                {inc.reports.map((r) => (
                  <li key={r.sosId} className="rounded-[6px] bg-raised px-2.5 py-1.5 text-[12px]">
                    <span className="mono text-hi">{r.sosId}</span> <span className="text-mute">· {r.people} ppl · {r.urgency} · {r.source}</span>
                    {r.risk.score ? <span className="ml-1 text-warn">· risk {r.risk.score}</span> : null}
                    <div className="text-text">{r.text}</div>
                  </li>
                ))}
              </ul>
              {inc.risk?.reasons?.length ? <p className="mt-2 text-[12px] text-warn">Review reasons: {inc.risk.reasons.join("; ")} — routed to review, never blocked.</p> : null}
            </div>
          ) : null}
          {w?.history.length ? (
            <div>
              <div className="label mb-2">Timeline</div>
              <ol className="space-y-1">{w.history.slice(-24).map((e) => <li key={e.seq} className="flex gap-2 text-[11.5px]"><span className="mono text-dim">{clock(e.tick)}</span><span className="text-text">{e.msg}</span></li>)}</ol>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

// ───────────────────────────── Cascade panel ─────────────────────────────

export function CascadePanel() {
  const { cascadeOpen, set, series, select } = useControl();
  if (!cascadeOpen) return null;
  const c = cascadeOpen as CascadeEntry & { pendingTasks?: unknown };
  const before = series.filter((s) => s.tick < c.tick && s.tick >= c.tick - 20);
  const after = series.filter((s) => s.tick > c.tick).slice(-20);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const delta = [
    { label: "Open SOS", b: avg(before.map((s) => s.openSos)), a: avg(after.map((s) => s.openSos)), better: "low" },
    { label: "Critical waiting", b: avg(before.map((s) => s.critical)), a: avg(after.map((s) => s.critical)), better: "low" },
    { label: "P90 wait (min)", b: avg(before.map((s) => s.p90)), a: avg(after.map((s) => s.p90)), better: "low" },
  ];
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[66px] z-30 flex justify-center px-4" role="dialog" aria-label="Cascade: cancellations and reassignments">
      <section className="pointer-events-auto scroll-thin max-h-[calc(100dvh-220px)] w-full max-w-[860px] overflow-y-auto rounded-[14px] bg-[rgba(13,17,23,0.97)] shadow-[inset_0_0_0_1px_rgba(255,90,54,0.45),0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--sos-dim)] text-sos"><Icon name="bolt" size={16} /></span>
            <div>
              <div className="label !text-sos">Cascade · {clock(c.tick)} · {c.causes.length} simultaneous disruption{c.causes.length > 1 ? "s" : ""}</div>
              <h2 className="text-[15px] font-semibold text-hi">{c.causes.map((x) => x.msg).join(" + ")}</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={c.resolvedTick !== undefined ? "safe" : "warn"} icon={c.resolvedTick !== undefined ? "check" : "hourglass"}>{c.resolvedTick !== undefined ? `Recovered in ${c.resolvedTick - c.tick} min` : "Recovering…"}</Badge>
            <button onClick={() => set({ cascadeOpen: null })} aria-label="Close cascade panel" className="text-mute hover:text-hi"><Icon name="x" size={18} /></button>
          </div>
        </header>
        <div className="grid gap-4 p-5 md:grid-cols-[1.25fr_1fr]">
          <div className="space-y-4">
            <div>
              <div className="label mb-2">Cancelled commitments → reason code</div>
              {c.cancelled.length === 0 ? <p className="text-[12px] text-mute">No commitments had to be cancelled.</p> : null}
              <ul className="space-y-1">
                {c.cancelled.map((x) => (
                  <li key={x.commitment} className="flex items-center gap-2 text-[12px]">
                    <button className="mono text-hi hover:underline" onClick={() => select({ kind: "agent", id: x.agent })}>{x.agent}</button>
                    <Icon name="chevronR" size={12} className="text-dim" />
                    <span className="mono text-text">{x.incident ?? x.task}</span>
                    <Badge tone="warn">{x.reason}</Badge>
                    <span className="text-mute">{x.people} ppl</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label mb-2">Re-auctioned → new owner</div>
              {c.reassigned.length === 0 ? <p className="text-[12px] text-mute">Awaiting a capable agent with a safe route…</p> : null}
              <ul className="space-y-1.5">
                {c.reassigned.map((r) => (
                  <li key={r.task + r.agent} className="rounded-[6px] bg-raised px-2.5 py-1.5 text-[12px]">
                    <span className="mono text-hi">{r.incident ?? r.task}</span> → <span className="mono text-safe">{r.agent}</span> <span className="text-mute">ETA {Math.round(r.eta)} min{r.tick > c.tick ? ` (at ${clock(r.tick)})` : " (same tick)"}</span>
                    <div className="mono text-[11px] text-dim">bids: {r.bids.map((b) => `${b.agent} ${b.bid.toFixed(1)}`).join(" · ")}</div>
                  </li>
                ))}
              </ul>
            </div>
            {c.reroutes.length ? (
              <div>
                <div className="label mb-2">Re-routes</div>
                <ul className="space-y-1">{c.reroutes.map((r, i) => <li key={i} className="text-[12px] text-text"><span className="mono text-hi">{r.agent}</span> {r.from ? `${r.from} → ${r.to ?? "HOLDING"}` : ""} <Badge tone="warn">{r.reason}</Badge></li>)}</ul>
              </div>
            ) : null}
          </div>
          <div className="space-y-4">
            <div>
              <div className="label mb-2">Plain language</div>
              <ol className="space-y-2 font-serif text-[14px] leading-relaxed text-hi">{c.explanation.map((l, i) => <li key={i}>{l}</li>)}</ol>
            </div>
            <div>
              <div className="label mb-2">Before (20 min) → after</div>
              <div className="grid grid-cols-3 gap-2">
                {delta.map((d) => {
                  const worse = d.a > d.b;
                  return (
                    <div key={d.label} className="rounded-[8px] bg-raised p-2">
                      <div className="label !text-[9px]">{d.label}</div>
                      <div className="num mono text-[13px] text-hi">{d.b.toFixed(1)} → <span className={worse ? "text-warn" : "text-safe"}>{d.a.toFixed(1)}</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function CascadeList() {
  const { cascades, set } = useControl();
  const list = [...cascades].reverse().filter((c) => c.cancelled.length || c.causes.length > 1).slice(0, 6);
  if (!list.length) return null;
  return (
    <div className="space-y-1.5 p-2">
      {list.map((c) => (
        <button key={c.tick + c.causes.map((x) => x.target).join()} onClick={() => set({ cascadeOpen: c })} className="flex w-full items-center gap-2 rounded-[8px] bg-raised px-2.5 py-2 text-left hover:bg-hover">
          <Icon name="bolt" size={14} className={c.causes.length >= 3 ? "text-sos" : "text-warn"} />
          <span className="mono text-[10.5px] text-dim">{clock(c.tick)}</span>
          <span className="truncate text-[12px] text-hi">{c.causes.map((x) => x.msg).join(" + ")}</span>
          <span className="ml-auto mono text-[10.5px] text-mute">{c.cancelled.length}✕ {c.reassigned.length}↻</span>
        </button>
      ))}
    </div>
  );
}

export function LayerPanel() {
  const { layers, toggleLayer } = useControl();
  const items: [keyof typeof layers, string, React.ReactNode][] = [
    ["floodExtent", "Flood extent (depth)", <span key="a" className="h-2.5 w-2.5 rounded-sm bg-water" />],
    ["floodProne", "Flood-prone zones", <span key="b" className="h-2.5 w-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,var(--warn)_0_1px,transparent_1px_4px)]" />],
    ["areaStatus", "Area status / verifying", <span key="c" className="h-2.5 w-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,var(--verify)_0_1px,transparent_1px_4px)]" />],
    ["sos", "SOS & incidents", <span key="d" className="h-2.5 w-2.5 rounded-full bg-sos" />],
    ["agents", "Boats & ground teams", <span key="e" className="h-2.5 w-2.5 rounded-full bg-cta" />],
    ["routes", "Active routes", <span key="f" className="h-0.5 w-3 bg-info" />],
    ["shelters", "Shelters (capacity)", <span key="g" className="h-2.5 w-2.5 rounded-full border-2 border-safe" />],
    ["edges", "Roads / water / bridges", <span key="h" className="h-0.5 w-3 bg-[var(--n-7)]" />],
    ["heatmap", "Unmet-need heatmap", <span key="i" className="h-2.5 w-2.5 rounded-full bg-[radial-gradient(var(--sos),transparent)]" />],
    ["labels", "Labels", <span key="j" className="mono text-[9px] text-mute">Aa</span>],
    ["truth", "Ground truth (debug)", <Icon key="k" name="eye" size={11} />],
  ];
  return (
    <div className="px-3 py-2">
      {items.map(([k, label, sw]) => (
        <label key={k} className="flex cursor-pointer items-center gap-2.5 py-[3px] text-[12px] text-text hover:text-hi">
          <input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} className="accent-[var(--cta)]" />
          <span className="grid w-3 place-items-center">{sw}</span>
          {label}
        </label>
      ))}
    </div>
  );
}

export function Legend() {
  return (
    <div className="pointer-events-none flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] bg-[rgba(8,11,15,0.82)] px-3 py-2 font-mono text-[10px] text-text shadow-[inset_0_0_0_1px_var(--hairline)]">
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sos" />critical</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warn" />urgent</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-info" />needs help</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-dashed border-verify" />verifying</span>
      <span className="flex items-center gap-1"><span className="h-[2px] w-3 bg-sos" />closed ✕</span>
      <span className="flex items-center gap-1"><span className="h-[2px] w-3 border-t-2 border-dashed border-warn" />unknown</span>
      <span className="flex items-center gap-1"><span className="h-[2px] w-3 border-t-2 border-dashed border-verify" />contested</span>
      <span className="flex items-center gap-1"><span className="h-[2px] w-3 bg-water" />boat-navigable</span>
      <span className="flex items-center gap-1">▲ boat · ● ground</span>
    </div>
  );
}
