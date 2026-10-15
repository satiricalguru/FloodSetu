import { deviceHash } from "@floodsetu/dispatch";
import { NextResponse } from "next/server";
import { session } from "@/server/auth";
import { citizenView } from "@/server/dispatch/service";
import { dispatchDb } from "@/server/dispatch/store";
import { ENV } from "@/server/env";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = dispatchDb.get().sos.find((x) => x.id === id.toUpperCase());
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  const device = new URL(req.url).searchParams.get("device");
  const s = await session();
  const owner = (device && deviceHash(ENV.pepper, device) === r.deviceHash) || (s && s.sub === r.uid);
  const staff = s && ["operator", "admin", "rescuer"].includes(s.role);
  if (!owner && !staff) {
    // anyone with the ID gets only coarse status (e.g. a relative checking) — no location, no people details
    return NextResponse.json({ request: { id: r.id, status: r.status, timeline: r.timeline.map((t) => ({ status: t.status, at: t.at })), limited: true } });
  }
  return NextResponse.json({ request: citizenView(r) });
}
