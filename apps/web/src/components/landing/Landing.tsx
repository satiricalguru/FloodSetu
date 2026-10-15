"use client";
import "@fontsource/jetbrains-mono/300.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import { clock, damRisk, DEFAULT_DAMS, type CascadeEntry, type Frame, type SimEvent } from "@floodsetu/engine";
import { useEffect, useRef, useState } from "react";
import type { FromWorker } from "@/lib/protocol";
import ScrollVideo from "./ScrollVideo";

/* INVERSA-lineage tokens (topographic field terminal at midnight) */
const C = { bg: "#13140e", bone: "#f4f3e8", iron: "#404040", ash: "#84837b", lime: "#ebfc72", sos: "#ff5a36" };
const MONO = "'JetBrains Mono', ui-monospace, monospace";

interface Bench {
  overall: Record<string, Record<string, number>>;
  verdict: string[];
  seeds: number;
  scenarios: string[];
}

const SATS = [
  { id: "EOS-04", name: "EOS-04 (RISAT-1A)", by: "ISRO", sensor: "C-band SAR", sees: "Flood extent through cloud", revisit: "17-day repeat · tasked", latency: "~1h 50m*" },
  { id: "NISAR-S", name: "NISAR S-band", by: "ISRO · NASA", sensor: "S-band SAR", sees: "Flood extent, flooded vegetation", revisit: "12-day (~6 d avg)", latency: "~1h 35m*" },
  { id: "INSAT-3DS", name: "INSAT-3DS + 3DR", by: "ISRO · IMD", sensor: "Geostationary imager", sees: "Rain cells (IMSRA), nowcast", revisit: "15 min (staggered)", latency: "~30m*" },
  { id: "RS-2A", name: "Resourcesat-2A", by: "ISRO", sensor: "LISS-IV optical", sees: "Detail — when no cloud", revisit: "5-day", latency: "~1h 00m*" },
];

