"use client";
import { useEffect, useState } from "react";

const STEPS = ["received", "verification_pending", "assigned", "rescue_in_progress", "resolved"] as const;
const LABEL: Record<string, string> = { received: "Received", verification_pending: "Verifying", assigned: "Team assigned", rescue_in_progress: "Rescue in progress", resolved: "Safe" };

/** Family view of an SOS: status steps only — no location, no names, no people details (the API serves the limited view). */
export default function TrackClient({ id }: { id: string }) {
  const [s, setS] = useState<{ status: string; timeline: { status: string; at: string }[] } | null | "missing">(null);
  useEffect(() => {
    let alive = true;
    const pull = () => fetch(`/api/dispatch/sos/${id}`).then((r) => (r.status === 404 ? "missing" : r.json().then((d) => d.request))).then((d) => alive && setS(d)).catch(() => {});
    pull();
    const i = setInterval(pull, 5000);
    return () => ((alive = false), clearInterval(i));
  }, [id]);
  const idx = s && s !== "missing" ? STEPS.indexOf(s.status as (typeof STEPS)[number]) : -1;
  return (
    <main className="mx-auto min-h-dvh max-w-[480px] bg-[#0b0d10] px-5 py-10 text-[#eceae3]">
      <div className="flex items-center gap-2 text-[15px]"><img src="/icon.svg" alt="" width={24} height={24} />FloodSetu</div>
      <h1 className="mt-8 font-mono text-[34px] font-semibold">{id}</h1>
      <p className="mt-1 text-[14px] text-[#8a8f98]">Family tracking — status only. The exact location is shared only with the rescue team.</p>
      {s === "missing" ? (
        <p className="mt-8 text-[15px]">No request with this ID.</p>
      ) : (
        <ol className="mt-8 space-y-4">
          {STEPS.map((st, i) => {
            const at = s?.timeline.find((t) => t.status === st)?.at;
            return (
              <li key={st} className="flex items-center gap-3">
                <span className={`grid h-6 w-6 place-items-center rounded-full text-[12px] ${i <= idx ? "bg-[#00b595] text-black" : "bg-[#1c2026] text-[#8a8f98]"}`}>{i <= idx ? "✓" : ""}</span>
                <span className={i <= idx ? "text-[16px]" : "text-[16px] text-[#8a8f98]"}>{LABEL[st]}</span>
                {at ? <span className="ml-auto font-mono text-[12px] text-[#8a8f98]">{new Date(at).toLocaleTimeString()}</span> : null}
              </li>
            );
          })}
        </ol>
      )}
      <a href="tel:112" className="mt-10 flex h-12 items-center justify-center rounded-full border border-[#2a2f36] text-[15px]">Life-threatening? Call 112</a>
    </main>
  );
}
