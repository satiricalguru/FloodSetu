"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";
import { LangToggle, useT } from "@/lib/i18n";

/** Flood-safety awareness (NDMA-aligned, RESEARCH §4.6). "Climate atlas in winter light" — light editorial surface. */
const G = {
  en: {
    title: "Flood safety, before it’s urgent.",
    lede: "Guidance aligned with NDMA / IMD advisories. Verified alerts below come only from the district control room.",
    before: "Before",
    during: "During",
    after: "After",
    b: ["Follow IMD and SDMA advisories — not forwarded rumours.", "Pack a kit: water, dry food, medicines, torch, power bank, whistle, cash, documents in a waterproof pouch.", "Know the route to your nearest shelter or raised pucca house.", "Untie cattle and animals so they can move to safety.", "Evacuate immediately when officials ask you to."],
    d: ["Never walk or drive through moving water — 60 cm can sweep away a car.", "If you must wade, test the ground ahead with a stick.", "Stay away from electric poles and fallen wires; switch off the mains if safe.", "Keep away from drains, culverts and open manholes.", "Drink only boiled or chlorinated water."],
    a: ["Keep children out of floodwater.", "Do not use wet electrical goods until checked.", "Watch for snakes, debris and broken glass.", "Throw away food that touched floodwater.", "Drink tap water only after the health department says it is safe."],
    alerts: "Verified alerts",
    helplines: "Helplines",
    shelters: "Shelters",
    sos: "Need rescue now? Open SOS",
  },
  hi: {
    title: "बाढ़ से सुरक्षा — आपात स्थिति से पहले।",
    lede: "NDMA / IMD सलाह पर आधारित मार्गदर्शन। नीचे दी गई सत्यापित चेतावनियाँ केवल ज़िला कंट्रोल रूम से हैं।",
    before: "पहले",
    during: "दौरान",
    after: "बाद में",
    b: ["IMD और SDMA की सलाह मानें — फ़ॉरवर्ड की गई अफ़वाहें नहीं।", "किट तैयार रखें: पानी, सूखा खाना, दवाइयाँ, टॉर्च, पावर बैंक, सीटी, नकद, वाटरप्रूफ़ थैली में दस्तावेज़।", "नज़दीकी आश्रय या ऊँचे पक्के मकान का रास्ता जानें।", "मवेशियों को खोल दें ताकि वे सुरक्षित जगह जा सकें।", "अधिकारी कहें तो तुरंत घर छोड़ें।"],
    d: ["बहते पानी में न चलें, न गाड़ी चलाएँ — 60 सेमी पानी कार बहा सकता है।", "पानी में चलना ही पड़े तो आगे ज़मीन को डंडे से जाँचें।", "बिजली के खंभों और गिरे तारों से दूर रहें; सुरक्षित हो तो मेन स्विच बंद करें।", "नालों, पुलियों और खुले मैनहोल से दूर रहें।", "केवल उबला या क्लोरीन वाला पानी पिएँ।"],
    a: ["बच्चों को बाढ़ के पानी से दूर रखें।", "भीगे बिजली के सामान जाँच के बिना न चलाएँ।", "साँप, मलबे और काँच से सावधान रहें।", "बाढ़ के पानी को छू चुका खाना फेंक दें।", "स्वास्थ्य विभाग के कहने के बाद ही नल का पानी पिएँ।"],
    alerts: "सत्यापित चेतावनियाँ",
    helplines: "हेल्पलाइन",
    shelters: "आश्रय स्थल",
    sos: "अभी मदद चाहिए? SOS खोलें",
  },
};

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
  const g = G[lang];
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
                  <div className="mono flex justify-between text-[11px] text-[var(--text-mute)]"><span>✓ VERIFIED · {a.sender}</span><span>{a.severity} · {a.area}</span></div>
                  <div className="mt-1 font-semibold text-[var(--text-hi)]">{a.headline}</div>
                  <p className="mt-1 text-[14px]">{a.text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-[var(--text-mute)]">Alerts use a CAP-1.2-shaped structure, the same standard as NDMA’s SACHET system.</p>
          </div>
          <div className="space-y-8">
            <div id="helplines">
              <h2 className="font-serif text-[28px] font-light text-[var(--text-hi)]">{g.helplines}</h2>
              <ul className="mt-4 divide-y divide-[var(--hairline)]">
                {[["112", "National emergency (ERSS)"], ["1078", "NDMA disaster helpline"], ["1070", "State emergency operations centre"], ["108", "Ambulance"]].map(([n, l]) => (
                  <li key={n} className="flex items-center justify-between py-3"><span className="text-[15px]">{l}</span><a href={`tel:${n}`} className="mono rounded-full px-4 py-1.5 text-[18px] font-semibold text-[var(--navy)] shadow-[inset_0_0_0_1px_var(--hairline)]">{n}</a></li>
                ))}
              </ul>
            </div>
            <div id="shelters">
              <h2 className="font-serif text-[28px] font-light text-[var(--text-hi)]">{g.shelters}</h2>
              <ul className="mt-4 divide-y divide-[var(--hairline)]">{SHELTERS.map(([id, n, a, cap]) => <li key={id} className="flex items-center justify-between py-3 text-[14px]"><span><b className="text-[var(--text-hi)]">{n}</b> · {a}</span><span className="mono text-[12px] text-[var(--text-mute)]">{id} · cap {cap}</span></li>)}</ul>
              <p className="mt-2 text-[12px] text-[var(--text-mute)]">Jalnagar is a fictional town. All data is synthetic.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
