"use client";
import { useCallback, useEffect, useState } from "react";
import { MiniMap } from "@/components/MiniMap";
import { Badge, cx, Icon } from "@/components/ui";
import { LangToggle, pick, useT, type Lang } from "@/lib/i18n";
import { autoFlush, deviceId, enqueue, list, subscribe, type OutboxItem } from "@/lib/outbox";

const L = {
  en: { title: "Rescuer", signIn: "Sign in as your unit", otp: "Use mobile OTP", demo: "Demo: pick a unit", current: "Current task", none: "No assignment — standing by", accept: "Accept", enroute: "En route", onsite: "On site", picked: "Picked up", dropped: "Dropped at shelter", unable: "Unable", report: "Report field conditions", road: "Road blocked", water: "Water level", bridge: "Bridge damaged", why: "Why you?", people: "people", needs: "Needs", eta: "ETA", fuel: "Fuel", cap: "Capacity left", available: "Available", stale: "Last known — control room link stale", queued: "queued", sent: "sent", log: "Sent from this phone", reason: "Reason", r1: "Boat engine trouble", r2: "Route impassable", r3: "Crew injured", r4: "Out of fuel", signOut: "Sign out" },
  hi: { title: "बचावकर्मी", signIn: "अपनी यूनिट से साइन इन करें", otp: "मोबाइल OTP", demo: "डेमो: यूनिट चुनें", current: "मौजूदा काम", none: "कोई काम नहीं — तैयार रहें", accept: "स्वीकार", enroute: "रास्ते में", onsite: "मौके पर", picked: "लोगों को लिया", dropped: "आश्रय पर छोड़ा", unable: "असमर्थ", report: "हालात बताएँ", road: "सड़क बंद", water: "पानी का स्तर", bridge: "पुल क्षतिग्रस्त", why: "आप ही क्यों?", people: "लोग", needs: "ज़रूरतें", eta: "समय", fuel: "ईंधन", cap: "बची जगह", available: "उपलब्ध", stale: "आख़िरी जानकारी — कंट्रोल रूम से संपर्क पुराना", queued: "कतार में", sent: "भेजा", log: "इस फ़ोन से भेजा", reason: "कारण", r1: "इंजन ख़राब", r2: "रास्ता बंद", r3: "टीम घायल", r4: "ईंधन ख़त्म", signOut: "साइन आउट" },
} as const;

interface Unit {
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
  route?: [number, number][];
  task: null | { id: string; kind: string; incident?: string; people: number; urgency: string; needs: string[]; phase: string; eta: number | null; site: { x: number; y: number }; shelter?: { id: string; name: string }; why?: string };
}
type FieldBody = { kind: string; taskId?: string; incident?: string; reason?: string; note?: string; count?: number; lamport: number; deviceId: string; clientAt: string };

const csrf = () => document.cookie.match(/(?:^|; )js_csrf=([^;]+)/)?.[1] ?? "";
let lamport = 0;
const nextLamport = () => {
  try {
    lamport = Math.max(lamport, Number(localStorage.getItem("floodsetu.lamport") ?? 0)) + 1;
    localStorage.setItem("floodsetu.lamport", String(lamport));
  } catch {
    lamport++;
  }
  return lamport;
};

