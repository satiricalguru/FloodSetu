"use client";
import { clock, type CascadeEntry, type Frame, type SimEvent } from "@jalsetu/engine";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import type { FromWorker } from "@/lib/protocol";
import type { SceneState } from "./Scene";

const Scene = dynamic(() => import("./Scene"), { ssr: false });

interface Bench {
  overall: Record<string, Record<string, number>>;
  verdict: string[];
  seeds: number;
  scenarios: string[];
}

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

const Pill = ({ href, children, variant = "ghost", icon }: { href: string; children: React.ReactNode; variant?: "ghost" | "primary" | "sos"; icon?: string }) => (
  <a href={href} className={`group inline-flex h-12 items-center gap-2 rounded-full px-5 text-[14px] font-medium backdrop-blur-[4px] transition-opacity hover:opacity-90 ${variant === "primary" ? "bg-cta text-cta-text" : variant === "sos" ? "bg-sos text-white" : "bg-[rgba(8,11,15,0.45)] text-hi shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]"}`}>
    <span className="font-mono text-[12px] opacity-70 transition-transform group-hover:translate-x-0.5">{icon ?? "+"}</span>
    {children}
  </a>
);

export default function Landing() {
  const state = useRef<SceneState>({ progress: 0, frame: null, awards: [] });
  const [webgl, setWebgl] = useState<"pending" | "on" | "off">("pending");
  const [quality, setQuality] = useState({ dpr: 1.5, rain: 3000 });
  const [live, setLive] = useState<{ tick: number; rescued: number; open: number; awards: number; frame: Frame | null; cascade: CascadeEntry | null; last: SimEvent[] }>({ tick: 0, rescued: 0, open: 0, awards: 0, frame: null, cascade: null, last: [] });
  const [coords, setCoords] = useState("25.4012°N 85.0034°E");
  const [bench, setBench] = useState<Bench | null>(null);
  const [inView, setInView] = useState<Record<string, boolean>>({});
  const worker = useRef<Worker | null>(null);
  const tripled = useRef(false);
  const [notify, setNotify] = useState<"idle" | "ok">("idle");

  // capability + preference gate: reduced motion or no WebGL → static fallback (content never locked behind animation)
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (reduce || !gl) return setWebgl("off");
    setWebgl("on");
    import("detect-gpu")
      .then(({ getGPUTier }) => getGPUTier({ benchmarksURL: "/gpu-benchmarks-missing" }))
      .then((g) => {
        // offline-first: without the benchmark file detect-gpu reports FALLBACK — use a core-count heuristic instead
        if ((g.type as string) === "FALLBACK" || (g.type as string) === "BENCHMARK_FETCH_FAILED") throw new Error("no benchmark");
        setQuality(g.tier >= 3 ? { dpr: 2, rain: 4500 } : g.tier === 2 ? { dpr: 1.5, rain: 2600 } : { dpr: 1, rain: 1200 });
      })
      .catch(() => setQuality({ dpr: Math.min(2, window.devicePixelRatio), rain: navigator.hardwareConcurrency >= 8 ? 4000 : 2000 }));
  }, []);

  // smooth scroll + scroll-driven progress (Lenis + GSAP ScrollTrigger)
  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([import("lenis"), import("gsap"), import("gsap/ScrollTrigger")]);
      gsap.registerPlugin(ScrollTrigger);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const lenis = reduce ? null : new Lenis({ lerp: 0.09 });
      const raf = (t: number) => lenis?.raf(t * 1000);
      if (lenis) {
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);
      }
      const st = ScrollTrigger.create({ start: 0, end: "max", onUpdate: (s) => (state.current.progress = s.progress) });
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => gsap.fromTo(el, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 82%" } }));
      cleanup = () => {
        st.kill();
        ScrollTrigger.getAll().forEach((t) => t.kill());
        if (lenis) gsap.ticker.remove(raf);
        lenis?.destroy();
      };
    })();
    return () => cleanup();
  }, []);

  // a real engine instance drives the beacons, boats and bid arcs
  useEffect(() => {
    const w = new Worker(new URL("../../workers/sim.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    let awards = 0;
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type !== "frame") return;
      state.current.frame = m.frame;
      const aw = m.events.filter((x) => x.type === "AWARD");
      awards += aw.length;
      state.current.awards.push(...aw.slice(-4));
      const cas = [...m.cascades].reverse().find((c) => c.causes.length >= 3) ?? null;
      setLive((l) => ({ tick: m.frame.tick, rescued: m.frame.kpis.rescued, open: m.frame.kpis.openSos, awards, frame: m.frame, cascade: cas ?? l.cascade, last: [...m.events.filter((x) => ["AWARD", "SOS_RECEIVED", "DECOMMIT", "SOS_MERGED"].includes(x.type)).slice(-3), ...l.last].slice(0, 4) }));
      if (m.done) w.postMessage({ type: "init", scenarioId: "baseline-monsoon", strategy: "cnp" }), w.postMessage({ type: "play" });
    };
    w.postMessage({ type: "init", scenarioId: "baseline-monsoon", strategy: "cnp", seed: 9 });
    w.postMessage({ type: "speed", value: 6 });
    w.postMessage({ type: "runTo", tick: 70 });
    w.postMessage({ type: "play" });
    return () => w.terminate();
  }, []);

  // ticking mono coordinates (INVERSA-style)
  useEffect(() => {
    const i = setInterval(() => setCoords(`${(25.4 + Math.random() * 0.06).toFixed(4)}°N ${(85.0 + Math.random() * 0.09).toFixed(4)}°E`), 900);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    fetch("/bench/results.json").then((r) => (r.ok ? r.json() : null)).then(setBench).catch(() => {});
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setInView((v) => ({ ...v, [(e.target as HTMLElement).dataset.section!]: true }))), { threshold: 0.35 });
    document.querySelectorAll("[data-section]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // section 4: trigger the real triple failure when the reader arrives
  useEffect(() => {
    if (inView.fail && !tripled.current) {
      tripled.current = true;
      worker.current?.postMessage({ type: "inject", event: { type: "TRIPLE_FAILURE", bridge: "auto", agent: "auto", shelter: "auto", walkIns: 60 } });
    }
  }, [inView.fail]);

  const o = bench?.overall;
  const nRuns = useCount(bench ? bench.seeds * bench.scenarios.length * 4 : 0, !!inView.impact);
  const cTts = useCount(o?.cnp?.tts_mean ?? 0, !!inView.impact);
  const cCrit = useCount(o?.central?.tts_critical ?? 0, !!inView.impact);
  const cInv = useCount(0, !!inView.impact);
  const cRescued = useCount(o?.cnp?.rescued_pct ?? 0, !!inView.impact);

  return (
    <div className="relative bg-[#05070a] text-text">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        {webgl === "on" ? <Scene state={state} quality={quality} /> : <StaticBackdrop />}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(5,7,10,0.65))]" />
      </div>

      <nav className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 md:px-8">
        <a href="/" className="flex items-center gap-2 rounded-full bg-[rgba(8,11,15,0.45)] px-3 py-1.5 backdrop-blur-[4px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
          <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden><path d="M10 40c6 0 6-4 11-4s5 4 11 4 6-4 11-4 5 4 11 4" fill="none" stroke="#2ec5d3" strokeWidth="5" strokeLinecap="round" /><path d="M14 30 L32 14 L50 30" fill="none" stroke="#eceae3" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="32" cy="30" r="5" fill="#ff5a36" /></svg>
          <span className="text-[14px] font-semibold text-hi">JalSetu</span>
        </a>
        <div className="hidden items-center gap-1 rounded-full bg-[rgba(8,11,15,0.45)] p-1 font-mono text-[11px] uppercase tracking-[0.08em] backdrop-blur-[4px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] md:flex">
          {[["/control", "Control room"], ["/relief", "Ledger"], ["/awareness", "Safety"], ["/design", "System"]].map(([h, l]) => <a key={h} href={h} className="rounded-full px-3 py-1.5 text-text hover:bg-[rgba(255,255,255,0.08)] hover:text-hi">{l}</a>)}
        </div>
        <a href="/sos" className="rounded-full bg-sos px-4 py-2 text-[13px] font-semibold text-white">SOS</a>
      </nav>

      <main className="relative z-10">
        {/* 1 · HERO */}
        <section data-section="hero" className="flex min-h-[100dvh] flex-col justify-end px-5 pb-16 md:px-10 md:pb-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-water">PS 27 · Flood rescue dispatch · {coords}</p>
          <h1 className="mt-4 max-w-[1100px] text-[clamp(48px,10vw,148px)] font-normal leading-[0.9] tracking-[-0.045em] text-[#f4f3e8]">The water is rising.</h1>
          <p className="mt-6 max-w-[620px] text-[17px] leading-relaxed text-[#c9d1dc] md:text-[19px]">
            JalSetu coordinates rescue boats, ground teams, shelters and thousands of SOS as <b className="font-medium text-hi">autonomous agents</b> that negotiate under partial information — and re-plan in seconds when bridges fall, boats fail and shelters fill.
          </p>
          <p className="mt-3 font-mono text-[12px] text-mute">“When the water rises, every second negotiates.”</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Pill href="/sos" variant="sos" icon="!">Request help (SOS)</Pill>
            <Pill href="/control" variant="primary" icon="→">Open Control Room</Pill>
            <Pill href="/rescuer">Join as rescuer</Pill>
          </div>
          <div className="mt-10 flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.1em] text-mute">
            <span>Live engine T+{String(live.tick).padStart(3, "0")}</span>
            <span>{live.open} open SOS</span>
            <span>{live.rescued} rescued</span>
            <span className="hidden md:inline">scroll ↓</span>
          </div>
        </section>

        {/* 2 · SIGNALS */}
        <Section id="signals" k="01 · Signals in the dark" title="Every SOS is a signal — and many are the same signal.">
          <p>Reports arrive by app, SMS and field radio, each tagged with source, confidence and time. Duplicates are <b>merged, never rejected</b>: forty phones from one building is one forty-person incident.</p>
          <div className="relative mt-8 h-[220px]">
            {(live.frame?.incidents.filter((i) => i.status !== "resolved").slice(-4) ?? []).map((i, k) => (
              <div key={i.id} className="absolute rounded-[20px] bg-[rgba(13,17,23,0.85)] px-4 py-3 text-[13px] shadow-[inset_3px_0_0_var(--sos),inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur" style={{ left: `${(k % 2) * 46 + (k > 1 ? 8 : 0)}%`, top: `${Math.floor(k / 2) * 52 + (k % 2) * 12}%`, transform: `rotate(${[-2.5, 2, 1.5, -3][k]}deg)` }}>
                <div className="font-mono text-[11px] text-mute">{i.id} · {i.nbhd}</div>
                <div className="text-hi">{i.people} people · {i.urgency.replace("_", " ")} · {i.verification.replace("_", " ")}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* 3 · NEGOTIATE */}
        <Section id="negotiate" k="02 · Agents negotiate" title="Incidents announce. Boats bid. The best offer wins — in the open.">
          <p>Each incident runs a Contract-Net auction. Agents bid their time-to-service from <b>their own</b> map of the flood. Awards weigh urgency, vulnerability, waiting time and fairness. Every decision carries a reason code and a “Why?”.</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            <Metric label="Live tick" value={clock(live.tick)} />
            <Metric label="Awards so far" value={live.awards} />
            <Metric label="People rescued" value={live.rescued} />
          </div>
          <ul className="mt-4 space-y-1 font-mono text-[12px] text-text">{live.last.map((e) => <li key={e.seq}>› {e.msg}</li>)}</ul>
        </Section>

        {/* 4 · FAILS */}
        <Section id="fail" k="03 · When everything fails at once" title="Bridge down. Boat dark. Shelter full. Re-planned.">
          <p>Scroll here and a real triple failure is injected into the engine: the busiest bridge collapses, the busiest boat fails with people aboard, and the fullest shelter overflows — in the same tick.</p>
          <div className="mt-6 rounded-[16px] bg-[rgba(13,17,23,0.88)] p-5 shadow-[inset_0_0_0_1px_rgba(255,90,54,0.4)] backdrop-blur">
            {live.cascade ? (
              <ol className="space-y-2 font-serif text-[15px] leading-relaxed text-hi">{live.cascade.explanation.slice(0, 7).map((l, i) => <li key={i}>{l}</li>)}</ol>
            ) : (
              <p className="font-mono text-[12px] text-mute">Injecting… the cascade report appears here.</p>
            )}
          </div>
        </Section>

        {/* 5 · FAIR */}
        <Section id="fair" k="04 · Fair by design" title="No neighbourhood is left waiting. No rupee buys priority.">
          <p>Priority ages with waiting time, so no request starves. A fairness term lifts neighbourhoods that are falling behind. We measure Jain’s index and the worst-neighbourhood P90 on every run.</p>
          <div className="mt-6 grid items-center gap-3 rounded-[16px] bg-[rgba(13,17,23,0.85)] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur md:grid-cols-[1fr_auto_1fr]">
            <div><div className="font-mono text-[11px] uppercase tracking-[0.1em] text-water">Rescue dispatch</div><p className="mt-1 text-[14px] text-hi">urgency × vulnerability × people × aging × verification × escalation × fairness</p></div>
            <div className="flex flex-col items-center font-mono text-[10px] text-mute"><span className="text-[22px] text-hi">⟶</span>one-way · k≥5 · aggregated</div>
            <div><div className="font-mono text-[11px] uppercase tracking-[0.1em] text-warn">Relief & donations</div><p className="mt-1 text-[14px] text-hi">sees verified need — <b>can never feed back</b> (architecture-tested)</p></div>
          </div>
        </Section>

        {/* 6 · TRUST */}
        <Section id="trust" k="05 · Trust without friction" title="SOS needs no login. Trust is earned after.">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["siren", "Guest SOS", "Device id + optional phone. Queued offline, sent when the network returns."],
              ["phone", "Mobile OTP", "6 digits, 5-min expiry, exponential backoff. Aarogya Setu lineage."],
              ["link", "Rotating handles", "Per-request pseudonyms instead of a static ID — the fix to a documented criticism."],
              ["eye", "Flag, never reject", "Explainable risk → review queue. Critical SOS are dispatched regardless."],
            ].map(([ic, h, b]) => (
              <div key={h} className="rounded-[16px] bg-[rgba(13,17,23,0.85)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur">
                <Icon name={ic} size={20} className="text-hi" />
                <div className="mt-2 text-[15px] font-medium text-hi">{h}</div>
                <p className="mt-1 text-[13px] text-text">{b}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 7 · DAWN · LEDGER */}
        <section data-section="ledger" className="flex min-h-[100dvh] items-center px-5 md:px-10">
          <div data-reveal className="w-full max-w-[1100px] rounded-[20px] bg-[rgba(255,255,255,0.93)] p-6 text-[#45556c] shadow-[0_30px_80px_rgba(12,39,100,0.18)] md:p-10" data-surface="ledger">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#62748e]">06 · Radical transparency · the water recedes</p>
            <h2 className="mt-2 font-serif text-[clamp(30px,4.4vw,56px)] font-semibold leading-[1.05] text-[#0c2764]">Every rupee, every kit — traced on a hash-chained public ledger.</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[["Donated → received", "in-kind & simulated money, by campaign"], ["Allocated → dispatched", "per verified area, k-anonymous"], ["Distributed", "timestamped, attributed, verifiable"]].map(([h, b], i) => (
                <div key={h} className="rounded-[12px] bg-[#f6f8fb] p-4 shadow-[inset_0_0_0_1px_#e2e8f0]"><div className="h-1 w-10 rounded" style={{ background: ["#00b595", "#5077ff", "#ff7b1b"][i] }} /><div className="mt-3 font-semibold text-[#0f172b]">{h}</div><div className="text-[13px]">{b}</div></div>
              ))}
            </div>
            <a href="/relief" className="mt-6 inline-flex h-11 items-center rounded-[12px] bg-[#0c2764] px-5 text-[14px] font-semibold text-white">Open the public ledger →</a>
          </div>
        </section>

        {/* 8 · IMPACT */}
        <section data-section="impact" className="flex min-h-[90dvh] items-center px-5 md:px-10">
          <div data-reveal className="w-full max-w-[1100px]">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">07 · Evidence, not adjectives · from pnpm bench</p>
            <h2 className="mt-2 max-w-[820px] text-[clamp(30px,4.2vw,58px)] leading-[1.02] tracking-[-0.03em] text-hi">Measured on every run. Including where we lose.</h2>
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
              <Metric big label="Benchmark runs" value={Math.round(nRuns)} />
              <Metric big label="CNP mean time-to-service" value={`${cTts.toFixed(1)}m`} />
              <Metric big label="Central critical TTS (it wins)" value={`${cCrit.toFixed(1)}m`} />
              <Metric big label="CNP people rescued" value={`${cRescued.toFixed(0)}%`} />
              <Metric big label="Invariant violations" value={Math.round(cInv)} />
            </div>
            <ul className="mt-6 max-w-[900px] space-y-1.5 text-[14px] text-text">{(bench?.verdict ?? []).slice(1, 5).map((v) => <li key={v} className="flex gap-2"><span className="text-dim">—</span>{v}</li>)}</ul>
            <a href="/control?scenario=triple-failure" className="mt-6 inline-flex text-[14px] text-hi underline underline-offset-4">Compare strategies yourself →</a>
          </div>
        </section>

        {/* 9 · COMING SOON */}
        <section data-section="app" className="flex min-h-[100dvh] items-center px-5 md:px-10">
          <div className="grid w-full max-w-[1100px] items-center gap-10 md:grid-cols-[1fr_1fr]">
            <div data-reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">08 · Mobile app</p>
              <h2 className="mt-2 text-[clamp(34px,5vw,64px)] leading-[0.98] tracking-[-0.03em] text-hi">Coming soon to your phone.</h2>
              <p className="mt-4 max-w-[440px] text-[16px] text-text">Native SOS with offline queue, SMS fallback and live team tracking. The PWA works today: <a href="/sos" className="text-hi underline">jalsetu/sos</a>.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["App Store", "Google Play"].map((s) => <span key={s} aria-disabled className="flex h-12 cursor-not-allowed items-center gap-2 rounded-[12px] px-4 text-[13px] text-mute shadow-[inset_0_0_0_1px_var(--hairline-strong)]"><Icon name="download" size={16} />{s} · Coming soon</span>)}
              </div>
              <form className="mt-5 flex max-w-[420px] gap-2" onSubmit={async (e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem("c") as HTMLInputElement).value; const r = await fetch("/api/relief/notify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contact: v }) }); if (r.ok) setNotify("ok"); }}>
                <input name="c" required placeholder="email or phone" aria-label="Email or phone for launch notification" className="h-12 flex-1 rounded-full bg-[rgba(13,17,23,0.85)] px-5 text-[14px] text-hi outline-none shadow-[inset_0_0_0_1px_var(--hairline-strong)] placeholder:text-dim" />
                <button className="h-12 rounded-full bg-cta px-5 text-[14px] font-medium text-cta-text">{notify === "ok" ? "✓ Noted" : "Notify me"}</button>
              </form>
              <p className="mt-2 text-[11px] text-dim">Stored only as a salted hash. Mocked — no messages are sent.</p>
            </div>
            <Phone frame={live.frame} />
          </div>
        </section>

        <footer className="border-t border-[rgba(255,255,255,0.08)] bg-[#05070a] px-5 py-10 text-[13px] md:px-10">
          <div className="flex flex-wrap justify-between gap-6">
            <div>
              <div className="font-semibold text-hi">JalSetu</div>
              <p className="mt-1 max-w-[520px] text-mute">Built for Code-E-Manipal 2.0 · LearnIt × MUJ · Track 06 Multi-Agent Systems · PS 27. A simulation with synthetic data: Jalnagar is fictional; no live feeds, real victims or real payments.</p>
            </div>
            <div className="flex gap-6 font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
              <a href="/control">Control</a><a href="/sos">SOS</a><a href="/rescuer">Rescuer</a><a href="/relief">Ledger</a><a href="/admin">Admin</a><a href="/design">Design</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Section({ id, k, title, children }: { id: string; k: string; title: string; children: React.ReactNode }) {
  return (
    <section data-section={id} className="flex min-h-[100dvh] items-center px-5 md:px-10">
      <div data-reveal className="max-w-[760px] rounded-[20px] bg-[rgba(5,7,10,0.62)] p-6 text-[16px] leading-relaxed text-[#c9d1dc] backdrop-blur-[6px] md:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-water">{k}</p>
        <h2 className="mt-2 text-[clamp(28px,4vw,52px)] leading-[1.02] tracking-[-0.03em] text-[#f4f3e8]">{title}</h2>
        <div className="mt-4 [&_b]:font-medium [&_b]:text-hi">{children}</div>
      </div>
    </section>
  );
}

function Metric({ label, value, big }: { label: string; value: React.ReactNode; big?: boolean }) {
  return (
    <div className="rounded-[14px] bg-[rgba(13,17,23,0.82)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-mute">{label}</div>
      <div className={`num mt-1 font-mono text-hi ${big ? "text-[32px]" : "text-[22px]"}`}>{value}</div>
    </div>
  );
}

function Phone({ frame }: { frame: Frame | null }) {
  const unit = frame?.agents.find((a) => a.type === "boat" && a.status === "en_route");
  const cards = [
    { t: "JS-7K3Q · Team assigned", s: `${unit?.id ?? "B-1"} · ETA 11 min`, c: "var(--info)", r: -3, x: "-58%", y: "8%" },
    { t: "Merged with 3 nearby reports", s: "Everyone is counted", c: "var(--verify)", r: 2.5, x: "62%", y: "22%" },
    { t: "Bridge B2 closed", s: "Route re-planned via Ghat 3", c: "var(--sos)", r: -2, x: "-52%", y: "62%" },
    { t: "Safe · Shanti Nagar School", s: "6 people delivered", c: "var(--safe)", r: 3, x: "58%", y: "74%" },
  ];
  return (
    <div data-reveal className="relative mx-auto h-[560px] w-[270px] [perspective:1200px]">
      <div className="absolute inset-0 rounded-[44px] bg-[#0d1117] p-3 shadow-[0_0_0_2px_#222c3a,0_40px_100px_rgba(46,197,211,0.18)] [transform:rotateY(-12deg)_rotateX(6deg)]">
        <div className="h-full overflow-hidden rounded-[34px] bg-bg p-4">
          <div className="mx-auto h-5 w-24 rounded-full bg-black" />
          <div className="mt-8 grid place-items-center">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-sos text-[34px] font-bold text-white shadow-[0_0_0_10px_rgba(255,90,54,0.15)]">SOS</div>
          </div>
          <div className="mt-8 space-y-2">
            {["Received", "Verifying", "Team assigned", "Rescue in progress", "Safe"].map((s, i) => <div key={s} className="flex items-center gap-2 text-[12px]"><span className={`h-4 w-4 rounded-full ${i < 3 ? "bg-cta" : "bg-raised"}`} /><span className={i < 3 ? "text-hi" : "text-dim"}>{s}</span></div>)}
          </div>
        </div>
      </div>
      {cards.map((c) => (
        <div key={c.t} className="absolute w-[230px] rounded-[20px] bg-white p-3 text-[12px] text-black shadow-[0_8px_30px_rgba(0,0,0,0.25)]" style={{ left: "50%", top: c.y, transform: `translateX(calc(-50% + ${c.x})) rotate(${c.r}deg)`, boxShadow: `inset 3px 0 0 ${c.c}, 0 10px 30px rgba(0,0,0,.3)` }}>
          <div className="font-semibold">{c.t}</div>
          <div className="text-[#737373]">{c.s}</div>
        </div>
      ))}
    </div>
  );
}

function StaticBackdrop() {
  return (
    <svg className="h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#05070a" /><stop offset="1" stopColor="#0b2a33" /></linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#g)" />
      {Array.from({ length: 9 }).map((_, i) => <path key={i} d={`M0 ${520 + i * 22} C 300 ${480 + i * 22}, 600 ${580 + i * 22}, 1200 ${500 + i * 22}`} stroke="#2ec5d3" strokeOpacity={0.25 - i * 0.02} fill="none" />)}
      {[[300, 420], [520, 470], [760, 430], [880, 520], [420, 560]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={6} fill="#ff5a36" opacity={0.85} />)}
    </svg>
  );
}
