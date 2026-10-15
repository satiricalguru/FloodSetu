import { audit } from "@floodsetu/dispatch";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setSession } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";
import { ENV } from "@/server/env";

const Body = z.object({ role: z.enum(["operator", "rescuer", "admin", "relief_partner", "shelter"]), unit: z.string().regex(/^[BG]-\d{1,2}$/).optional() });

/** DEV/DEMO ONLY: one-click role session so the judged demo runs offline. Disabled when JALSETU_DEMO=0 / production. */
export async function POST(req: Request) {
  if (!ENV.demo) return NextResponse.json({ error: "demo sign-in disabled" }, { status: 404 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const uid = `demo_${p.data.role}${p.data.unit ? `_${p.data.unit}` : ""}`;
  const db = dispatchDb.get();
  audit(db.audit, "LOGIN", uid, { role: p.data.role, unit: p.data.unit ?? null, demo: true });
  dispatchDb.save();
  return setSession(NextResponse.json({ ok: true, role: p.data.role, unit: p.data.unit, demo: true }), uid, p.data.role, p.data.unit);
}
