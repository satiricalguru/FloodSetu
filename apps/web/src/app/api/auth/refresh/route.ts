import { rotateRefresh, signAccess, ACCESS_TTL, REFRESH_TTL } from "@jalsetu/dispatch";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearSession } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";
import { ENV } from "@/server/env";

export async function POST() {
  const c = await cookies();
  const rt = c.get("js_rt")?.value;
  if (!rt) return NextResponse.json({ error: "no refresh token" }, { status: 401 });
  const db = dispatchDb.get();
  const r = rotateRefresh(db.refresh, rt, Date.now());
  dispatchDb.save();
  if ("error" in r) return clearSession(NextResponse.json({ error: r.error }, { status: 401 }));
  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set("js_at", signAccess(ENV.secret, { ...r.claims, exp: Date.now() + ACCESS_TTL }), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: ACCESS_TTL / 1000 });
  res.cookies.set("js_rt", r.refresh, { httpOnly: true, sameSite: "lax", secure, path: "/api/auth", maxAge: REFRESH_TTL / 1000 });
  return res;
}
