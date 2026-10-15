import { audit } from "@floodsetu/dispatch";
import { NextResponse } from "next/server";
import { clearSession, guard } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";

/** Account deletion (fixes Aarogya Setu's "no deletion at launch"): user, phone hash and precise locations are erased. */
export async function DELETE() {
  const g = await guard("/api/me", { mutate: true });
  if ("error" in g) return g.error;
  if (!g.claims) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  const db = dispatchDb.get();
  const uid = g.claims.sub;
  db.users = db.users.filter((u) => u.uid !== uid);
  let scrubbed = 0;
  for (const r of db.sos) {
    if (r.uid === uid) {
      r.uid = undefined;
      r.phoneHash = undefined;
      r.precise = null;
      r.text = r.status === "resolved" ? undefined : r.text;
      scrubbed++;
    }
  }
  audit(db.audit, "ACCOUNT_DELETE", "self", { tombstone: `${uid.slice(0, 6)}…`, scrubbedRequests: scrubbed });
  dispatchDb.save();
  return clearSession(NextResponse.json({ ok: true, scrubbedRequests: scrubbed }));
}
