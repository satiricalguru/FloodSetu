"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { REGIONAL, type RegionalLang } from "./i18n-regional";

/**
 * Tiny typed dictionary (DECISIONS D9, D39). English is the default; Hindi is always offered; the regional
 * language for the user's state (GPS → state, else browser locale) is suggested, never forced. Missing keys fall back to English.
 */
const D = {
  en: {
    sos: "SOS",
    sosHint: "Tap for emergency help",
    sosSub: "No login needed · works on slow networks",
    call112: "Life-threatening? Also call 112",
    people: "How many people?",
    urgency: "How urgent?",
    critical: "Critical",
    criticalSub: "Life in danger now",
    urgent: "Urgent",
    urgentSub: "Water rising, need evacuation",
    needs_help: "Need help",
    needs_helpSub: "Safe for now, need supplies",
    needs: "Anyone needing special care?",
    elderly: "Elderly",
    child: "Child",
    pregnant: "Pregnant",
    disabled: "Disabled",
    medical: "Medical",
    injured: "Injured",
    pets: "Pets",
    details: "Anything else? (optional)",
    detailsPh: "e.g. on the roof, 2nd building after the temple",
    phone: "Mobile number (optional, for updates)",
    area: "Area",
    location: "Location",
    useGps: "Use my location",
    gpsOk: "Location attached",
    gpsNo: "No GPS — choose your area",
    send: "Send SOS",
    sending: "Sending…",
    queued: "Queued — will send automatically when you're back online",
    sent: "Sent",
    received: "Received by control room",
    yourRequest: "Your request",
    status_received: "Received",
    status_verification_pending: "Verifying",
    status_assigned: "Team assigned",
    status_rescue_in_progress: "Rescue in progress",
    status_resolved: "Safe",
    status_needs_attention: "Needs attention",
    merged: "Merged with nearby reports — everyone is counted",
    eta: "ETA",
    min: "min",
    team: "Team",
    whileYouWait: "While you wait",
    message: "Message the team",
    messagePh: "Type a short message…",
    online: "Online",
    offline: "Offline",
    updated: "Updated",
    ago: "ago",
    stale: "Last known — may be out of date",
    newRequest: "New SOS",
    myRequests: "My requests",
    signIn: "Sign in (optional)",
    shelters: "Shelters",
    safety: "Safety guide",
    helplines: "Helplines",
    privacy: "Your exact location is shared only with the assigned team and control room, and deleted after rescue.",
    photo: "Photo",
    voice: "Voice note",
    back: "Back",
    you: "You",
    inWater: "I'm in the water — send now",
    inWaterAria: "Emergency: I am in the water. Sends a critical SOS immediately with one tap",
    inWaterSub: "One tap. No form. Sends your location as CRITICAL.",
    altPhone: "Alternate number (optional)",
    altPhoneSub: "If your phone stops responding, we call this number. Your rescue is never cancelled.",
    batteryLow: "Battery low — your last location is saved. If the phone dies, the team still comes here",
    phoneDies: "If your phone gets wet or switches off, your request stays active at your last location, is upgraded to critical, and the team is told.",
  },
  hi: {
    sos: "SOS",
    sosHint: "आपातकालीन मदद के लिए दबाएँ",
    sosSub: "लॉगिन ज़रूरी नहीं · धीमे नेटवर्क पर भी चलता है",
    call112: "जान का ख़तरा? 112 पर भी कॉल करें",
    people: "कितने लोग हैं?",
    urgency: "कितनी जल्दी?",
    critical: "गंभीर",
    criticalSub: "अभी जान ख़तरे में है",
    urgent: "अत्यावश्यक",
    urgentSub: "पानी बढ़ रहा है, निकालना है",
    needs_help: "मदद चाहिए",
    needs_helpSub: "अभी सुरक्षित, सामान चाहिए",
    needs: "किसी को विशेष देखभाल चाहिए?",
    elderly: "बुज़ुर्ग",
    child: "बच्चा",
    pregnant: "गर्भवती",
    disabled: "दिव्यांग",
    medical: "दवा/बीमारी",
    injured: "घायल",
    pets: "पालतू",
    details: "और कुछ? (वैकल्पिक)",
    detailsPh: "जैसे: छत पर हैं, मंदिर के बाद दूसरी इमारत",
    phone: "मोबाइल नंबर (वैकल्पिक, अपडेट के लिए)",
    area: "इलाका",
    location: "स्थान",
    useGps: "मेरी लोकेशन लें",
    gpsOk: "लोकेशन जुड़ गई",
    gpsNo: "GPS नहीं — अपना इलाका चुनें",
    send: "SOS भेजें",
    sending: "भेजा जा रहा है…",
    queued: "कतार में — नेटवर्क आते ही अपने-आप भेजा जाएगा",
    sent: "भेज दिया",
    received: "कंट्रोल रूम को मिल गया",
    yourRequest: "आपका अनुरोध",
    status_received: "मिल गया",
    status_verification_pending: "जाँच हो रही है",
    status_assigned: "टीम भेजी गई",
    status_rescue_in_progress: "बचाव जारी",
    status_resolved: "सुरक्षित",
    status_needs_attention: "ध्यान देना ज़रूरी",
    merged: "पास की रिपोर्टों के साथ जोड़ा गया — सबकी गिनती है",
    eta: "पहुँचने का समय",
    min: "मिनट",
    team: "टीम",
    whileYouWait: "इंतज़ार करते समय",
    message: "टीम को संदेश",
    messagePh: "छोटा संदेश लिखें…",
    online: "ऑनलाइन",
    offline: "ऑफ़लाइन",
    updated: "अपडेट",
    ago: "पहले",
    stale: "आख़िरी जानकारी — पुरानी हो सकती है",
    newRequest: "नया SOS",
    myRequests: "मेरे अनुरोध",
    signIn: "साइन इन (वैकल्पिक)",
    shelters: "आश्रय स्थल",
    safety: "सुरक्षा गाइड",
    helplines: "हेल्पलाइन",
    privacy: "आपकी सटीक लोकेशन सिर्फ़ टीम और कंट्रोल रूम को दिखती है, और बचाव के बाद मिटा दी जाती है।",
    photo: "फ़ोटो",
    voice: "आवाज़",
    back: "वापस",
    you: "आप",
    inWater: "मैं पानी में हूँ — अभी भेजें",
    inWaterAria: "आपातकाल: मैं पानी में हूँ। एक टैप में गंभीर SOS भेजता है",
    inWaterSub: "एक टैप। कोई फ़ॉर्म नहीं। आपकी लोकेशन गंभीर (CRITICAL) के रूप में जाती है।",
    altPhone: "दूसरा नंबर (वैकल्पिक)",
    altPhoneSub: "अगर आपका फ़ोन जवाब देना बंद कर दे, हम इस नंबर पर कॉल करेंगे। आपका बचाव कभी रद्द नहीं होगा।",
    batteryLow: "बैटरी कम — आपकी आख़िरी लोकेशन सुरक्षित है। फ़ोन बंद होने पर भी टीम यहीं आएगी",
    phoneDies: "फ़ोन भीग जाए या बंद हो जाए, तो भी अनुरोध आपकी आख़िरी लोकेशन पर सक्रिय रहेगा, गंभीर कर दिया जाएगा, और टीम को बताया जाएगा।",
  },
} as const;

