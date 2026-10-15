"use client";
import { NBHD_DEFS } from "@floodsetu/engine";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MiniMap } from "@/components/MiniMap";
import { Badge, cx, Icon } from "@/components/ui";
import { LangToggle, useT, type Key } from "@/lib/i18n";
import { autoFlush, deviceId, enqueue, list, subscribe, type OutboxItem } from "@/lib/outbox";

type Urgency = "critical" | "urgent" | "needs_help";
const NEEDS = [
  ["elderly", "elderly"],
  ["child", "baby"],
  ["pregnant", "pregnant"],
  ["disabled", "wheelchair"],
  ["medical", "medical"],
  ["injured", "injured"],
  ["pets", "pet"],
] as const;
const STEPS = ["received", "verification_pending", "assigned", "rescue_in_progress", "resolved"] as const;

interface CitizenView {
  id: string;
  status: string;
  createdAt: string;
  people: number;
  urgency: Urgency;
  timeline: { status: string; at: string; note?: string }[];
  mergedInto?: string;
  incidentId?: string;
  team: null | { role: string; callsign: string; eta: number | null; position: { x: number; y: number } | null; updatedAt: string };
  site: { x: number; y: number; nbhd: string; snapped: boolean };
  liveAsOf: string | null;
  stale: boolean;
  tips: string[];
  thread: { at: string; from: string; role: string; text: string }[];
  deviceLost: { at: string; lastSeenAt: string } | null;
  battery: number | null;
}
type SosBody = { clientId: string; people: number; urgency: Urgency; needs: string[]; text?: string; phone?: string; lat?: number; lng?: number; accuracy?: number; nbhd?: string; deviceId: string; lang: "en" | "hi"; hasPhoto?: boolean; hasVoice?: boolean; createdAt: string; altPhone?: string; battery?: number };

/** Battery Status API (Chromium/Android) — a supporting signal; undefined elsewhere. */
async function batteryLevel(): Promise<number | undefined> {
  try {
    const b = await (navigator as unknown as { getBattery?: () => Promise<{ level: number }> }).getBattery?.();
    return b?.level;
  } catch {
    return undefined;
  }
}

function getGps(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }), () => res(null), { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 });
  });
}

function useOnline() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(navigator.onLine);
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener("online", a);
    window.addEventListener("offline", b);
    return () => (window.removeEventListener("online", a), window.removeEventListener("offline", b));
  }, []);
  return on;
}

const ago = (iso: string | null, t: (k: Key) => string) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m <= 0 ? `<1 ${t("min")}` : `${m} ${t("min")} ${t("ago")}`;
};

