"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { deviceId } from "@/lib/outbox";

/** Mobile OTP sign-in (Aarogya Setu lineage). SOS never needs this. Dev mode shows the code / mock inbox. */
export default function LoginForm() {
  const next = useSearchParams().get("next") ?? "/sos";
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [err, setErr] = useState<string | null>(null);
  const [dev, setDev] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  // WebOTP autofill where supported (Chrome Android): SMS must end with "@host #code"
  useEffect(() => {
    if (stage !== "code" || !("OTPCredential" in window)) return;
    abort.current = new AbortController();
    (navigator.credentials.get as (o: unknown) => Promise<{ code?: string } | null>)({ otp: { transport: ["sms"] }, signal: abort.current.signal })
      .then((c) => c?.code && setCode(c.code))
      .catch(() => {});
    return () => abort.current?.abort();
  }, [stage]);

  const request = async () => {
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/auth/otp/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: phone.replace(/\D/g, ""), deviceId: deviceId() }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(d.retryAfterSec ? `${d.error}` : d.error);
    setDev(d.devCode ?? null);
    setStage("code");
  };
  const verify = async () => {
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/auth/otp/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: phone.replace(/\D/g, ""), code, deviceId: deviceId() }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(d.error);
    location.href = d.role === "rescuer" ? "/rescuer" : d.role === "operator" ? "/control" : d.role === "admin" ? "/admin" : d.role === "relief_partner" ? "/relief/partner" : next;
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-5">
      <a href="/" className="mb-8 flex items-center gap-2 text-hi"><Icon name="shield" size={20} /> JalSetu</a>
      <h1 className="text-[26px] font-semibold text-hi">{stage === "phone" ? "Sign in with your mobile" : "Enter the 6-digit code"}</h1>
      <p className="mt-2 text-[13px] text-mute">Optional for citizens — an SOS never needs login. Your number is stored only as a salted hash; other roles see a rotating per-request handle.</p>
      {stage === "phone" ? (
        <form className="mt-6 space-y-3" onSubmit={(e) => (e.preventDefault(), request())}>
          <label className="block">
            <span className="label">Mobile number</span>
            <div className="mt-1 flex h-14 items-center rounded-[14px] bg-panel px-4 shadow-[var(--panel-edge)]">
              <span className="mono mr-2 text-mute">+91</span>
              <input autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" className="mono h-full flex-1 bg-transparent text-[18px] text-hi outline-none placeholder:text-dim" />
            </div>
          </label>
          <button disabled={busy || phone.replace(/\D/g, "").length < 10} className="h-14 w-full rounded-full bg-cta text-[15px] font-medium text-cta-text disabled:opacity-40">{busy ? "Sending…" : "Send code"}</button>
        </form>
      ) : (
        <form className="mt-6 space-y-3" onSubmit={(e) => (e.preventDefault(), verify())}>
          <input autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" className="mono h-16 w-full rounded-[14px] bg-panel text-center text-[30px] tracking-[0.5em] text-hi shadow-[var(--panel-edge)] outline-none" aria-label="One-time code" />
          {dev ? <p className="rounded-[10px] bg-[var(--verify-dim)] p-3 text-[12.5px] text-verify">Dev/mock SMS mode — your code is <b className="mono">{dev}</b> (also in <a className="underline" href="/dev/inbox" target="_blank">/dev/inbox</a> and the server console). Expires in 5 min.</p> : null}
          <button disabled={busy || code.length !== 6} className="h-14 w-full rounded-full bg-cta text-[15px] font-medium text-cta-text disabled:opacity-40">{busy ? "Verifying…" : "Verify & continue"}</button>
          <button type="button" onClick={() => setStage("phone")} className="w-full text-[13px] text-mute">Change number</button>
        </form>
      )}
      {err ? <p className="mt-3 text-[13px] text-sos" role="alert">{err}</p> : null}
      <p className="mt-8 text-[11.5px] text-dim">Demo numbers: 9000000100 operator · 9000000999 admin · 9000000001–08 boats B-1…B-8 · 9000000500 relief partner. Anything else signs in as a citizen.</p>
    </main>
  );
}
