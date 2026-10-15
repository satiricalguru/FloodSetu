import { NextResponse } from "next/server";
import { guard } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";

/** Data export: everything we hold about the signed-in user. */
export async function GET() {
  const g = await guard("/api/me/export");
  if ("error" in g) return g.error;
  if (!g.claims) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  const db = dispatchDb.get();
  const user = db.users.find((u) => u.uid === g.claims.sub);
  const sos = db.sos.filter((r) => r.uid === g.claims.sub);
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), user, requests: sos }, null, 2), { headers: { "content-type": "application/json", "content-disposition": "attachment; filename=floodsetu-my-data.json" } });
}
