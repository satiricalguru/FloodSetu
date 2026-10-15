import { audit } from "@jalsetu/dispatch";
import { record } from "@jalsetu/relief";
import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";
import { reliefDb } from "@/server/relief/store";

const Body = z.object({ orgId: z.string(), grant: z.boolean(), authority: z.string().min(3).max(120) });

/** Verified badges only for officially authorised orgs — granted by an admin, with an audit trail. */
export async function POST(req: Request) {
  const g = await guard("/api/admin", { roles: ["admin"], mutate: true });
  if ("error" in g) return g.error;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const r = reliefDb.get();
  const org = r.orgs.find((o) => o.id === p.data.orgId);
  if (!org) return NextResponse.json({ error: "unknown org" }, { status: 404 });
  org.verified = p.data.grant;
  org.badge = p.data.grant ? { grantedBy: g.claims.sub, at: new Date().toISOString(), authority: p.data.authority } : undefined;
  record(r, "BADGE_GRANTED", g.claims.sub, { org: org.id, grant: p.data.grant, authority: p.data.authority });
  audit(dispatchDb.get().audit, p.data.grant ? "BADGE_GRANT" : "BADGE_REVOKE", g.claims.sub, { org: org.id, authority: p.data.authority });
  reliefDb.save();
  dispatchDb.save();
  return NextResponse.json({ ok: true, org });
}
