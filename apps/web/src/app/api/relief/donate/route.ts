import { donate, reliefFlags } from "@jalsetu/relief";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ENV } from "@/server/env";
import { reliefDb } from "@/server/relief/store";

const Body = z.object({ campaignId: z.string(), amountInr: z.number().int().min(10).max(1_000_000), contact: z.string().min(3).max(120) });

/** SIMULATED donation (no real payments). Only verified-org campaigns accept donations. */
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const st = reliefDb.get();
  if (reliefFlags(st).some((f) => f.kind === "unverified_campaign" && f.ref === p.data.campaignId)) return NextResponse.json({ error: "This campaign is not run by a verified organisation." }, { status: 403 });
  if (!st.campaigns.some((c) => c.id === p.data.campaignId)) return NextResponse.json({ error: "unknown campaign" }, { status: 404 });
  const e = donate(st, p.data.campaignId, p.data.amountInr, p.data.contact, ENV.pepper);
  reliefDb.save();
  return NextResponse.json({ ok: true, receipt: { seq: e.seq, hash: e.hash, prev: e.prev, simulated: true } });
}
