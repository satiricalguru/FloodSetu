import { hmac } from "@jalsetu/shared";
import { opaqueToken, tokenHash } from "./identity";

export type Role = "citizen" | "rescuer" | "operator" | "shelter" | "relief_partner" | "admin";

export interface Claims {
  sub: string; // uid
  role: Role;
  unit?: string; // rescuer unit id, e.g. B-1
  exp: number; // ms epoch
  fam: string; // refresh family
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export const ACCESS_TTL = 15 * 60_000;
export const REFRESH_TTL = 7 * 24 * 3_600_000;

export function signAccess(secret: string, c: Claims): string {
  const body = b64(JSON.stringify(c));
  return `${body}.${hmac(secret, body)}`;
}

export function verifyAccess(secret: string, token: string | undefined, now: number): Claims | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || hmac(secret, body) !== sig) return null;
  try {
    const c = JSON.parse(unb64(body)) as Claims;
    return c.exp > now ? c : null;
  } catch {
    return null;
  }
}

/** Refresh-token rotation with reuse detection: presenting an already-rotated token revokes the whole family. */
export interface RefreshStore {
  tokens: Record<string, { fam: string; sub: string; role: Role; unit?: string; exp: number; used: boolean }>;
  revokedFamilies: string[];
}

export function issueRefresh(st: RefreshStore, sub: string, role: Role, now: number, fam = opaqueToken().slice(0, 16), unit?: string): string {
  const t = opaqueToken();
  st.tokens[tokenHash(t)] = { fam, sub, role, unit, exp: now + REFRESH_TTL, used: false };
  return t;
}

export function rotateRefresh(st: RefreshStore, token: string, now: number): { refresh: string; claims: Omit<Claims, "exp"> } | { error: string } {
  const h = tokenHash(token);
  const rec = st.tokens[h];
  if (!rec) return { error: "unknown refresh token" };
  if (st.revokedFamilies.includes(rec.fam)) return { error: "session revoked" };
  if (rec.used) {
    st.revokedFamilies.push(rec.fam);
    return { error: "refresh token reuse detected — all sessions in this family revoked" };
  }
  if (rec.exp < now) return { error: "refresh expired" };
  rec.used = true;
  const refresh = issueRefresh(st, rec.sub, rec.role, now, rec.fam, rec.unit);
  return { refresh, claims: { sub: rec.sub, role: rec.role, fam: rec.fam, unit: rec.unit } };
}

export const ROLE_ROUTES: Record<string, Role[]> = {
  "/api/dispatch/live": ["operator", "admin"],
  "/api/dispatch/verify": ["operator", "admin"],
  "/api/dispatch/rescuer": ["rescuer", "operator", "admin"],
  "/api/admin": ["admin"],
  "/api/relief/partner": ["relief_partner", "admin"],
};

export function allowed(path: string, role: Role | undefined): boolean {
  const rule = Object.entries(ROLE_ROUTES).find(([p]) => path.startsWith(p));
  if (!rule) return true;
  return !!role && rule[1].includes(role);
}
