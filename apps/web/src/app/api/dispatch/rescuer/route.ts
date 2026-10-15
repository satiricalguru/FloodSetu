import { audit } from "@jalsetu/dispatch";
import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";

export async function GET(req: Request) {
  const g = await guard("/api/dispatch/rescuer", { roles: ["rescuer", "operator", "admin"] });
  if ("error" in g) return g.error;
  const unitId = g.claims.role === "rescuer" ? g.claims.unit : (new URL(req.url).searchParams.get("unit") ?? undefined);
  const db = dispatchDb.get();
  const unit = db.live?.units.find((u) => u.id === unitId) ?? null;
  const sos = unit?.task ? ((unit.task as { sos?: string[] }).sos ?? []).map((id) => db.sos.find((r) => r.id === id)).filter(Boolean).map((r) => ({ id: r!.id, people: r!.people, needs: r!.needs, text: r!.text, handle: r!.handle, precise: r!.precise })) : [];
  return NextResponse.json({ unitId, unit, liveSos: sos, tick: db.live?.tick ?? null, asOf: db.live?.at ?? null, stale: db.live ? Date.now() - Date.parse(db.live.at) > 2 * 60_000 : true });
}

const Field = z.object({
  kind: z.enum(["ack", "unable", "road_blocked", "bridge_damaged", "water_level", "status", "picked_up", "dropped"]),
  taskId: z.string().optional(),
  incident: z.string().optional(),
  reason: z.string().max(120).optional(),
  note: z.string().max(240).optional(),
  count: z.number().int().min(0).max(100).optional(),
  lamport: z.number().int().min(0),
  deviceId: z.string().min(4),
  clientAt: z.string().optional(),
});

/** Field events are append-only; merged by (deviceId, lamport) so offline replays never duplicate. */
export async function POST(req: Request) {
  const g = await guard("/api/dispatch/rescuer", { roles: ["rescuer", "operator", "admin"], mutate: true });
  if ("error" in g) return g.error;
  const p = Field.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = dispatchDb.get();
  if (db.field.some((f) => f.deviceId === p.data.deviceId && f.lamport === p.data.lamport)) return NextResponse.json({ ok: true, duplicate: true });
  const unit = g.claims.unit ?? "OPS";
  db.field.push({ seq: ++db.fieldSeq, unit, kind: p.data.kind, taskId: p.data.taskId, incident: p.data.incident, reason: p.data.reason, note: p.data.note, count: p.data.count, at: p.data.clientAt ?? new Date().toISOString(), lamport: p.data.lamport, deviceId: p.data.deviceId });
  if (p.data.kind === "unable" || p.data.kind === "road_blocked" || p.data.kind === "bridge_damaged") audit(db.audit, "OVERRIDE", unit, { field: p.data.kind, task: p.data.taskId ?? null, reason: p.data.reason ?? null });
  dispatchDb.save();
  return NextResponse.json({ ok: true, seq: db.fieldSeq });
}