const fmtAge = (m: number | null | undefined) => (m === null || m === undefined ? "—" : m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`);

function useCount(target: number, run: boolean, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const t0 = performance.now();
    const f = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

function Btn({ href, children, kind = "ghost" }: { href: string; children: React.ReactNode; kind?: "lime" | "ghost" | "sos" }) {
  const s = kind === "lime" ? { background: C.lime, color: C.bg } : kind === "sos" ? { background: C.sos, color: "#fff" } : { color: C.bone, boxShadow: `inset 0 0 0 1px ${C.iron}` };
  return (
    <a href={href} className="inline-flex items-center gap-2 rounded-[3.6px] px-[18px] py-[14px] text-[13px] uppercase tracking-[0.04em] transition-opacity hover:opacity-85" style={{ ...s, fontFamily: MONO }}>
      {children}
    </a>
  );
}

const Label = ({ children, color = C.ash }: { children: React.ReactNode; color?: string }) => (
  <div className="text-[12px] uppercase tracking-[0.06em]" style={{ fontFamily: MONO, color }}>
    {children}
  </div>
);
const Tag = ({ children, filled = false }: { children: React.ReactNode; filled?: boolean }) => (
  <span className="inline-block rounded-[3.6px] px-[7px] py-[4px] text-[11.5px] uppercase" style={{ fontFamily: MONO, background: filled ? C.lime : "transparent", color: filled ? C.bg : C.bone, boxShadow: filled ? undefined : `inset 0 0 0 1px ${C.lime}` }}>
    {children}
  </span>
);

export default function Landing() {
  const [live, setLive] = useState<{ frame: Frame | null; cascade: CascadeEntry | null; log: SimEvent[]; awards: number }>({ frame: null, cascade: null, log: [], awards: 0 });
  const [coords, setCoords] = useState("25.4012°N 85.0034°E");
  const [bench, setBench] = useState<Bench | null>(null);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const [notify, setNotify] = useState(false);
  const worker = useRef<Worker | null>(null);
  const tripled = useRef(false);

  // live engine (same package as the control room) feeds the hero readouts, SOS table, negotiation log and cascade
  useEffect(() => {
    const w = new Worker(new URL("../../workers/sim.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    let awards = 0;
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type !== "frame") return;
      awards += m.events.filter((x) => x.type === "AWARD").length;
      const cas = [...m.cascades].reverse().find((c) => c.causes.length >= 3) ?? null;
      const interesting = m.events.filter((x) => ["AWARD", "SOS_RECEIVED", "SOS_MERGED", "DECOMMIT", "SAT_PRODUCT", "SAT_PASS", "RAIN_NOWCAST", "DAM_RELEASE", "DEVICE_LOST"].includes(x.type));
      setLive((l) => ({ frame: m.frame, cascade: cas ?? l.cascade, log: [...interesting.reverse(), ...l.log].slice(0, 7), awards }));
      if (m.done) w.postMessage({ type: "init", scenarioId: "dam-release", strategy: "cnp" }), w.postMessage({ type: "play" });
    };
    w.postMessage({ type: "init", scenarioId: "dam-release", strategy: "cnp", seed: 9 });
    w.postMessage({ type: "speed", value: 5 });
    w.postMessage({ type: "runTo", tick: 115 });
    w.postMessage({ type: "play" });
    return () => w.terminate();
  }, []);

  useEffect(() => {
    const i = setInterval(() => setCoords(`${(25.4 + Math.random() * 0.06).toFixed(4)}°N ${(85.0 + Math.random() * 0.09).toFixed(4)}°E`), 900);
    fetch("/bench/results.json").then((r) => (r.ok ? r.json() : null)).then(setBench).catch(() => {});
    return () => clearInterval(i);
  }, []);

  // which sections were seen → counters / injections
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) {
            if (el.dataset.seen) setSeen((s) => ({ ...s, [el.dataset.seen!]: true }));
          }
        }
      },
      { threshold: 0.4 },
    );
    document.querySelectorAll("[data-seen]").forEach((el) => io.observe(el));
    let lenisCleanup = () => {};
    (async () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const [{ default: Lenis }, { gsap }] = await Promise.all([import("lenis"), import("gsap")]);
      const lenis = new Lenis({ lerp: 0.1 });
      const raf = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        const o = new IntersectionObserver(([en]) => en.isIntersecting && (gsap.fromTo(el, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" }), o.disconnect()), { threshold: 0.15 });
        o.observe(el);
      });
      lenisCleanup = () => {
        gsap.ticker.remove(raf);
        lenis.destroy();
      };
    })();
    return () => (io.disconnect(), lenisCleanup());
  }, []);

  useEffect(() => {
    if (seen.fail && !tripled.current) {
      tripled.current = true;
      worker.current?.postMessage({ type: "inject", event: { type: "TRIPLE_FAILURE", bridge: "auto", agent: "auto", shelter: "auto", walkIns: 60 } });
    }
  }, [seen.fail]);

  const f = live.frame;
  const sar = f?.satellites.filter((s) => s.kind === "sar") ?? [];
  const sarFresh = sar.filter((s) => s.ageTicks !== null).sort((a, b) => a.ageTicks! - b.ageTicks!)[0];
  const sarProc = sar.flatMap((s) => s.processing.map((p) => ({ ...p, id: s.id }))).sort((a, b) => a.availableTick - b.availableTick)[0];
  const d1 = f?.dams.find((d) => d.id === "D1");
  const o = bench?.overall;
  const nRuns = useCount(bench ? bench.seeds * bench.scenarios.length * 4 : 0, !!seen.evidence);
  const tts = useCount(o?.cnp?.tts_mean ?? 0, !!seen.evidence);
  const crit = useCount(o?.cnp?.tts_critical ?? 0, !!seen.evidence);
  const rec = useCount(o?.cnp?.recovery ?? 0, !!seen.evidence);

  return (
    <div style={{ background: C.bg, color: C.bone }} className="relative">
      {/* persistent aerial world: a river flyover scrubbed by scroll */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <ScrollVideo />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(19,20,14,0.6) 0%, rgba(19,20,14,0) 16%, rgba(19,20,14,0) 55%, rgba(19,20,14,0.9) 100%), radial-gradient(ellipse 70% 60% at 0% 100%, rgba(19,20,14,0.82), rgba(19,20,14,0) 70%)" }} />
      </div>

      {/* nav — transparent, no fill, no border */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 h-24" style={{ background: "linear-gradient(180deg, #13140e 0%, rgba(19,20,14,0.85) 45%, rgba(19,20,14,0) 100%)" }} aria-hidden />
      <nav className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5 md:px-10">
        <a href="/" className="flex items-center gap-2.5 text-[15px]" style={{ color: C.bone }}>
          <img src="/icon.svg" alt="" width={26} height={26} className="rounded-[6px]" />
          FloodSetu <span className="text-[11px]" style={{ fontFamily: MONO, color: C.ash }}>/ PS 27</span>
        </a>
        <div className="hidden items-center gap-7 text-[12.5px] uppercase md:flex" style={{ fontFamily: MONO }}>
          {[["/control", "Control room"], ["/relief", "Ledger"], ["/awareness", "Safety"], ["/design", "System"]].map(([h, l]) => (
            <a key={h} href={h} className="hover:opacity-70" style={{ color: C.bone }}>{l}</a>
          ))}
          <a href="/sos" className="flex items-center gap-1.5" style={{ color: C.bone }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: C.sos }} />SOS</a>
        </div>
        <a href="/sos" className="rounded-[3.6px] px-3 py-1.5 text-[12px] uppercase md:hidden" style={{ fontFamily: MONO, background: C.sos, color: "#fff" }}>SOS</a>
      </nav>

      <main className="relative z-10">
        {/* HERO — image is the surface; type bottom-left */}
        <section data-band="hero" className="relative flex min-h-[100dvh] flex-col justify-end px-5 pb-12 pt-28 md:px-10 md:pb-16 md:pt-32">
          <div className="absolute right-5 top-20 hidden text-right text-[11.5px] leading-relaxed md:right-10 md:block" style={{ fontFamily: MONO, color: C.bone }}>
            <div>{coords}</div>
            <div style={{ color: C.ash }}>JALNAGAR · FICTIONAL · SYNTHETIC GRID</div>
          </div>
          <div className="grid items-end gap-10 lg:grid-cols-[1fr_380px]">
            <div>
              <Label color={C.lime}>Flood rescue dispatch · multi-agent · Indian earth observation</Label>
              <h1 className="mt-5 max-w-[1100px] text-[clamp(52px,8.4vw,132px)] font-normal leading-[0.92] tracking-[-0.045em]"><span className="block" style={{ textWrap: "balance" }}>A signal in the flood.</span><span className="block" style={{ color: C.lime, textWrap: "balance" }}>A lifeline in motion.</span></h1>
              <div className="mt-9 flex flex-wrap gap-3">
                <Btn href="/control" kind="lime">Open control room →</Btn>
                <Btn href="/sos" kind="sos">Request help · SOS</Btn>
                <Btn href="/rescuer">Join as rescuer</Btn>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 text-[12px]" style={{ borderColor: C.iron, fontFamily: MONO }}>
              <LiveStat k="Engine" v={`T+${String(f?.tick ?? 0).padStart(3, "0")} · ${f ? clock(f.tick) : "—"}`} />
              <LiveStat k="Open SOS" v={f?.kpis.openSos ?? "—"} />
              <LiveStat k="SAR data age" v={sarFresh ? `${sarFresh.id} ${fmtAge(sarFresh.ageTicks)}` : sarProc ? `${sarProc.id} in ${fmtAge(sarProc.availableTick - (f?.tick ?? 0))}` : "awaiting pass"} lime />
              <LiveStat k="D1 barrage (1958)" v={d1 ? `${d1.reservoirPct}% FRL · ${d1.alert}` : "—"} />
              <LiveStat k="Rescued" v={f?.kpis.rescued ?? "—"} />
              <LiveStat k="Invariants" v={f ? (f.kpis.invariantViolations ? `${f.kpis.invariantViolations} broken` : "10/10 held") : "—"} />
            </dl>
          </div>
        </section>

        {/* 01 — PROBLEM (solid editorial block) */}
        <Block n="01" k="The problem" band="sos">
          <h2 className="text-[clamp(36px,4.6vw,58px)] leading-[1.06] tracking-[-0.03em]">Flood plans go stale in minutes.</h2>
          <div className="grid gap-10 md:grid-cols-2">
            <p className="text-[18px] leading-[1.62]" style={{ color: C.bone }}>Roads close, a bridge gives way, a shelter fills, and two people report the same bridge differently. FloodSetu treats every boat, ground team, shelter, bridge and SOS cluster as an <b className="font-normal" style={{ color: C.lime }}>autonomous agent</b> with only partial information — and keeps re-planning, with a reason attached to every decision.</p>
            <ul className="divide-y text-[13px] uppercase" style={{ fontFamily: MONO, borderColor: C.iron }}>
              {["Time to service", "Unmet requests", "Resource idle time", "Route violations", "Fairness across neighbourhoods", "Recovery after contradictory updates"].map((m, i) => (
                <li key={m} className="flex justify-between py-3" style={{ borderColor: C.iron }}><span>{m}</span><span style={{ color: C.ash }}>0{i + 1}</span></li>
              ))}
            </ul>
          </div>
        </Block>

        {/* BAND — signals */}
        <Band band="sos" caption="Live SOS from the engine — duplicates merge into one incident, never rejected">
          <table className="w-full text-[12px]" style={{ fontFamily: MONO }}>
            <tbody>
              {(f?.incidents.filter((i) => i.status !== "resolved").slice(-5).reverse() ?? []).map((i) => (
                <tr key={i.id} className="border-t" style={{ borderColor: C.iron }}>
                  <td className="py-2 pr-3" style={{ color: i.urgency === "critical" ? C.sos : C.bone }}>{i.id}</td>
                  <td className="pr-3">{i.nbhd}</td>
                  <td className="pr-3">{i.people} PPL</td>
                  <td className="pr-3 uppercase" style={{ color: C.ash }}>{i.urgency.replace("_", " ")}</td>
                  <td className="text-right" style={{ color: C.ash }}>×{i.reports}{i.deviceLost ? " · PHONE LOST" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Band>

        {/* 02 — NEGOTIATE */}
        <Block n="02" k="Agents negotiate" band="negotiate">
          <h2 className="text-[clamp(36px,4.6vw,58px)] leading-[1.06] tracking-[-0.03em]">Incidents announce. Boats bid. The best offer wins — in the open.</h2>
          <div className="grid gap-10 md:grid-cols-[1fr_1.1fr]">
            <p className="text-[18px] leading-[1.62]">A Contract-Net auction with leveled commitment: each agent bids its time-to-service from <i>its own</i> map; awards weigh urgency, vulnerability, waiting time, fairness — and dam risk. Every award has a bid table and a “Why?”. Money has no input. That is tested, not promised.</p>
            <div>
              <Label>Live negotiation log</Label>
              <ol className="mt-3 text-[12px] leading-[1.5]" style={{ fontFamily: MONO }}>
                {live.log.map((e) => (
                  <li key={e.seq} className="flex gap-3 border-t py-2" style={{ borderColor: C.iron }}>
                    <span style={{ color: C.ash }}>{clock(e.tick)}</span>
                    <span className="min-w-0 flex-1 truncate" title={e.msg}>{e.msg}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Block>

        {/* BAND — failure */}
        <Band band="fail" seenKey="fail" caption="A real triple failure, injected when you scrolled here">
          {live.cascade ? (
            <ol className="space-y-1.5 text-[12.5px] leading-[1.45]" style={{ fontFamily: MONO }}>
              {live.cascade.explanation.slice(0, 6).map((l, i) => <li key={i} className="border-t pt-1.5" style={{ borderColor: C.iron }}>{l}</li>)}
            </ol>
          ) : (
            <p className="text-[12px]" style={{ fontFamily: MONO, color: C.ash }}>BRIDGE · BOAT · SHELTER — INJECTING…</p>
          )}
        </Band>

        {/* 03 — SATELLITES */}
        <Block n="03" k="Eyes in orbit · India first" band="orbit">
          <h2 className="text-[clamp(36px,4.6vw,58px)] leading-[1.06] tracking-[-0.03em]">Satellites see what the network can’t — but never in real time.</h2>
          <p className="max-w-[760px] text-[18px] leading-[1.62]">Monsoon cloud blinds optical cameras, so FloodSetu leans on <b className="font-normal" style={{ color: C.lime }}>ISRO radar</b>. Every product carries its acquisition time and age. Fusion is last-writer-wins by observation time: a two-hour-old image never overrides a fresher field reading, and satellite downlink still works when local towers are dark.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[12.5px]" style={{ fontFamily: MONO }}>
              <thead className="uppercase" style={{ color: C.ash }}>
                <tr>{["Satellite", "Operator", "Sensor", "Sees", "Revisit", "Latency", "Data age · live"].map((h) => <th key={h} className="pb-3 pr-4 font-normal">{h}</th>)}</tr>
              </thead>
              <tbody>
                {SATS.map((s) => {
                  const st = f?.satellites.find((x) => x.id === s.id);
                  const proc = st?.processing[0];
                  return (
                    <tr key={s.id} className="border-t align-top" style={{ borderColor: C.iron }}>
                      <td className="py-3 pr-4">{s.name}</td>
                      <td className="pr-4" style={{ color: C.ash }}>{s.by}</td>
                      <td className="pr-4">{s.sensor}</td>
                      <td className="pr-4" style={{ color: C.ash }}>{s.sees}</td>
                      <td className="pr-4">{s.revisit}</td>
                      <td className="pr-4">{s.latency}</td>
                      <td>{proc ? <Tag>processing · {fmtAge(proc.availableTick - (f?.tick ?? 0))}</Tag> : st?.ageTicks !== null && st?.ageTicks !== undefined ? <Tag filled={st.ageTicks <= 45}>{fmtAge(st.ageTicks)} old</Tag> : <span style={{ color: C.ash }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px]" style={{ fontFamily: MONO, color: C.ash }}>* Modelled from public sources (NRSC flood bulletins, NISAR disaster-product target &lt;5 h, MOSDAC half-hourly IMSRA). Pass times are compressed into the scenario; latencies are the realistic part.</p>
        </Block>

        <Band band="orbit" caption="Satellite passes — a lime tag is acquiring now; its product lands later, with its age">
          <div className="flex flex-wrap gap-2">{(f?.satellites ?? []).map((s) => <Tag key={s.id} filled={!!f?.scan && f.scan.sat.startsWith(s.id.split("-")[0])}>{s.id} · {s.nextPass !== null ? `next T-${fmtAge(s.nextPass - (f?.tick ?? 0))}` : "pass done"}</Tag>)}</div>
        </Band>

        {/* 04 — DAMS */}
        <Block n="04" k="Old dams, new risk" band="dams">
          <h2 className="text-[clamp(36px,4.6vw,58px)] leading-[1.06] tracking-[-0.03em]">Over 1,280 large dams in India are more than 50 years old.</h2>
          <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
            <p className="text-[18px] leading-[1.62]">The National Register of Large Dams (CWC · NDSA, 2023) counts 224 dams older than a century and 1,065 aged 50–100. FloodSetu reads a register like it — year of completion, type, last inspection, hazard class — scores each dam, and marks its downstream area a <b className="font-normal" style={{ color: C.sos }}>high-risk zone</b>. Requests inside get a documented priority bump; a release turns the zone very high.</p>
            <table className="w-full text-[12.5px]" style={{ fontFamily: MONO }}>
              <thead className="uppercase" style={{ color: C.ash }}><tr><th className="pb-3 text-left font-normal">Dam (fictional)</th><th className="text-left font-normal">Built</th><th className="text-left font-normal">Age</th><th className="text-left font-normal">Inspection</th><th className="text-right font-normal">Risk</th></tr></thead>
              <tbody>
                {DEFAULT_DAMS.map((d) => {
                  const r = damRisk(d);
                  const st = f?.dams.find((x) => x.id === d.id);
                  return (
                    <tr key={d.id} className="border-t" style={{ borderColor: C.iron }}>
                      <td className="py-3">{d.name}<div className="text-[11px]" style={{ color: C.ash }}>zone {d.zone.join(", ")} · {st ? `${st.reservoirPct}% FRL` : ""}</div></td>
                      <td>{d.builtYear}</td>
                      <td>{2026 - d.builtYear} yrs</td>
                      <td style={{ color: C.ash }}>{d.health.replace("_", " ")}</td>
                      <td className="text-right uppercase" style={{ color: r.level === "low" ? C.ash : r.level === "moderate" ? C.lime : C.sos }}>{(st?.risk ?? r.level).replace("_", " ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Block>

        <Band band="dams" right caption="Downstream of the 1958 barrage — the high-risk zone, live">
          <p className="text-[12.5px]" style={{ fontFamily: MONO }}>{d1 ? `D1 · ${d1.reservoirPct}% OF FULL RESERVOIR LEVEL · ${d1.alert.toUpperCase()}${d1.releaseCumecs ? ` · RELEASING ${d1.releaseCumecs.toLocaleString("en-IN")} M³/S` : ""}` : "—"}</p>
        </Band>

        {/* 05 — PHONE DROWNS */}
        <Block n="05" k="The judges’ question" band="end">
          <h2 className="text-[clamp(36px,4.6vw,58px)] leading-[1.06] tracking-[-0.03em]">What if the phone drowns?</h2>
          <div className="grid gap-x-10 gap-y-0 md:grid-cols-2">
            {[
              ["One tap, no form", "“I’m in the water” sends a CRITICAL SOS with GPS in under 200 bytes — no typing with wet hands. It queues offline and retries itself."],
              ["Heartbeat watchdog", "The open app pings while help is on the way. 90 s of silence on an active request means the phone is presumed submerged or dead."],
              ["Nothing is cancelled", "The incident keeps its last-known location and building cluster. It is upgraded to critical and escalated in the same tick (safety invariant 10)."],
              ["Search, then call", "The assigned team is told to search the last-known position; the alternate number is called and an IVR/SMS callback goes out (mocked)."],
              ["Battery early warning", "At ≤10% battery the last location is saved and the control room is warned before the phone dies."],
              ["No smartphone at all", "SMS “SOS 4 C near ghat 2” works from a feature phone, and 112 stays one tap away."],
            ].map(([h, b], i) => (
              <div key={h} className="flex gap-5 border-t py-6" style={{ borderColor: C.iron }}>
                <span className="text-[13px]" style={{ fontFamily: MONO, color: C.lime }}>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="text-[20px] leading-tight">{h}</div>
                  <p className="mt-2 text-[16px] leading-[1.55]" style={{ color: "#c9c7bb" }}>{b}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3"><Btn href="/sos" kind="sos">Try the SOS app</Btn><Btn href="/control?scenario=dam-release">See it in the control room</Btn></div>
        </Block>

        {/* 06 — FAIR + FIREWALL */}
        <Block n="06" k="Fair by design" band="end">
          <h2 className="text-[clamp(36px,4.6vw,58px)] leading-[1.06] tracking-[-0.03em]">No neighbourhood is left waiting. No rupee buys priority.</h2>
          <div className="grid gap-6 border-t pt-6 md:grid-cols-[1fr_auto_1fr] md:items-center" style={{ borderColor: C.iron }}>
            <div><Label color={C.lime}>Rescue dispatch</Label><p className="mt-2 text-[16px] leading-[1.55]">urgency × vulnerability × people × aging × verification × escalation × fairness (+ dam risk)</p></div>
            <div className="text-center text-[11.5px] uppercase" style={{ fontFamily: MONO, color: C.ash }}><div className="text-[28px]" style={{ color: C.bone }}>→</div>one-way · k ≥ 5 · aggregated</div>
            <div><Label color={C.lime}>Relief & donations</Label><p className="mt-2 text-[16px] leading-[1.55]">sees verified need — can never feed back. Enforced by an architecture test and a lint rule.</p></div>
          </div>
        </Block>

        {/* 07 — EVIDENCE */}
        <section data-seen="evidence" data-band="end" className="px-5 py-[104px] md:px-10" style={{ background: C.bg }}>
          <div className="mx-auto max-w-[1200px]">
            <div className="flex items-baseline justify-between border-b pb-4" style={{ borderColor: C.iron }}><Label>07 · Evidence, not adjectives</Label><Label>pnpm bench</Label></div>
            <div className="grid grid-cols-2 gap-y-10 py-10 md:grid-cols-4">
              <Big v={Math.round(nRuns)} k="seeded runs" />
              <Big v={`${tts.toFixed(1)}m`} k="CNP mean time-to-service" />
              <Big v={`${crit.toFixed(1)}m`} k="CNP critical time-to-service" />
              <Big v={`${rec.toFixed(1)}m`} k="cascade recovery" />
            </div>
            <ul className="max-w-[900px] space-y-2 text-[15px] leading-[1.55]" style={{ color: "#c9c7bb" }}>{(bench?.verdict ?? []).slice(1, 5).map((v) => <li key={v} className="flex gap-3"><span style={{ color: C.lime, fontFamily: MONO }}>—</span>{v}</li>)}</ul>
          </div>
        </section>

        {/* 08 — LEDGER */}
        <Block n="08" k="Radical transparency" band="end">
          <h2 className="text-[clamp(36px,4.6vw,58px)] leading-[1.06] tracking-[-0.03em]">Every rupee, every kit — on a ledger anyone can re-verify.</h2>
          <div className="grid gap-0 md:grid-cols-3">
            {[["Donated → received", "simulated money and in-kind, by verified campaign"], ["Allocated → dispatched", "per verified area, k-anonymous"], ["Distributed", "timestamped, attributed, SHA-256 hash-chained"]].map(([h, b]) => (
              <div key={h} className="border-t py-5 md:pr-6" style={{ borderColor: C.iron }}><div className="text-[20px]">{h}</div><p className="mt-1 text-[14px]" style={{ color: C.ash }}>{b}</p></div>
            ))}
          </div>
          <div><Btn href="/relief" kind="lime">Open the public ledger →</Btn></div>
        </Block>

        {/* 09 — APP */}
        <section data-band="end" className="px-5 py-[104px] md:px-10" style={{ background: C.bg }}>
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 md:grid-cols-2">
            <div data-reveal>
              <Label>09 · Mobile app</Label>
              <h2 className="mt-4 text-[clamp(40px,5.4vw,72px)] leading-[0.95] tracking-[-0.035em]">In your pocket.</h2>
              <p className="mt-5 max-w-[460px] text-[18px] leading-[1.62]" style={{ color: "#c9c7bb" }}>A native iPhone app (built, in the repo) and an installable web app: one-tap SOS with an offline queue, live flood alerts and river levels, live GPS to the team, and a rescuer mode with turn-by-turn to the victim.</p>
              <div className="mt-7 flex flex-wrap gap-3"><Btn href="/sos" kind="sos">Open the web app</Btn>{["App Store", "Google Play"].map((s) => <span key={s} aria-disabled className="cursor-not-allowed rounded-[3.6px] px-[18px] py-[14px] text-[13px] uppercase" style={{ fontFamily: MONO, color: C.ash, boxShadow: `inset 0 0 0 1px ${C.iron}` }}>{s} · listing soon</span>)}</div>
              <form className="mt-8 flex max-w-[460px] items-end gap-4" onSubmit={async (e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem("c") as HTMLInputElement).value; const r = await fetch("/api/relief/notify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contact: v }) }); if (r.ok) setNotify(true); }}>
                <label className="flex-1">
                  <span className="text-[11px] uppercase" style={{ fontFamily: MONO, color: C.ash }}>Email or phone</span>
                  <input name="c" required className="mt-1 h-11 w-full border-b bg-transparent text-[16px] outline-none placeholder:text-[#84837b]" style={{ borderColor: C.iron, color: C.bone }} placeholder="you@example.org" />
                </label>
                <button className="rounded-[3.6px] px-[18px] py-[12px] text-[13px] uppercase" style={{ fontFamily: MONO, background: C.lime, color: C.bg }}>{notify ? "✓ Noted" : "Notify me"}</button>
              </form>
              <p className="mt-2 text-[11px]" style={{ fontFamily: MONO, color: C.ash }}>Stored only as a salted hash. Mocked — nothing is sent.</p>
            </div>
            <Phone frame={f} />
          </div>
        </section>

        <footer className="border-t px-5 pb-12 pt-[86px] md:px-10" style={{ background: C.bg, borderColor: C.iron }}>
          <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="text-[22px]">FloodSetu</div>
              <p className="mt-3 max-w-[460px] text-[14px] leading-[1.6]" style={{ color: C.ash }}>Code-E-Manipal 2.0 · LearnIt × MUJ · Track 06 Multi-Agent Systems · PS 27. A simulation with synthetic data — Jalnagar and its dams are fictional; no live feeds, real victims or real payments.</p>
            </div>
            <ul className="space-y-2 text-[13px] uppercase" style={{ fontFamily: MONO }}>{[["/control", "Control room"], ["/sos", "SOS"], ["/rescuer", "Rescuer"]].map(([h, l]) => <li key={h}><a href={h} className="hover:opacity-70">{l}</a></li>)}</ul>
            <ul className="space-y-2 text-[13px] uppercase" style={{ fontFamily: MONO }}>{[["/relief", "Public ledger"], ["/awareness", "Flood safety"], ["/admin", "Admin"], ["/design", "Design system"]].map(([h, l]) => <li key={h}><a href={h} className="hover:opacity-70">{l}</a></li>)}</ul>
          </div>
        </footer>
      </main>
    </div>
  );
}

function LiveStat({ k, v, lime }: { k: string; v: React.ReactNode; lime?: boolean }) {
  return (
    <div>
      <dt className="uppercase" style={{ color: C.ash }}>{k}</dt>
      <dd className="mt-1 text-[13px]" style={{ color: lime ? C.lime : C.bone }}>{v}</dd>
    </div>
  );
}

function Block({ n, k, band, children }: { n: string; k: string; band: string; children: React.ReactNode }) {
  return (
    <section data-band={band} className="px-5 py-[104px] md:px-10" style={{ background: C.bg }}>
      <div data-reveal className="mx-auto flex max-w-[1200px] flex-col gap-10">
        <div className="flex items-baseline justify-between border-b pb-4" style={{ borderColor: C.iron }}>
          <Label>{n} · {k}</Label>
          <Label>FloodSetu</Label>
        </div>
        {children}
      </div>
    </section>
  );
}

function Band({ band, caption, children, seenKey, right }: { band: string; caption: string; children: React.ReactNode; seenKey?: string; right?: boolean }) {
  return (
    <section data-band={band} data-seen={seenKey} className={`flex min-h-[86dvh] items-end px-5 pb-10 md:px-10 ${right ? "justify-end" : ""}`}>
      <div className="w-full max-w-[560px] p-5" style={{ background: "rgba(19,20,14,0.86)", boxShadow: `inset 0 0 0 1px ${C.iron}` }}>
        <Label color={C.lime}>{caption}</Label>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

function Big({ v, k }: { v: React.ReactNode; k: string }) {
  return (
    <div>
      <div className="text-[clamp(40px,5vw,65px)] font-light leading-none" style={{ fontFamily: MONO }}>{v}</div>
      <div className="mt-3 text-[12px] uppercase" style={{ fontFamily: MONO, color: C.ash }}>{k}</div>
    </div>
  );
}

function Phone({ frame }: { frame: Frame | null }) {
  const unit = frame?.agents.find((a) => a.type === "boat" && a.status === "en_route");
  const cards = [
    { t: "FS-7K3Q · team assigned", s: `${unit?.id ?? "B-1"} · ETA 11 min`, x: "-62%", y: "10%", r: -2.5 },
    { t: "Phone silent 90 s", s: "Kept at last location · CRITICAL", x: "60%", y: "26%", r: 2 },
    { t: "EOS-04 flood map", s: "acquired 07:13 · 1h 50m old", x: "-56%", y: "60%", r: -1.5 },
    { t: "Safe · Shanti Nagar School", s: "6 people delivered", x: "58%", y: "76%", r: 2.5 },
  ];
  return (
    <div data-reveal className="relative mx-auto h-[560px] w-[264px]">
      <div className="absolute inset-0 rounded-[40px] p-3" style={{ background: "#0d0e09", boxShadow: `0 0 0 1px ${C.iron}` }}>
        <div className="h-full overflow-hidden rounded-[30px] p-4" style={{ background: C.bg }}>
          <div className="mx-auto h-5 w-24 rounded-full bg-black" />
          <div className="mt-8 grid place-items-center">
            <div className="grid h-32 w-32 place-items-center rounded-full text-[32px] font-semibold text-white" style={{ background: C.sos }}>SOS</div>
            <div className="mt-4 w-full rounded-[3.6px] py-2.5 text-center text-[11px] uppercase text-white" style={{ fontFamily: MONO, background: "#ff2d55" }}>I’m in the water — send now</div>
          </div>
          <div className="mt-6 space-y-2 text-[11.5px]" style={{ fontFamily: MONO }}>
            {["Received", "Verifying", "Team assigned", "Rescue in progress", "Safe"].map((s, i) => <div key={s} className="flex items-center gap-2"><span className="h-3 w-3 rounded-[2px]" style={{ background: i < 3 ? C.lime : "#2a2b24" }} /><span style={{ color: i < 3 ? C.bone : C.ash }}>{s}</span></div>)}
          </div>
        </div>
      </div>
      {cards.map((c) => (
        <div key={c.t} className="absolute w-[220px] rounded-[3.6px] p-3 text-[12px]" style={{ left: "50%", top: c.y, transform: `translateX(calc(-50% + ${c.x})) rotate(${c.r}deg)`, background: C.bone, color: C.bg, boxShadow: `inset 3px 0 0 ${C.lime === "#ebfc72" ? "#13140e" : C.lime}` }}>
          <div style={{ fontFamily: MONO }} className="text-[11.5px] uppercase">{c.t}</div>
          <div className="mt-0.5 text-[12px]" style={{ color: "#55544c" }}>{c.s}</div>
        </div>
      ))}
    </div>
  );
}
