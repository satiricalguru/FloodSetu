import { record, ITEMS } from "@floodsetu/relief";
import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/server/auth";
import { reliefDb } from "@/server/relief/store";

const Body = z.object({
  type: z.enum(["IN_KIND_RECEIVED", "ALLOCATED", "DISPATCHED", "DISTRIBUTED"]),
  item: z.enum(ITEMS.map((i) => i.id) as [string, ...string[]]),
  qty: z.number().int().min(1).max(1_000_000),
  area: z.string().max(8).optional(),
  point: z.string().max(8).optional(),
  beneficiaries: z.number().int().min(0).max(10_000).optional(),
});

/** Verified relief partners record inventory flow: in → allocated → dispatched → distributed (timestamped, hash-chained). */
export async function POST(req: Request) {
  const g = await guard("/api/relief/partner", { roles: ["relief_partner", "admin"], mutate: true });
  if ("error" in g) return g.error;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const st = reliefDb.get();
  const e = record(st, p.data.type, g.claims.sub, { ...p.data });
  reliefDb.save();
  return NextResponse.json({ ok: true, entry: { seq: e.seq, hash: e.hash } });
}