export default function SosApp() {
  const { t, lang, setLang } = useT();
  const online = useOnline();
  const [screen, setScreen] = useState<{ s: "home" } | { s: "form" } | { s: "status"; id: string }>({ s: "home" });
  const [items, setItems] = useState<OutboxItem<SosBody>[]>([]);
  useEffect(() => {
    const refresh = () => list<SosBody>().then(setItems);
    refresh();
    const un = subscribe(refresh);
    const stop = autoFlush();
    return () => (un(), stop());
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-bg px-4 pb-8 pt-[max(12px,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between py-2">
        <button onClick={() => setScreen({ s: "home" })} className="flex items-center gap-2" aria-label="FloodSetu home">
          <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden><path d="M10 40c6 0 6-4 11-4s5 4 11 4 6-4 11-4 5 4 11 4" fill="none" stroke="#2ec5d3" strokeWidth="5" strokeLinecap="round" /><path d="M14 30 L32 14 L50 30" fill="none" stroke="#eceae3" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="32" cy="30" r="5" fill="#ff5a36" /></svg>
          <span className="text-[17px] font-semibold text-hi">FloodSetu</span>
        </button>
        <div className="flex items-center gap-2">
          <span className={cx("flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[11px]", online ? "text-safe" : "bg-[var(--warn-dim)] text-warn")} role="status">
            <Icon name={online ? "wifi" : "wifiOff"} size={13} /> {online ? t("online") : t("offline")}
          </span>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
      </header>
      {screen.s === "home" ? <Home t={t} lang={lang} items={items} onSos={() => setScreen({ s: "form" })} onOpen={(id) => setScreen({ s: "status", id })} /> : null}
      {screen.s === "form" ? <Form t={t} lang={lang} onBack={() => setScreen({ s: "home" })} onSent={(id) => setScreen({ s: "status", id })} /> : null}
      {screen.s === "status" ? <Status t={t} item={items.find((i) => i.id === screen.id)} onBack={() => setScreen({ s: "home" })} onNew={() => setScreen({ s: "form" })} /> : null}
    </div>
  );
}

function Home({ t, lang, items, onSos, onOpen }: { t: (k: Key) => string; lang: "en" | "hi"; items: OutboxItem<SosBody>[]; onSos: () => void; onOpen: (id: string) => void }) {
  const [sending, setSending] = useState(false);
  // drowning: no form, one tap — critical + in_water, GPS if we can get it in 4 s, last-used area otherwise
  const inWater = async () => {
    if (sending) return;
    setSending(true);
    const clientId = crypto.randomUUID();
    const [gps, battery] = await Promise.all([getGps(), batteryLevel()]);
    let nbhd = "GHT";
    try {
      nbhd = localStorage.getItem("floodsetu.area") ?? "GHT";
    } catch {}
    const body: SosBody = { clientId, people: 1, urgency: "critical", needs: ["in_water"], text: lang === "hi" ? "पानी में हूँ — तुरंत मदद" : "I am in the water — need help NOW", ...(gps ?? {}), nbhd, deviceId: deviceId(), lang, createdAt: new Date().toISOString(), battery };
    await enqueue(clientId, "/api/dispatch/sos", body);
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    onOpen(clientId);
  };
  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center py-8">
        <button onClick={onSos} className="group relative grid h-[220px] w-[220px] place-items-center rounded-full bg-sos text-white shadow-[0_0_0_10px_rgba(255,90,54,0.15),0_0_0_22px_rgba(255,90,54,0.07),0_20px_60px_rgba(255,90,54,0.35)] transition-transform active:scale-95" aria-label={`${t("sos")} — ${t("sosHint")}`}>
          <span className="absolute inset-0 animate-[pulse-ring_2.4s_ease-out_infinite] rounded-full border-2 border-sos motion-reduce:hidden" aria-hidden />
          <span className="text-center">
            <span className="block text-[54px] font-bold leading-none tracking-tight">{t("sos")}</span>
            <span className="mt-2 block text-[14px] font-medium opacity-90">{t("sosHint")}</span>
          </span>
        </button>
        <button onClick={inWater} disabled={sending} className="mt-7 flex h-14 w-full max-w-[320px] items-center justify-center gap-2 rounded-full bg-[#ff2d55] text-[16px] font-semibold text-white shadow-[0_0_0_6px_rgba(255,45,85,0.18)] active:scale-[0.98]" aria-label={t("inWaterAria")}>
          <Icon name="waves" size={20} /> {sending ? t("sending") : t("inWater")}
        </button>
        <p className="mt-2 max-w-[320px] text-center text-[11.5px] text-mute">{t("inWaterSub")}</p>
        <p className="mt-5 text-center text-[13px] text-mute">{t("sosSub")}</p>
        <a href="tel:112" className="mt-3 flex h-12 items-center gap-2 rounded-full px-5 text-[15px] text-hi shadow-[inset_0_0_0_1px_var(--hairline-strong)]">
          <Icon name="phone" size={18} /> {t("call112")}
        </a>
      </div>
      {items.length ? (
        <section aria-label={t("myRequests")} className="mb-4">
          <h2 className="label mb-2">{t("myRequests")}</h2>
          <ul className="space-y-2">
            {items.map((i) => {
              const v = (i.response as { request?: CitizenView } | undefined)?.request;
              return (
                <li key={i.id}>
                  <button onClick={() => onOpen(i.id)} className="flex min-h-[56px] w-full items-center gap-3 rounded-[14px] bg-panel px-4 text-left shadow-[var(--panel-edge)]">
                    <Icon name="siren" size={18} className={i.body.urgency === "critical" ? "text-sos" : "text-warn"} />
                    <div className="min-w-0 flex-1">
                      <div className="mono text-[14px] text-hi">{v?.id ?? "…"}</div>
                      <div className="text-[12px] text-mute">{i.body.people} · {t(i.body.urgency)} · {new Date(i.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    <OutboxBadge t={t} state={i.state} />
                    <Icon name="chevronR" size={16} className="text-dim" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <nav className="grid grid-cols-3 gap-2" aria-label="Help">
        <a href="/awareness#shelters" className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[14px] bg-panel text-[12px] text-text shadow-[var(--panel-edge)]"><Icon name="shelter" size={20} />{t("shelters")}</a>
        <a href="/awareness" className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[14px] bg-panel text-[12px] text-text shadow-[var(--panel-edge)]"><Icon name="shield" size={20} />{t("safety")}</a>
        <a href="/awareness#helplines" className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[14px] bg-panel text-[12px] text-text shadow-[var(--panel-edge)]"><Icon name="phone" size={20} />{t("helplines")}</a>
      </nav>
      <p className="mt-4 flex gap-2 text-[11.5px] leading-relaxed text-mute"><Icon name="lock" size={14} className="mt-0.5 shrink-0" />{t("privacy")}</p>
      <a href="/login?next=/sos" className="mt-3 self-center text-[12px] text-mute underline underline-offset-4">{t("signIn")}</a>
    </main>
  );
}

function OutboxBadge({ t, state }: { t: (k: Key) => string; state: string }) {
  if (state === "received") return <Badge tone="safe" icon="checkCircle">{t("received")}</Badge>;
  if (state === "sent") return <Badge tone="info" icon="send">{t("sent")}</Badge>;
  if (state === "failed") return <Badge tone="sos" icon="alert">!</Badge>;
  return <Badge tone="warn" icon="hourglass">Queued</Badge>;
}

function Form({ t, lang, onBack, onSent }: { t: (k: Key) => string; lang: "en" | "hi"; onBack: () => void; onSent: (id: string) => void }) {
  const [people, setPeople] = useState(1);
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [needs, setNeeds] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [nbhd, setNbhd] = useState("GHT");
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "asking" | "ok" | "no">("idle");
  const [photo, setPhoto] = useState(false);
  const [voice, setVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const askGps = useCallback(() => {
    if (!navigator.geolocation) return setGpsState("no");
    setGpsState("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => (setGps({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }), setGpsState("ok")),
      () => setGpsState("no"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, []);
  useEffect(() => askGps(), [askGps]);
  const submit = async () => {
    if (!urgency || busy) return;
    setBusy(true);
    const clientId = crypto.randomUUID();
    const digits = (v: string) => (v.replace(/\D/g, "").length >= 10 ? v.replace(/\D/g, "").slice(-12) : undefined);
    const body: SosBody = { clientId, people, urgency, needs, text: text || undefined, phone: digits(phone), altPhone: digits(altPhone), ...(gps ?? {}), nbhd, deviceId: deviceId(), lang, hasPhoto: photo, hasVoice: voice, createdAt: new Date().toISOString(), battery: await batteryLevel() };
    try {
      localStorage.setItem("floodsetu.area", nbhd);
    } catch {}
    await enqueue(clientId, "/api/dispatch/sos", body);
    onSent(clientId);
  };
  return (
    <main className="flex flex-1 flex-col gap-5 py-2">
      <button onClick={onBack} className="flex items-center gap-1 self-start text-[13px] text-mute"><Icon name="chevronR" size={14} className="rotate-180" />{t("back")}</button>
      <section>
        <h2 className="mb-2 text-[15px] font-medium text-hi">{t("urgency")}</h2>
        <div className="grid gap-2">
          {(["critical", "urgent", "needs_help"] as const).map((u) => {
            const tone = u === "critical" ? "sos" : u === "urgent" ? "warn" : "info";
            const sel = urgency === u;
            return (
              <button key={u} onClick={() => setUrgency(u)} aria-pressed={sel} className={cx("flex min-h-[64px] items-center gap-3 rounded-[16px] px-4 text-left transition-colors", sel ? `bg-[var(--${tone}-dim)] shadow-[inset_0_0_0_2px_var(--${tone})]` : "bg-panel shadow-[var(--panel-edge)]")} style={sel && tone === "info" ? { background: "rgba(127,178,255,0.14)", boxShadow: "inset 0 0 0 2px var(--info)" } : undefined}>
                <Icon name={u === "critical" ? "siren" : u === "urgent" ? "alert" : "hand"} size={24} className={`text-${tone}`} />
                <span>
                  <span className="block text-[16px] font-semibold text-hi">{t(u)}</span>
                  <span className="block text-[12.5px] text-mute">{t(`${u}Sub` as Key)}</span>
                </span>
                {sel ? <Icon name="checkCircle" size={22} className={`ml-auto text-${tone}`} /> : null}
              </button>
            );
          })}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-[15px] font-medium text-hi">{t("people")}</h2>
        <div className="flex items-center justify-between rounded-[16px] bg-panel p-2 shadow-[var(--panel-edge)]">
          <button onClick={() => setPeople((p) => Math.max(1, p - 1))} className="grid h-14 w-14 place-items-center rounded-[12px] bg-raised text-hi" aria-label="Fewer people"><Icon name="minus" size={22} /></button>
          <output className="num mono text-[34px] text-hi" aria-live="polite">{people}</output>
          <button onClick={() => setPeople((p) => Math.min(200, p + 1))} className="grid h-14 w-14 place-items-center rounded-[12px] bg-raised text-hi" aria-label="More people"><Icon name="plus" size={22} /></button>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-[15px] font-medium text-hi">{t("needs")}</h2>
        <div className="grid grid-cols-4 gap-2">
          {NEEDS.map(([n, icon]) => {
            const on = needs.includes(n);
            return (
              <button key={n} onClick={() => setNeeds((x) => (on ? x.filter((y) => y !== n) : [...x, n]))} aria-pressed={on} className={cx("flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-[14px] text-[11.5px]", on ? "bg-cta text-cta-text" : "bg-panel text-text shadow-[var(--panel-edge)]")}>
                <Icon name={icon} size={22} />
                {t(n as Key)}
              </button>
            );
          })}
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-[15px] font-medium text-hi">{t("location")}</h2>
        <button onClick={askGps} className={cx("flex min-h-[52px] w-full items-center gap-3 rounded-[14px] px-4 text-left text-[14px]", gpsState === "ok" ? "bg-[var(--safe-dim)] text-safe" : "bg-panel text-text shadow-[var(--panel-edge)]")}>
          <Icon name="pin" size={20} />
          {gpsState === "ok" ? `${t("gpsOk")} · ±${Math.round(gps!.accuracy)} m` : gpsState === "asking" ? "…" : gpsState === "no" ? t("gpsNo") : t("useGps")}
        </button>
        <label className="block">
          <span className="label">{t("area")}</span>
          <select value={nbhd} onChange={(e) => setNbhd(e.target.value)} className="mt-1 h-12 w-full rounded-[12px] bg-panel px-3 text-[15px] text-hi shadow-[var(--panel-edge)]">
            {NBHD_DEFS.map((n) => <option key={n.id} value={n.id}>{lang === "hi" ? n.nameHi : n.name}</option>)}
          </select>
        </label>
      </section>
      <section className="space-y-2">
        <label className="block">
          <span className="text-[15px] font-medium text-hi">{t("details")}</span>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} placeholder={t("detailsPh")} rows={2} className="mt-2 w-full rounded-[12px] bg-panel p-3 text-[15px] text-hi shadow-[var(--panel-edge)] outline-none placeholder:text-dim" />
        </label>
        <div className="flex gap-2">
          <button onClick={() => setPhoto(!photo)} aria-pressed={photo} className={cx("flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] text-[13px]", photo ? "bg-cta text-cta-text" : "bg-panel text-text shadow-[var(--panel-edge)]")}><Icon name="camera" size={16} />{t("photo")}</button>
          <button onClick={() => setVoice(!voice)} aria-pressed={voice} className={cx("flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] text-[13px]", voice ? "bg-cta text-cta-text" : "bg-panel text-text shadow-[var(--panel-edge)]")}><Icon name="mic" size={16} />{t("voice")}</button>
        </div>
        <label className="block">
          <span className="label">{t("phone")}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="98xxxxxxxx" className="mono mt-1 h-12 w-full rounded-[12px] bg-panel px-3 text-[16px] text-hi shadow-[var(--panel-edge)] outline-none placeholder:text-dim" />
        </label>
        <label className="block">
          <span className="label">{t("altPhone")}</span>
          <input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} inputMode="tel" placeholder="98xxxxxxxx" className="mono mt-1 h-12 w-full rounded-[12px] bg-panel px-3 text-[16px] text-hi shadow-[var(--panel-edge)] outline-none placeholder:text-dim" />
          <span className="mt-1 block text-[11.5px] text-mute">{t("altPhoneSub")}</span>
        </label>
      </section>
      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-bg via-bg to-transparent px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-4">
        <button onClick={submit} disabled={!urgency || busy} className="flex h-16 w-full items-center justify-center gap-2 rounded-full bg-sos text-[18px] font-semibold text-white disabled:opacity-40">
          <Icon name="send" size={20} />
          {busy ? t("sending") : t("send")}
        </button>
        {!urgency ? <p className="mt-2 text-center text-[12px] text-mute">↑ {t("urgency")}</p> : null}
      </div>
    </main>
  );
}

function Status({ t, item, onBack, onNew }: { t: (k: Key) => string; item?: OutboxItem<SosBody>; onBack: () => void; onNew: () => void }) {
  const initial = (item?.response as { request?: CitizenView } | undefined)?.request;
  const [view, setView] = useState<CitizenView | undefined>(initial);
  const [msg, setMsg] = useState("");
  const id = initial?.id;
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const pull = async () => {
      try {
        const b = await batteryLevel();
        const r = await fetch(`/api/dispatch/sos/${id}?device=${encodeURIComponent(deviceId())}${b !== undefined ? `&battery=${b.toFixed(2)}` : ""}`);
        if (r.ok && alive) setView(((await r.json()) as { request: CitizenView }).request);
      } catch {}
    };
    pull();
    const i = setInterval(pull, 3000);
    return () => ((alive = false), clearInterval(i));
  }, [id]);
  useEffect(() => setView((v) => v ?? initial), [initial]);
  const stepIdx = useMemo(() => Math.max(0, STEPS.indexOf((view?.status ?? "received") as (typeof STEPS)[number])), [view]);
  if (!item) return <p className="py-10 text-center text-mute">…</p>;
  const v = view;
  return (
    <main className="flex flex-1 flex-col gap-4 py-2">
      <button onClick={onBack} className="flex items-center gap-1 self-start text-[13px] text-mute"><Icon name="chevronR" size={14} className="rotate-180" />{t("back")}</button>
      <section className="rounded-[20px] bg-panel p-4 shadow-[var(--panel-edge)]">
        <div className="flex items-center justify-between">
          <span className="label">{t("yourRequest")}</span>
          <OutboxBadge t={t} state={item.state} />
        </div>
        <div className="mono mt-1 text-[32px] font-semibold tracking-tight text-hi">{v?.id ?? "FS-····"}</div>
        <div className="text-[13px] text-mute">{item.body.people} · {t(item.body.urgency)}</div>
        {item.state === "queued" ? <p className="mt-3 rounded-[10px] bg-[var(--warn-dim)] p-3 text-[13px] text-warn">{t("queued")}</p> : null}
        {v?.battery !== null && v?.battery !== undefined && v.battery <= 0.15 ? <p className="mt-3 flex gap-2 rounded-[10px] bg-[var(--warn-dim)] p-3 text-[13px] text-warn"><Icon name="alert" size={16} className="shrink-0" />{t("batteryLow")} ({Math.round(v.battery * 100)}%)</p> : null}
        <p className="mt-3 flex gap-2 text-[11.5px] leading-relaxed text-mute"><Icon name="shield" size={14} className="mt-0.5 shrink-0" />{t("phoneDies")}</p>
        {v?.mergedInto ? <p className="mt-3 flex gap-2 rounded-[10px] bg-[rgba(127,178,255,0.12)] p-3 text-[13px] text-info"><Icon name="link" size={16} className="shrink-0" />{t("merged")} · {v.mergedInto}</p> : null}
      </section>
      <ol className="rounded-[20px] bg-panel p-4 shadow-[var(--panel-edge)]" aria-label="Request progress">
        {STEPS.map((s, i) => {
          const done = v && i <= stepIdx;
          const cur = v && i === stepIdx;
          const at = v?.timeline.find((x) => x.status === s)?.at;
          return (
            <li key={s} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cx("grid h-7 w-7 place-items-center rounded-full", done ? (s === "resolved" ? "bg-safe text-black" : "bg-cta text-cta-text") : "bg-raised text-dim shadow-[inset_0_0_0_1px_var(--hairline)]")}>
                  {done ? <Icon name="check" size={14} stroke={2.5} /> : <span className="mono text-[11px]">{i + 1}</span>}
                </span>
                {i < STEPS.length - 1 ? <span className={cx("my-1 h-5 w-px", done && i < stepIdx ? "bg-cta" : "bg-line")} /> : null}
              </div>
              <div className="pb-2">
                <div className={cx("text-[14px]", cur ? "font-semibold text-hi" : done ? "text-text" : "text-dim")}>{t(`status_${s}` as Key)}</div>
                {at ? <div className="mono text-[11px] text-mute">{new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div> : null}
              </div>
            </li>
          );
        })}
      </ol>
      {v?.team ? (
        <section className="rounded-[20px] bg-panel p-4 shadow-[var(--panel-edge)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="label">{t("team")}</div>
              <div className="mt-1 text-[15px] font-medium text-hi">{v.team.role}</div>
              <div className="mono text-[12px] text-mute">{v.team.callsign}</div>
            </div>
            <div className="text-right">
              <div className="label">{t("eta")}</div>
              <div className="num mono text-[30px] text-hi">{v.team.eta ?? "—"}<span className="ml-1 text-[13px] text-mute">{t("min")}</span></div>
            </div>
          </div>
          <div className="mt-3">
            <MiniMap site={v.site} team={v.team.position} teamType={v.team.callsign.startsWith("B") ? "boat" : "ground"} height={180} />
          </div>
          <p className={cx("mono mt-2 text-[11px]", v.stale ? "text-warn" : "text-mute")}>{v.stale ? t("stale") : `${t("updated")} ${ago(v.liveAsOf, t)}`}</p>
        </section>
      ) : v ? (
        <section className="rounded-[20px] bg-panel p-4 shadow-[var(--panel-edge)]">
          <MiniMap site={v.site} height={150} />
          <p className={cx("mono mt-2 text-[11px]", v.stale ? "text-warn" : "text-mute")}>{v.stale ? t("stale") : `${t("updated")} ${ago(v.liveAsOf, t)}`}</p>
        </section>
      ) : null}
      {v?.tips?.length ? (
        <section className="rounded-[20px] bg-panel p-4 shadow-[var(--panel-edge)]">
          <h2 className="label mb-2">{t("whileYouWait")}</h2>
          <ul className="space-y-2">{v.tips.map((tip) => <li key={tip} className="flex gap-2 text-[14px] leading-snug text-hi"><Icon name="shield" size={16} className="mt-0.5 shrink-0 text-safe" />{tip}</li>)}</ul>
        </section>
      ) : null}
      {v ? (
        <section className="rounded-[20px] bg-panel p-4 shadow-[var(--panel-edge)]">
          <h2 className="label mb-2">{t("message")}</h2>
          <ul className="mb-2 space-y-1.5">{v.thread.map((m, i) => <li key={i} className={cx("rounded-[12px] px-3 py-2 text-[13px]", m.role === "citizen" ? "ml-8 bg-raised text-hi" : "mr-8 bg-[rgba(127,178,255,0.12)] text-hi")}><span className="mono block text-[10px] text-mute">{m.role === "citizen" ? t("you") : m.from}</span>{m.text}</li>)}</ul>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!msg.trim()) return;
              await fetch(`/api/dispatch/sos/${v.id}/thread`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: msg, deviceId: deviceId() }) }).catch(() => {});
              setMsg("");
            }}
          >
            <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t("messagePh")} className="h-11 flex-1 rounded-[12px] bg-raised px-3 text-[14px] text-hi outline-none placeholder:text-dim" />
            <button className="grid h-11 w-11 place-items-center rounded-[12px] bg-cta text-cta-text" aria-label="Send message"><Icon name="send" size={16} /></button>
          </form>
        </section>
      ) : null}
      <button onClick={onNew} className="h-12 rounded-full text-[14px] text-hi shadow-[inset_0_0_0_1px_var(--hairline-strong)]">{t("newRequest")}</button>
    </main>
  );
}
