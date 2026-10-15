import { audit, deviceHash, maskPhone, noteRegistration, phoneHash, uidFor, verifyOtp } from "@jalsetu/dispatch";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setSession } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";
import { ENV } from "@/server/env";

const Body = z.object({ phone: z.string().regex(/^\+?\d{10,13}$/), code: z.string().regex(/^\d{6}$/), deviceId: z.string().min(4).max(128), linkSos: z.array(z.string()).max(20).optional() });

/** Roles are never self-assigned: seeded/admin-granted only. Everyone else is a citizen. */
const SEEDED: Record<string, { role: "operator" | "admin" | "rescuer" | "relief_partner"; unit?: string }> = {
  "9000000100": { role: "operator" },
  "9000000999": { role: "admin" },
  "9000000500": { role: "relief_partner" },
  ...Object.fromEntries(["B-1", "B-2", "B-3", "B-4", "B-5", "B-6", "B-7", "B-8"].map((u, i) => [`900000000${i + 1}`, { role: "rescuer" as const, unit: u }])),
  "9000000011": { role: "rescuer", unit: "G-01" },
  "9000000012": { role: "rescuer", unit: "G-02" },
};

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
  const db = dispatchDb.get();
  const v = verifyOtp(db.otp, ENV.pepper, p.data.phone, p.data.code, Date.now());
  if (!v.ok) {
    dispatchDb.save();
    return NextResponse.json({ error: v.reason }, { status: 401 });
  }
  const ph = phoneHash(ENV.pepper, p.data.phone);
  const uid = uidFor(ENV.pepper, p.data.phone);
  const dev = deviceHash(ENV.pepper, p.data.deviceId);
  let user = db.users.find((u) => u.uid === uid);
  const seeded = SEEDED[p.data.phone.replace(/\D/g, "").slice(-10)];
  if (!user) {
    user = { uid, phoneHash: ph, phoneMasked: maskPhone(p.data.phone), role: seeded?.role ?? "citizen", unit: seeded?.unit, createdAt: new Date().toISOString(), deviceHashes: [] };
    db.users.push(user);
  }
  if (!user.deviceHashes.includes(dev)) user.deviceHashes.push(dev);
  const flag = noteRegistration(db.otp, dev, ph, Date.now());
  if (flag) audit(db.audit, "FLAG", "system", { kind: "repeat_registration", device: dev.slice(0, 10), detail: flag });
  // link earlier guest SOS from this device to the account (later linking)
  let linked = 0;
  for (const r of db.sos) if (r.deviceHash === dev && !r.uid) ((r.uid = uid), (r.phoneHash = r.phoneHash ?? ph), linked++);
  audit(db.audit, "LOGIN", uid, { role: user.role, unit: user.unit ?? null, linkedGuestSos: linked });
  dispatchDb.save();
  return setSession(NextResponse.json({ ok: true, role: user.role, unit: user.unit, phone: user.phoneMasked, linked }), uid, user.role, user.unit);
}
