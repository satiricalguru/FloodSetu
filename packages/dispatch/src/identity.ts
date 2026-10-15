import { hmac, sha256 } from "@floodsetu/shared";

/**
 * Pseudonymous identity (Aarogya Setu "DiD" idea, improved — RESEARCH §4.7):
 *  - uid = HMAC(pepper, phone): stable internal id; raw phone never stored or shown.
 *  - handle = HMAC(uid, requestId): ROTATING per-request handle in shared views (fixes the static-ID criticism).
 */
export function phoneHash(pepper: string, phone: string): string {
  return `ph_${hmac(pepper, normalisePhone(phone)).slice(0, 24)}`;
}

export function uidFor(pepper: string, phone: string): string {
  return `u_${hmac(`${pepper}:uid`, normalisePhone(phone)).slice(0, 20)}`;
}

export function handleFor(uidOrDevice: string, requestId: string): string {
  return `h_${hmac(uidOrDevice, requestId).slice(0, 8)}`;
}

export function deviceHash(pepper: string, deviceId: string): string {
  return `dv_${hmac(`${pepper}:dev`, deviceId).slice(0, 16)}`;
}

export function normalisePhone(p: string): string {
  const d = p.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
}

/** Masked display, e.g. ••••••3210 — used only in the user's own view. */
export function maskPhone(p: string): string {
  const d = normalisePhone(p);
  return `••••••${d.slice(-4)}`;
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function newRequestId(rand: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += CROCKFORD[Math.floor(rand() * 32)];
  return `FS-${s}`;
}

export function opaqueToken(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const tokenHash = (t: string) => sha256(`tok:${t}`);
