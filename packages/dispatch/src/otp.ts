import { hmac } from "@floodsetu/shared";
import { normalisePhone } from "./identity";

/**
 * Mobile OTP (6 digits, 5-min expiry, 5 attempts) with layered rate limits and abuse flags.
 * Rate limits: per phone 3 / 10 min then exponential backoff; per device 6 / h; per IP 30 / h.
 * Abuse flags are SIGNALS for the review queue — they never block an SOS (SOS needs no login at all).
 */
export interface OtpState {
  codes: Record<string, { hash: string; exp: number; attempts: number }>;
  hits: Record<string, number[]>; // key → request timestamps (ms)
  strikes: Record<string, number>; // phone → backoff level
  registrations: Record<string, string[]>; // device → phone hashes registered
  flags: { at: number; kind: string; key: string; detail: string }[];
}

export const emptyOtpState = (): OtpState => ({ codes: {}, hits: {}, strikes: {}, registrations: {}, flags: [] });

export const OTP_TTL_MS = 5 * 60_000;
const LIMITS = { phone: { n: 3, win: 10 * 60_000 }, device: { n: 6, win: 3_600_000 }, ip: { n: 30, win: 3_600_000 } };

export interface OtpRequestResult {
  ok: boolean;
  retryAfterSec?: number;
  reason?: string;
  /** dev/mock mode only: the code, so the demo runs offline */
  devCode?: string;
  flagged?: string[];
}

export function requestOtp(st: OtpState, pepper: string, phone: string, device: string, ip: string, now: number, rand = Math.random): OtpRequestResult {
  const p = normalisePhone(phone);
  const flagged: string[] = [];
  const check = (kind: keyof typeof LIMITS, key: string) => {
    const k = `${kind}:${key}`;
    const arr = (st.hits[k] ?? []).filter((t) => now - t < LIMITS[kind].win);
    st.hits[k] = arr;
    return arr.length >= LIMITS[kind].n;
  };
  const backoffUntil = st.hits[`backoff:${p}`]?.[0] ?? 0;
  if (now < backoffUntil) return { ok: false, retryAfterSec: Math.ceil((backoffUntil - now) / 1000), reason: "Too many OTP requests — exponential backoff" };
  for (const [kind, key] of [["phone", p], ["device", device], ["ip", ip]] as const) {
    if (check(kind, key)) {
      const level = (st.strikes[`${kind}:${key}`] = (st.strikes[`${kind}:${key}`] ?? 0) + 1);
      const wait = Math.min(3600, 30 * 2 ** level);
      if (kind === "phone") st.hits[`backoff:${p}`] = [now + wait * 1000];
      st.flags.push({ at: now, kind: "otp_abuse", key: `${kind}:${key.slice(0, 6)}…`, detail: `${LIMITS[kind].n}+ OTP requests per ${LIMITS[kind].win / 60000} min (${kind})` });
      return { ok: false, retryAfterSec: wait, reason: `Rate limit (${kind}) — retry in ${wait}s`, flagged: ["otp_abuse"] };
    }
  }
  for (const [kind, key] of [["phone", p], ["device", device], ["ip", ip]] as const) st.hits[`${kind}:${key}`].push(now);
  const code = String(Math.floor(rand() * 1e6)).padStart(6, "0");
  st.codes[p] = { hash: hmac(pepper, `${p}:${code}`), exp: now + OTP_TTL_MS, attempts: 0 };
  return { ok: true, devCode: code, flagged };
}

export function verifyOtp(st: OtpState, pepper: string, phone: string, code: string, now: number): { ok: boolean; reason?: string } {
  const p = normalisePhone(phone);
  const c = st.codes[p];
  if (!c) return { ok: false, reason: "No active code — request a new one" };
  if (now > c.exp) return { ok: false, reason: "Code expired" };
  if (c.attempts >= 5) return { ok: false, reason: "Too many attempts — request a new code" };
  c.attempts++;
  if (hmac(pepper, `${p}:${code}`) !== c.hash) return { ok: false, reason: "Incorrect code" };
  delete st.codes[p];
  return { ok: true };
}

/** Repeated registrations from one device fingerprint (≥3 different phones) → flag (not block). */
export function noteRegistration(st: OtpState, device: string, phoneHash: string, now: number): string | null {
  const list = (st.registrations[device] ??= []);
  if (!list.includes(phoneHash)) list.push(phoneHash);
  if (list.length >= 3) {
    const detail = `${list.length} different phones registered from one device`;
    st.flags.push({ at: now, kind: "repeat_registration", key: `${device.slice(0, 8)}…`, detail });
    return detail;
  }
  return null;
}

export function deviceFlagged(st: OtpState, device: string): boolean {
  return st.flags.some((f) => (f.kind === "otp_abuse" && f.key.startsWith(`device:${device.slice(0, 6)}`)) || (f.kind === "repeat_registration" && f.key.startsWith(device.slice(0, 8))));
}
