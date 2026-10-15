import { allowed, issueRefresh, signAccess, verifyAccess, ACCESS_TTL, REFRESH_TTL, type Claims, type Role } from "@floodsetu/dispatch";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { dispatchDb } from "./dispatch/store";
import { ENV } from "./env";

/** Session = short-lived signed access cookie + rotating refresh cookie (httpOnly) + double-submit CSRF cookie. */
const secure = process.env.NODE_ENV === "production";

export async function session(): Promise<Claims | null> {
  const c = await cookies();
  return verifyAccess(ENV.secret, c.get("js_at")?.value, Date.now());
}

export function setSession(res: NextResponse, sub: string, role: Role, unit?: string) {
  const db = dispatchDb.get();
  const now = Date.now();
  const refresh = issueRefresh(db.refresh, sub, role, now, undefined, unit);
  const fam = db.refresh.tokens[Object.keys(db.refresh.tokens).pop()!]?.fam ?? "f";
  dispatchDb.save();
  const access = signAccess(ENV.secret, { sub, role, unit, exp: now + ACCESS_TTL, fam });
  res.cookies.set("js_at", access, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: ACCESS_TTL / 1000 });
  res.cookies.set("js_rt", refresh, { httpOnly: true, sameSite: "lax", secure, path: "/api/auth", maxAge: REFRESH_TTL / 1000 });
  res.cookies.set("js_csrf", crypto.randomUUID().replace(/-/g, ""), { httpOnly: false, sameSite: "lax", secure, path: "/" });
  return res;
}

export function clearSession(res: NextResponse) {
  for (const k of ["js_at", "js_rt", "js_csrf"]) res.cookies.set(k, "", { path: k === "js_rt" ? "/api/auth" : "/", maxAge: 0 });
  return res;
}

/** RBAC + CSRF guard for route handlers. Returns claims or an error response. */
export async function guard(path: string, opts: { roles?: Role[]; mutate?: boolean } = {}): Promise<{ claims: Claims } | { error: NextResponse }> {
  const claims = await session();
  if (opts.roles && (!claims || !opts.roles.includes(claims.role))) return { error: NextResponse.json({ error: "forbidden", need: opts.roles }, { status: claims ? 403 : 401 }) };
  if (claims && !allowed(path, claims.role)) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  if (opts.mutate && claims) {
    const h = await headers();
    const c = await cookies();
    if (!h.get("x-csrf") || h.get("x-csrf") !== c.get("js_csrf")?.value) return { error: NextResponse.json({ error: "csrf" }, { status: 403 }) };
  }
  return { claims: claims! };
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "127.0.0.1").split(",")[0].trim();
}
