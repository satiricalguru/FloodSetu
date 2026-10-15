"use client";
import { useEffect, useState } from "react";

export default function DevInbox() {
  const [m, setM] = useState<{ at: string; to: string; text: string }[]>([]);
  useEffect(() => {
    const f = () => fetch("/api/dev/inbox").then((r) => r.json()).then((d) => setM(d.messages ?? []));
    f();
    const i = setInterval(f, 2000);
    return () => clearInterval(i);
  }, []);
  return (
    <main className="mx-auto max-w-[520px] p-6">
      <h1 className="text-[20px] font-semibold text-hi">Mock SMS inbox (dev only)</h1>
      <p className="mt-1 text-[12px] text-mute">OTP messages appear here instead of being sent. Set JALSETU_SMS_PROVIDER=msg91|twilio with keys for real SMS.</p>
      <ul className="mt-4 space-y-2">{m.map((x, i) => <li key={i} className="panel p-3"><div className="mono text-[11px] text-mute">{new Date(x.at).toLocaleTimeString()} → {x.to}</div><div className="text-[14px] text-hi">{x.text}</div></li>)}</ul>
    </main>
  );
}
