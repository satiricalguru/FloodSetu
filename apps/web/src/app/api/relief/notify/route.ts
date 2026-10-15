import { hmac } from "@jalsetu/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ENV } from "@/server/env";
import { reliefDb } from "@/server/relief/store";

/** "Notify me when the app launches" — stored as a salted hash only (mocked). */
export async function POST(req: Request) {
  const p = z.object({ contact: z.string().min(3).max(120) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const st = reliefDb.get();
  const contactHash = hmac(ENV.pepper, p.data.contact.trim().toLowerCase()).slice(0, 16);
  if (!st.notify.some((n) => n.contactHash === contactHash)) st.notify.push({ at: new Date().toISOString(), contactHash });
  reliefDb.save();
  return NextResponse.json({ ok: true, count: st.notify.length });
}
