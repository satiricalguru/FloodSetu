"use client";
import { useCallback, useEffect, useState } from "react";

/** Tiny typed dictionary (DECISIONS D9). English + Hindi; falls back to English. */
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

export type Lang = keyof typeof D;
export type Key = keyof (typeof D)["en"];

export function useT() {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const l = localStorage.getItem("floodsetu.lang") as Lang | null;
      if (l === "hi" || l === "en") setLangState(l);
      else if (navigator.language.startsWith("hi")) setLangState("hi");
    } catch {}
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("floodsetu.lang", l);
    } catch {}
    document.documentElement.lang = l;
  }, []);
  const t = useCallback((k: Key) => (D[lang] as Record<string, string>)[k] ?? D.en[k], [lang]);
  return { t, lang, setLang };
}

export function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="inline-flex rounded-full bg-raised p-0.5 shadow-[inset_0_0_0_1px_var(--hairline)]" role="radiogroup" aria-label="Language">
      {(["en", "hi"] as const).map((l) => (
        <button key={l} role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={`h-8 min-w-[44px] rounded-full px-3 text-[13px] ${lang === l ? "bg-cta text-cta-text" : "text-mute"}`}>
          {l === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}
