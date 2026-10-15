import { deviceHash } from "@floodsetu/dispatch";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dispatchDb } from "@/server/dispatch/store";
import { ENV } from "@/server/env";

const Body = z.object({ device: z.string().min(4).max(128), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100_000).optional() });

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const k = Math.PI / 180;
  const x = (b.lng - a.lng) * k * Math.cos(((a.lat + b.lat) / 2) * k);
  const y = (b.lat - a.lat) * k;
  return Math.sqrt(x * x + y * y) * 6_371_000;
};

/**
 * Live GPS while a request is active (owner only, matched by device hash). The newest fix becomes the precise
 * location the assigned team sees; a short track is kept so the team can see movement. Purged after resolution.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = dispatchDb.get();
  const r = db.sos.find((x) => x.id === id.toUpperCase());
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (deviceHash(ENV.pepper, p.data.device) !== r.deviceHash) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (r.status === "resolved") return NextResponse.json({ ok: true, ignored: "resolved" });
  const fix = { lat: p.data.lat, lng: p.data.lng, accuracy: p.data.accuracy, at: new Date().toISOString() };
  const last = r.track?.at(-1);
  const moved = last ? metres(last, fix) : 0;
  r.precise = { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy };
  r.lastSeenAt = fix.at; // a location fix is also a heartbeat
  r.track = [...(r.track ?? []), fix].slice(-20);
  if (moved >= 75) r.timeline.push({ status: "moved", at: fix.at, note: `Location updated — moved about ${Math.round(moved)} m` });
  dispatchDb.save();
  return NextResponse.json({ ok: true, moved: Math.round(moved) });
}