export type Lang = "en" | "hi" | RegionalLang;
export type Key = keyof (typeof D)["en"];
/** for tests: every regional key must exist in English (typos would silently never render) */
export const EN_KEYS: readonly string[] = Object.keys(D.en);

/** Native names, in the order shown in the "More" list. */
export const LANGS: { code: Lang; native: string; english: string; rtl?: boolean }[] = [
  { code: "en", native: "English", english: "English" },
  { code: "hi", native: "हिन्दी", english: "Hindi" },
  { code: "bn", native: "বাংলা", english: "Bengali" },
  { code: "mr", native: "मराठी", english: "Marathi" },
  { code: "te", native: "తెలుగు", english: "Telugu" },
  { code: "ta", native: "தமிழ்", english: "Tamil" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada" },
  { code: "ml", native: "മലയാളം", english: "Malayalam" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia" },
  { code: "as", native: "অসমীয়া", english: "Assamese" },
  { code: "ur", native: "اردو", english: "Urdu", rtl: true },
];
const CODES = new Set<string>(LANGS.map((l) => l.code));
const isLang = (x: unknown): x is Lang => typeof x === "string" && CODES.has(x);
export const langMeta = (l: Lang) => LANGS.find((x) => x.code === l) ?? LANGS[0]!;

/**
 * Approximate state centroids (plus extra anchors for long/oddly-shaped states) → primary state language (offline, no geocoding API). Nearest centroid wins, so
 * border districts can be wrong — that's why we only SUGGEST. "en" means no supported regional language (NE states).
 */
const STATES: [string, number, number, Lang][] = [
  ["West Bengal", 23.0, 87.9, "bn"], ["Tripura", 23.8, 91.3, "bn"], ["Maharashtra", 19.5, 75.7, "mr"], ["Goa", 15.4, 74.0, "mr"],
  ["Telangana", 17.9, 79.0, "te"], ["Andhra Pradesh", 15.9, 79.7, "te"], ["Tamil Nadu", 11.0, 78.4, "ta"], ["Puducherry", 11.9, 79.8, "ta"],
  ["Gujarat", 22.6, 71.6, "gu"], ["Karnataka", 14.8, 75.7, "kn"], ["Kerala", 10.4, 76.4, "ml"], ["Punjab", 30.9, 75.4, "pa"],
  ["Odisha", 20.5, 84.4, "or"], ["Assam", 26.2, 92.8, "as"], ["Assam", 26.15, 91.75, "as"], ["Assam", 27.4, 94.9, "as"], ["West Bengal", 26.7, 88.4, "bn"], ["Jammu & Kashmir", 33.9, 75.0, "ur"],
  ["Uttar Pradesh", 27.0, 80.9, "hi"], ["Bihar", 25.9, 85.6, "hi"], ["Madhya Pradesh", 23.5, 78.5, "hi"], ["Rajasthan", 26.6, 73.8, "hi"],
  ["Haryana", 29.1, 76.1, "hi"], ["Delhi", 28.6, 77.2, "hi"], ["Chhattisgarh", 21.3, 81.9, "hi"], ["Jharkhand", 23.6, 85.3, "hi"],
  ["Uttarakhand", 30.1, 79.2, "hi"], ["Himachal Pradesh", 31.9, 77.2, "hi"],
  ["Meghalaya", 25.5, 91.3, "en"], ["Manipur", 24.7, 93.9, "en"], ["Mizoram", 23.2, 92.9, "en"], ["Nagaland", 26.1, 94.5, "en"], ["Arunachal Pradesh", 28.0, 94.5, "en"], ["Sikkim", 27.5, 88.5, "en"],
];
export function stateFromCoords(lat: number, lng: number): { state: string; lang: Lang } | null {
  if (lat < 6 || lat > 37.5 || lng < 68 || lng > 98) return null; // outside India
  let best: (typeof STATES)[number] | null = null;
  let bd = Infinity;
  for (const s of STATES) {
    const d = (s[1] - lat) ** 2 + ((s[2] - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bd) (bd = d), (best = s);
  }
  return best ? { state: best[0], lang: best[3] } : null;
}

/* ---- one shared store so every useT() on the page agrees (toggle in header, banner, forms) ---- */
type S = { lang: Lang; suggested: Lang | null; region: string | null; chosen: boolean; dismissed: boolean };
let state: S = { lang: "en", suggested: null, region: null, chosen: false, dismissed: false };
const subs = new Set<() => void>();
const SERVER: S = state;
function set(p: Partial<S>) {
  state = { ...state, ...p };
  subs.forEach((f) => f());
}
let booted = false;
function boot() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  try {
    const l = localStorage.getItem("floodsetu.lang");
    const dismissed = localStorage.getItem("floodsetu.langSuggestDismissed") === "1";
    // browser locale gives a first guess; GPS (if already permitted) overrides it below
    const fromLocale = (navigator.languages ?? [navigator.language]).map((x) => x.slice(0, 2)).find((x) => x !== "en" && isLang(x));
    set({ lang: isLang(l) ? l : "en", chosen: isLang(l), dismissed, suggested: isLang(fromLocale) ? fromLocale : null });
    applyDoc(state.lang);
    navigator.permissions?.query({ name: "geolocation" as PermissionName }).then((p) => {
      if (p.state === "granted") navigator.geolocation.getCurrentPosition((pos) => suggestFromCoords(pos.coords.latitude, pos.coords.longitude), () => {}, { maximumAge: 3_600_000, timeout: 8000 });
    }).catch(() => {});
  } catch {}
}
function applyDoc(l: Lang) {
  document.documentElement.lang = l;
  document.documentElement.dir = langMeta(l).rtl ? "rtl" : "ltr";
}
/** Call with any GPS fix (SOS form does) — updates the regional suggestion, never the active language. */
export function suggestFromCoords(lat: number, lng: number) {
  const s = stateFromCoords(lat, lng);
  if (s && s.lang !== "en") set({ suggested: s.lang, region: s.state });
}

export function useT() {
  const s = useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state, () => SERVER);
  useEffect(boot, []);
  const setLang = useCallback((l: Lang) => {
    set({ lang: l, chosen: true });
    try {
      localStorage.setItem("floodsetu.lang", l);
    } catch {}
    applyDoc(l);
  }, []);
  const dismissSuggestion = useCallback(() => {
    set({ dismissed: true });
    try {
      localStorage.setItem("floodsetu.langSuggestDismissed", "1");
    } catch {}
  }, []);
  const lang = s.lang;
  const t = useCallback(
    (k: Key): string => (lang === "en" || lang === "hi" ? (D[lang] as Record<string, string>)[k] : REGIONAL[lang][k]) ?? D.en[k],
    [lang],
  );
  return { t, lang, setLang, suggested: s.suggested, region: s.region, chosen: s.chosen, dismissed: s.dismissed, dismissSuggestion };
}

/** Pick a page-local dictionary ({en, hi, ...}) for the active language, falling back to English. */
export function pick<D extends { en: unknown }>(dict: D, lang: Lang): D[keyof D] {
  return ((dict as Partial<Record<Lang, D[keyof D]>>)[lang] ?? dict.en) as D[keyof D];
}

/**
 * EN · हिं · [regional for your location] · More. English stays first and default; Hindi is always one tap;
 * the regional chip only appears once we have a location/locale signal.
 */
export function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const { suggested } = useT();
  const chips: Lang[] = ["en", "hi"];
  if (suggested && !chips.includes(suggested)) chips.push(suggested);
  if (!chips.includes(lang)) chips.push(lang);
  return (
    <div className="inline-flex items-center gap-1">
      <div className="inline-flex rounded-full bg-raised p-0.5 shadow-[inset_0_0_0_1px_var(--hairline)]" role="radiogroup" aria-label="Language">
        {chips.map((l) => (
          <button key={l} role="radio" lang={l} aria-checked={lang === l} aria-label={langMeta(l).english} onClick={() => setLang(l)} className={`h-8 min-w-[40px] rounded-full px-2.5 text-[13px] ${lang === l ? "bg-cta text-cta-text" : "text-mute"}`}>
            {l === "en" ? "EN" : l === "hi" ? "हिं" : langMeta(l).native}
          </button>
        ))}
      </div>
      <label className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-raised text-mute shadow-[inset_0_0_0_1px_var(--hairline)]" title="More languages">
        <span aria-hidden className="text-[15px] leading-none">⋯</span>
        <select aria-label="More languages" value={lang} onChange={(e) => isLang(e.target.value) && setLang(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
          {LANGS.map((l) => (
            <option key={l.code} value={l.code} lang={l.code}>
              {l.native}{l.code !== "en" ? ` — ${l.english}` : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** One-line nudge: "Looks like you're in West Bengal · বাংলা?" Shown only if the user never picked a language. */
export function LangSuggest() {
  const { lang, setLang, suggested, region, chosen, dismissed, dismissSuggestion } = useT();
  if (!suggested || chosen || dismissed || suggested === lang) return null;
  const m = langMeta(suggested);
  return (
    <div role="status" className="mx-auto mb-3 flex max-w-[520px] items-center gap-2 rounded-xl bg-raised px-3 py-2 text-[13px] shadow-[inset_0_0_0_1px_var(--hairline)]">
      <span className="flex-1 text-mute">
        {region ? `Near ${region}. ` : ""}Also available in <span lang={m.code} className="text-[var(--text-hi)]">{m.native}</span>
      </span>
      <button onClick={() => setLang(suggested)} lang={m.code} className="h-8 rounded-full bg-cta px-3 text-cta-text">{m.native}</button>
      <button onClick={dismissSuggestion} aria-label="Keep English" className="h-8 rounded-full px-2 text-mute">EN ✕</button>
    </div>
  );
}
