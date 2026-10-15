"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";
import { LangToggle, useT } from "@/lib/i18n";
import { GUIDE } from "./text";

/** Flood-safety awareness (NDMA-aligned, RESEARCH §4.6) in all 13 UI languages. "Climate atlas in winter light" — light editorial surface. */
const SHELTERS = [
  ["S1", "Shanti Nagar Govt School", "Shanti Nagar", 160],
  ["S2", "Purani Basti Community Hall", "Purani Basti", 80],
  ["S3", "Rail Colony Stadium", "Rail Colony", 140],
  ["S4", "Unchi Pahadi College", "Unchi Pahadi", 200],
  ["S5", "District Hospital (medical)", "Shanti Nagar", 40],
  ["S6", "Ghat Tola Embankment Camp", "Ghat Tola", 60],
] as const;

export default function Awareness() {
  const { lang, setLang } = useT();
  const g = GUIDE[lang] ?? GUIDE.en!;
  const [alerts, setAlerts] = useState<{ id: string; at: string; headline: string; text: string; severity: string; area: string; sender: string }[]>([]);
  useEffect(() => {
    fetch("/api/dispatch/broadcast").then((r) => r.json()).then((d) => setAlerts(d.alerts ?? [])).catch(() => {});
  }, []);
  const cols: [string, string[], string][] = [[g.before, g.b, "#00b595"], [g.during, g.d, "#ff7b1b"], [g.after, g.a, "#5077ff"]];
  return (
    <div data-surface="ledger" className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-5">
        <a href="/" className="flex items-center gap-2 font-semibold text-[var(--text-hi)]"><Icon name="shield" size={18} />FloodSetu</a>
        <LangToggle lang={lang} setLang={setLang} />
      </header>
      <main className="mx-auto max-w-[1100px] px-5 pb-20">
        <h1 className="max-w-[760px] font-serif text-[40px] font-light leading-[1.08] text-[var(--text-hi)] md:text-[60px]">{g.title}</h1>
        <p className="mt-4 max-w-[620px] text-[17px] leading-relaxed">{g.lede}</p>
        <a href="/sos" className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[#d4381c] px-6 font-semibold text-white"><Icon name="siren" size={18} />{g.sos}</a>
        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {cols.map(([h, list, c]) => (
            <article key={h} className="rounded-[16px] bg-[var(--raised)] p-6">
              <h2 className="flex items-center gap-2 font-serif text-[28px] font-light text-[var(--text-hi)]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{h}</h2>
              <ul className="mt-4 space-y-3">{list.map((x) => <li key={x} className="border-t border-[var(--hairline)] pt-3 text-[15px] leading-snug text-[var(--text-hi)]">{x}</li>)}</ul>
            </article>
          ))}
        </section>
        <section className="mt-12 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-[28px] font-light text-[var(--text-hi)]">{g.alerts}</h2>
            <ul className="mt-4 space-y-3">
              {alerts.map((a) => (
                <li key={a.id} className="rounded-[12px] bg-[var(--panel)] p-4 shadow-[inset_3px_0_0_#d4381c,var(--panel-edge)]">
                  <div className="mono flex justify-between text-[11px] text-[var(--text-mute)]"><span>✓ {g.verified} · {a.sender}</span><span>{a.severity} · {a.area}</span></div>
                  <div className="mt-1 font-semibold text-[var(--text-hi)]">{a.headline}</div>
                  <p className="mt-1 text-[14px]">{a.text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-[var(--text-mute)]">{g.capNote}</p>
          </div>
          <div className="space-y-8">
            <div id="helplines">
              <h2 className="font-serif text-[28px] font-light text-[var(--text-hi)]">{g.helplines}</h2>
              <ul className="mt-4 divide-y divide-[var(--hairline)]">
                {(["112", "1078", "1070", "108"] as const).map((n, i) => [n, g.hl[i]] as const).map(([n, l]) => (
                  <li key={n} className="flex items-center justify-between py-3"><span className="text-[15px]">{l}</span><a href={`tel:${n}`} className="mono rounded-full px-4 py-1.5 text-[18px] font-semibold text-[var(--navy)] shadow-[inset_0_0_0_1px_var(--hairline)]">{n}</a></li>
                ))}
              </ul>
            </div>
            <div id="shelters">
              <h2 className="font-serif text-[28px] font-light text-[var(--text-hi)]">{g.shelters}</h2>
              <ul className="mt-4 divide-y divide-[var(--hairline)]">{SHELTERS.map(([id, n, a, cap]) => <li key={id} className="flex items-center justify-between py-3 text-[14px]"><span><b className="text-[var(--text-hi)]">{n}</b> · {a}</span><span className="mono text-[12px] text-[var(--text-mute)]">{id} · cap {cap}</span></li>)}</ul>
              <p className="mt-2 text-[12px] text-[var(--text-mute)]">{g.fictional}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