export default function RescuerApp() {
  const { lang, setLang } = useT();
  const l = pick(L, lang);
  const [me, setMe] = useState<{ role: string | null; unit?: string } | null>(null);
  const [data, setData] = useState<{ unit: Unit | null; asOf: string | null; stale: boolean; liveSos: { id: string; people: number; text?: string; handle: string }[] } | null>(null);
  const [outbox, setOutbox] = useState<OutboxItem<FieldBody>[]>([]);
  const [unableOpen, setUnableOpen] = useState(false);
  const [available, setAvailable] = useState(true);
  const [pickCount, setPickCount] = useState(0);

  const loadMe = useCallback(() => fetch("/api/auth/me").then((r) => r.json()).then(setMe), []);
  useEffect(() => {
    loadMe();
    const un = subscribe(() => list<FieldBody>().then((x) => setOutbox(x.filter((i) => i.url.includes("rescuer")))));
    list<FieldBody>().then((x) => setOutbox(x.filter((i) => i.url.includes("rescuer"))));
    const stop = autoFlush(() => ({ "x-csrf": csrf() }));
    return () => (un(), stop());
  }, [loadMe]);
  useEffect(() => {
    if (me?.role !== "rescuer") return;
    let alive = true;
    const pull = () => fetch("/api/dispatch/rescuer").then((r) => (r.ok ? r.json() : null)).then((d) => alive && d && setData(d)).catch(() => {});
    pull();
    const i = setInterval(pull, 2500);
    return () => ((alive = false), clearInterval(i));
  }, [me]);

  const send = async (kind: string, extra: Partial<FieldBody> = {}) => {
    const body: FieldBody = { kind, taskId: data?.unit?.task?.id, incident: data?.unit?.task?.incident, lamport: nextLamport(), deviceId: deviceId(), clientAt: new Date().toISOString(), ...extra };
    await enqueue(`field-${body.deviceId}-${body.lamport}`, "/api/dispatch/rescuer", body, { "x-csrf": csrf() });
    if (navigator.vibrate) navigator.vibrate(30);
  };

  if (!me) return <Shell lang={lang} setLang={setLang} title={l.title}><p className="py-10 text-center text-mute">…</p></Shell>;
  if (me.role !== "rescuer") return <SignIn l={l} lang={lang} setLang={setLang} onDone={loadMe} />;
  const u = data?.unit;
  const task = u?.task;
  return (
    <Shell lang={lang} setLang={setLang} title={`${l.title} · ${me.unit}`} right={<button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); loadMe(); }} className="text-[12px] text-mute">{l.signOut}</button>}>
      {data?.stale ? <p className="mb-3 rounded-[12px] bg-[var(--warn-dim)] p-3 text-[13px] text-warn">{l.stale} · {data.asOf ? new Date(data.asOf).toLocaleTimeString() : "—"}</p> : null}
      <section className="rounded-[20px] bg-panel p-4 shadow-[var(--panel-edge)]">
        <div className="flex items-center justify-between">
          <span className="label">{l.current}</span>
          {u ? <Badge tone={u.connected ? "safe" : "verify"} icon={u.connected ? "wifi" : "wifiOff"}>{u.status.replace("_", " ")}</Badge> : null}
        </div>
        {task ? (
          <>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={task.urgency === "critical" ? "sos" : task.urgency === "urgent" ? "warn" : "info"} icon={task.urgency === "critical" ? "siren" : "alert"}>{task.urgency.replace("_", " ")}</Badge>
                  <span className="mono text-[12px] text-mute">{task.kind}</span>
                </div>
                <div className="mono mt-1 text-[30px] font-semibold text-hi">{task.incident ?? task.id}</div>
                <div className="text-[15px] text-hi">{task.people} {l.people}{task.needs.length ? ` · ${task.needs.join(", ")}` : ""}</div>
              </div>
              <div className="text-right">
                <div className="label">{l.eta}</div>
                <div className="num mono text-[34px] leading-none text-hi">{task.eta ?? "0"}<span className="text-[13px] text-mute"> min</span></div>
                <div className="mono mt-1 text-[11px] text-mute">{task.phase.replace("_", " ")}{task.shelter ? ` → ${task.shelter.id}` : ""}</div>
              </div>
            </div>
            <div className="mt-3"><MiniMap site={task.site} team={{ x: u!.x, y: u!.y }} teamType={u!.type} route={u!.route} height={190} focus={{ x: (task.site.x + u!.x) / 2, y: (task.site.y + u!.y) / 2 }} /></div>
            {task.why ? <p className="mt-3 flex gap-2 text-[13px] text-text"><Icon name="info" size={16} className="mt-0.5 shrink-0 text-info" /><span><b className="text-hi">{l.why}</b> {task.why}</span></p> : null}
            {data?.liveSos.length ? <ul className="mt-2 space-y-1">{data.liveSos.map((s) => <li key={s.id} className="rounded-[10px] bg-raised px-3 py-2 text-[12.5px] text-text"><span className="mono text-hi">{s.id}</span> · {s.people} · {s.text ?? ""} <span className="mono text-dim">({s.handle})</span></li>)}</ul> : null}
          </>
        ) : (
          <p className="py-6 text-center text-[15px] text-mute">{l.none}</p>
        )}
      </section>
      {task ? (
        <section className="mt-3 grid grid-cols-2 gap-2">
          <Act onClick={() => send("ack")} icon="check" primary>{l.accept}</Act>
          <Act onClick={() => send("status", { note: "en route" })} icon="route">{l.enroute}</Act>
          <Act onClick={() => send("status", { note: "on site" })} icon="pin">{l.onsite}</Act>
          <div className="flex min-h-[56px] items-center gap-1 rounded-[14px] bg-panel px-2 shadow-[var(--panel-edge)]">
            <button onClick={() => setPickCount((c) => Math.max(0, c - 1))} className="grid h-10 w-10 place-items-center rounded-[10px] bg-raised" aria-label="fewer"><Icon name="minus" size={16} /></button>
            <span className="num mono w-8 text-center text-[18px] text-hi">{pickCount}</span>
            <button onClick={() => setPickCount((c) => Math.min(u!.capacity, c + 1))} className="grid h-10 w-10 place-items-center rounded-[10px] bg-raised" aria-label="more"><Icon name="plus" size={16} /></button>
            <button onClick={() => send("picked_up", { count: pickCount })} className="ml-auto h-10 rounded-[10px] bg-cta px-3 text-[12px] font-medium text-cta-text">{l.picked}</button>
          </div>
          <Act onClick={() => send("dropped", { count: u?.onboard ?? 0 })} icon="shelter">{l.dropped}</Act>
          <Act onClick={() => setUnableOpen(true)} icon="x" danger>{l.unable}</Act>
        </section>
      ) : null}
      {unableOpen ? (
        <section className="mt-3 rounded-[16px] bg-panel p-3 shadow-[inset_0_0_0_1px_var(--sos)]">
          <div className="label mb-2">{l.reason}</div>
          <div className="grid grid-cols-2 gap-2">{[l.r1, l.r2, l.r3, l.r4].map((r) => <button key={r} onClick={() => (send("unable", { reason: r }), setUnableOpen(false))} className="min-h-[52px] rounded-[12px] bg-raised px-3 text-[13px] text-hi">{r}</button>)}</div>
        </section>
      ) : null}
      <section className="mt-4">
        <h2 className="label mb-2">{l.report}</h2>
        <div className="grid grid-cols-3 gap-2">
          <Act onClick={() => send("road_blocked")} icon="x">{l.road}</Act>
          <Act onClick={() => send("water_level", { note: "water rising here" })} icon="waves">{l.water}</Act>
          <Act onClick={() => send("bridge_damaged")} icon="bridge">{l.bridge}</Act>
        </div>
      </section>
      {u ? (
        <section className="mt-4 grid grid-cols-3 gap-2 rounded-[16px] bg-panel p-3 shadow-[var(--panel-edge)]">
          <div><div className="label">{l.cap}</div><div className="num mono text-[18px] text-hi">{u.capacity - u.onboard}/{u.capacity}</div></div>
          <div><div className="label">{l.fuel}</div><div className={cx("num mono text-[18px]", u.fuel !== null && u.fuel < 60 ? "text-warn" : "text-hi")}>{u.fuel !== null ? `${u.fuel}m` : "—"}</div></div>
          <label className="flex flex-col"><span className="label">{l.available}</span><input type="checkbox" checked={available} onChange={(e) => (setAvailable(e.target.checked), send("status", { note: e.target.checked ? "available" : "unavailable" }))} className="mt-1 h-6 w-6 accent-[var(--safe)]" /></label>
        </section>
      ) : null}
      {outbox.length ? (
        <section className="mt-4">
          <h2 className="label mb-2">{l.log}</h2>
          <ul className="space-y-1">{outbox.slice(0, 8).map((o) => <li key={o.id} className="flex items-center justify-between rounded-[10px] bg-raised px-3 py-2 text-[12px]"><span className="text-text">{o.body.kind.replace("_", " ")}{o.body.reason ? ` · ${o.body.reason}` : ""}{o.body.count ? ` · ${o.body.count}` : ""}</span><Badge tone={o.state === "received" ? "safe" : "warn"} icon={o.state === "received" ? "check" : "hourglass"}>{o.state === "received" ? l.sent : l.queued}</Badge></li>)}</ul>
        </section>
      ) : null}
    </Shell>
  );
}

