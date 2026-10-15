import { audit } from "@jalsetu/dispatch";
import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";

const Body = z.object({ sos: z.string(), decision: z.enum(["verified", "under_review", "needs_attention"]), note: z.string().max(200).optional() });

/** Operator verification decision — always audited; never blocks a critical dispatch. */
export async function POST(req: Request) {
  const g = await guard("/api/dispatch/verify", { roles: ["operator", "admin"], mutate: true });
  if ("error" in g) return g.error;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = dispatchDb.get();
  const r = db.sos.find((x) => x.id === p.data.sos);
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  r.timeline.push({ status: p.data.decision, at: new Date().toISOString(), note: p.data.note });
  audit(db.audit, "VERIFY", g.claims.sub, { sos: r.id, decision: p.data.decision, note: p.data.note ?? null });
  dispatchDb.save();
  return NextResponse.json({ ok: true });
}
