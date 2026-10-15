import { requestOtp } from "@jalsetu/dispatch";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";
import { ENV } from "@/server/env";

const Body = z.object({ phone: z.string().regex(/^\+?\d{10,13}$/), deviceId: z.string().min(4).max(128) });

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
  const db = dispatchDb.get();
  const r = requestOtp(db.otp, ENV.pepper, p.data.phone, p.data.deviceId, await clientIp(), Date.now());
  if (r.ok && ENV.sms === "mock") {
    db.devInbox.push({ at: new Date().toISOString(), to: `••••••${p.data.phone.slice(-4)}`, text: `JalSetu code ${r.devCode}. Valid 5 min. Never share it. @${"localhost"} #${r.devCode}` });
    db.devInbox = db.devInbox.slice(-50);
    console.log(`[mock-sms] OTP for ••••${p.data.phone.slice(-4)}: ${r.devCode}`);
  }
  dispatchDb.save();
  if (!r.ok) return NextResponse.json({ error: r.reason, retryAfterSec: r.retryAfterSec }, { status: 429 });
  return NextResponse.json({ ok: true, ttlSec: 300, ...(ENV.demo ? { devCode: r.devCode } : {}) });
}
