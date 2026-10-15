"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Key } from "@/lib/i18n";

type Alert = { id: string; at: string; area: string; headline: string; text: string; severity: "Extreme" | "Severe" | "Moderate"; sender: string };
type Station = { id: string; name: string; river: string; stage: number | null; flow: number | null; trendCmHr: number; status: "normal" | "warning" | "danger" | "extreme" | "no_data"; danger: number; ageMin: number | null };

const SEEN = "floodsetu.alertsSeen";
const read = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? "[]");
  } catch {
    return [];
  }
};

/**
 * In-app flood alerts: polls the CAP-shaped alert feed (automatic river/dam alerts + operator broadcasts) and shows the
 * newest unseen one. If the user has allowed notifications, new alerts also raise a system notification.
 */
export function AlertBanner({ t }: { t: (k: Key) => string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const notified = useRef(new Set<string>());

  useEffect(() => {
    setSeen(read());
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    let alive = true;
    const pull = () =>
      fetch("/api/dispatch/broadcast")
        .then((r) => r.json())
        .then((d: { alerts: Alert[] }) => {
          if (!alive) return;
          const fresh = (d.alerts ?? []).filter((a) => Date.now() - Date.parse(a.at) < 6 * 3_600_000);
          setAlerts(fresh);
          if (typeof Notification !== "undefined" && Notification.permission === "granted")
            for (const a of fresh.filter((x) => Date.now() - Date.parse(x.at) < 120_000 && !notified.current.has(x.id) && !read().includes(x.id))) {
              notified.current.add(a.id);
              new Notification(a.headline, { body: a.text, tag: a.id, icon: "/icon-192.png" });
            }
        })
        .catch(() => {});
    pull();
    const i = setInterval(pull, 15_000);
    return () => ((alive = false), clearInterval(i));
  }, []);

  const top = alerts.find((a) => !seen.includes(a.id));
  const dismiss = (id: string) => {
    // closing the newest alert acknowledges every older one too — nobody should click through a backlog in a flood
    const next = [...new Set([...seen, id, ...alerts.map((a) => a.id)])].slice(-200);
    setSeen(next);
    try {
      localStorage.setItem(SEEN, JSON.stringify(next));
    } catch {}
  };
  if (!top) return null;
  const tone = top.severity === "Extreme" ? "bg-sos text-white" : top.severity === "Severe" ? "bg-[var(--warn-dim)] text-warn" : "bg-raised text-hi";
  return (
    <div role="alert" className={`mb-3 rounded-[16px] p-3 ${tone}`}>
      <div className="flex items-start gap-2">
        <Icon name="siren" size={18} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{t("floodAlert")} · {top.area} · {new Date(top.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="mt-0.5 text-[15px] font-semibold leading-snug">{top.headline}</div>
          <p className="mt-1 text-[13px] leading-snug opacity-90">{top.text}</p>
        </div>
        <button onClick={() => dismiss(top.id)} aria-label="Dismiss alert" className="grid h-9 w-9 shrink-0 place-items-center rounded-full opacity-80"><Icon name="x" size={16} /></button>
      </div>
      {perm === "default" ? (
        <button onClick={() => Notification.requestPermission().then(setPerm)} className="mt-2 text-[12.5px] font-medium underline underline-offset-2">{t("alertsOn")}</button>
      ) : null}
    </div>
  );
}

const STATUS_TONE: Record<Station["status"], string> = { normal: "text-safe", warning: "text-warn", danger: "text-sos", extreme: "text-sos", no_data: "text-mute" };

/** River monitoring at a glance: stage vs danger level, trend and flow for each gauge (live from the control room). */
export function RiverCard({ t }: { t: (k: Key) => string }) {
  const [st, setSt] = useState<{ stations: Station[]; stale: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    const pull = () => fetch("/api/river").then((r) => r.json()).then((d) => alive && setSt(d)).catch(() => {});
    pull();
    const i = setInterval(pull, 20_000);
    return () => ((alive = false), clearInterval(i));
  }, []);
  if (!st?.stations.length) return null;
  return (
    <section className="w-full rounded-[16px] bg-panel p-3 shadow-[var(--panel-edge)]" aria-label={t("riverNow")}>
      <div className="flex items-center justify-between">
        <span className="label flex items-center gap-1.5"><Icon name="waves" size={14} />{t("riverNow")}</span>
        {st.stale ? <span className="text-[11px] text-warn">{t("stale")}</span> : null}
      </div>
      <ul className="mt-2 space-y-1.5">
        {st.stations.map((g) => (
          <li key={g.id} className="flex items-baseline gap-2 text-[13px]">
            <span className="min-w-0 flex-1 truncate text-hi">{g.name}</span>
            <span className="mono whitespace-nowrap text-text">{g.stage !== null ? `${g.stage.toFixed(2)} m` : "—"}</span>
            <span className="mono whitespace-nowrap text-right text-[12px] text-mute">{g.trendCmHr > 2 ? `↑${g.trendCmHr}` : g.trendCmHr < -2 ? `↓${-g.trendCmHr}` : "→"}<span className="text-[10px]">cm/h</span></span>
            <span className={`w-[58px] shrink-0 text-right text-[10.5px] font-semibold uppercase ${STATUS_TONE[g.status]}`}>{g.status === "no_data" ? "no data" : g.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * While a request is active, keep sending GPS fixes (≥ 20 s apart or ≥ 30 m moved) so the team follows a person who has
 * to move — e.g. climbing to a roof or drifting. Stops on resolution or when the screen closes.
 */
export function useLiveGps(id: string | undefined, active: boolean, device: string) {
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    if (!id || !active || !navigator.geolocation) return;
    let last: { lat: number; lng: number; t: number } | null = null;
    const w = navigator.geolocation.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, t: Date.now() };
        const far = last ? Math.hypot((fix.lat - last.lat) * 111_000, (fix.lng - last.lng) * 111_000 * Math.cos((fix.lat * Math.PI) / 180)) : Infinity;
        if (last && fix.t - last.t < 20_000 && far < 30) return;
        last = fix;
        fetch(`/api/dispatch/sos/${id}/location`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device, lat: fix.lat, lng: fix.lng, accuracy: p.coords.accuracy }) })
          .then((r) => setSharing(r.ok))
          .catch(() => setSharing(false));
      },
      () => setSharing(false),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(w);
  }, [id, active, device]);
  return sharing;
}

/** Client-side cooldown memory: the last SOS this phone sent (any screen). */
export const LAST_SOS = "floodsetu.lastSos";
export function lastSos(): { clientId: string; at: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_SOS) ?? "null");
    return v && Date.now() - v.at < 60_000 ? v : null;
  } catch {
    return null;
  }
}
export function rememberSos(clientId: string) {
  try {
    localStorage.setItem(LAST_SOS, JSON.stringify({ clientId, at: Date.now() }));
  } catch {}
}
