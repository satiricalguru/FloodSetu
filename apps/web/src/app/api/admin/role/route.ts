import { audit } from "@jalsetu/dispatch";
import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";

const Body = z.object({ uid: z.string(), role: z.enum(["citizen", "rescuer", "operator", "shelter", "relief_partner", "admin"]), unit: z.string().regex(/^[BG]-\d{1,2}$/).optional() });

export async function POST(req: Request) {
  const g = await guard("/api/admin", { roles: ["admin"], mutate: true });
  if ("error" in g) return g.error;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const d = dispatchDb.get();
  const u = d.users.find((x) => x.uid === p.data.uid);
  if (!u) return NextResponse.json({ error: "unknown user" }, { status: 404 });
  const before = u.role;
  u.role = p.data.role;
  u.unit = p.data.unit;
  audit(d.audit, "ROLE_CHANGE", g.claims.sub, { user: `${u.uid.slice(0, 10)}…`, from: before, to: p.data.role, unit: p.data.unit ?? null });
  dispatchDb.save();
  return NextResponse.json({ ok: true });
}
