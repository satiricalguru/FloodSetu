import { verifyAudit } from "@jalsetu/dispatch";
import { reliefFlags } from "@jalsetu/relief";
import { NextResponse } from "next/server";
import { guard } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";
import { reliefDb } from "@/server/relief/store";

/** Admin console data. (Admin may read both modules; the dispatch ENGINE never reads relief.) */
export async function GET() {
  const g = await guard("/api/admin", { roles: ["admin"] });
  if ("error" in g) return g.error;
  const d = dispatchDb.get();
  const r = reliefDb.get();
  return NextResponse.json({
    audit: { verify: verifyAudit(d.audit), entries: [...d.audit].reverse().slice(0, 250) },
    otpFlags: [...d.otp.flags].reverse().slice(0, 50),
    sosFlags: d.sos.filter((s) => s.risk.score >= 0.5).map((s) => ({ id: s.id, risk: s.risk, status: s.status, handle: s.handle })),
    reliefFlags: reliefFlags(r),
    users: d.users.map((u) => ({ uid: `${u.uid.slice(0, 10)}…`, fullUid: u.uid, phone: u.phoneMasked, role: u.role, unit: u.unit, createdAt: u.createdAt })),
    orgs: r.orgs,
    counts: { sos: d.sos.length, users: d.users.length, ledger: r.ledger.length, notify: r.notify.length },
  });
}