function Act({ children, icon, onClick, primary, danger }: { children: React.ReactNode; icon: string; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cx("flex min-h-[56px] items-center justify-center gap-2 rounded-[14px] px-3 text-[14px] font-medium active:scale-[0.98]", primary ? "bg-cta text-cta-text" : danger ? "bg-[var(--sos-dim)] text-sos" : "bg-panel text-hi shadow-[var(--panel-edge)]")}>
      <Icon name={icon} size={18} />
      {children}
    </button>
  );
}

function Shell({ children, lang, setLang, title, right }: { children: React.ReactNode; lang: Lang; setLang: (l: Lang) => void; title: string; right?: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-[480px] bg-bg px-4 pb-10 pt-[max(12px,env(safe-area-inset-top))]">
      <header className="mb-3 flex items-center justify-between py-2">
        <div className="flex items-center gap-2"><Icon name="boat" size={22} className="text-hi" /><span className="text-[16px] font-semibold text-hi">{title}</span></div>
        <div className="flex items-center gap-2">{right}<LangToggle lang={lang} setLang={setLang} /></div>
      </header>
      {children}
    </div>
  );
}

function SignIn({ l, lang, setLang, onDone }: { l: (typeof L)["en"] | (typeof L)["hi"]; lang: Lang; setLang: (x: Lang) => void; onDone: () => void }) {
  const units = ["B-1", "B-2", "B-3", "B-4", "B-5", "B-6", "B-7", "B-8", "G-01", "G-02", "G-03", "G-04", "G-05", "G-06", "G-07", "G-08", "G-09", "G-10", "G-11", "G-12", "G-13", "G-14", "G-15"];
  return (
    <Shell lang={lang} setLang={setLang} title={l.title}>
      <h1 className="mt-4 text-[22px] font-semibold text-hi">{l.signIn}</h1>
      <a href="/login?next=/rescuer" className="mt-4 flex h-14 items-center justify-center gap-2 rounded-full bg-cta text-[15px] font-medium text-cta-text"><Icon name="phone" size={18} />{l.otp}</a>
      <p className="mt-2 text-center text-[12px] text-mute">Rescuer phones are pre-registered by the admin (demo: 9000000001 → B-1 … 9000000008 → B-8).</p>
      <h2 className="label mb-2 mt-6">{l.demo}</h2>
      <div className="grid grid-cols-4 gap-2">
        {units.map((u) => (
          <button key={u} onClick={async () => { await fetch("/api/auth/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "rescuer", unit: u }) }); onDone(); }} className="mono min-h-[48px] rounded-[12px] bg-panel text-[13px] text-hi shadow-[var(--panel-edge)]">
            {u}
          </button>
        ))}
      </div>
    </Shell>
  );
}
