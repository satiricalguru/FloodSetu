import { summariseAffectedAreas, type AreaInput } from "@floodsetu/dispatch";
import { NextResponse } from "next/server";
import { guard } from "@/server/auth";
import { publishSummaries } from "@/server/contract";
import { applyLiveStatuses } from "@/server/dispatch/service";
import { dispatchDb, type DispatchDb } from "@/server/dispatch/store";

/** Control room ↔ server bridge (operator only). Pulls new phone SOS + field events; pushes live statuses. */
export async function POST(req: Request) {
  const g = await guard("/api/dispatch/live", { roles: ["operator", "admin"], mutate: true });
  if ("error" in g) return g.error;
  const body = (await req.json().catch(() => ({}))) as { fieldSince?: number; tick?: number; statuses?: NonNullable<DispatchDb["live"]>["statuses"]; units?: NonNullable<DispatchDb["live"]>["units"]; scenario?: string; strategy?: string; areas?: AreaInput[] };
  const db = dispatchDb.get();
  db.live = { statuses: body.statuses ?? {}, units: body.units ?? [], tick: body.tick ?? 0, at: new Date().toISOString(), scenario: body.scenario, strategy: body.strategy };
  applyLiveStatuses(db.live.statuses);
  if (Array.isArray(body.areas)) publishSummaries(summariseAffectedAreas(body.areas)); // one-way, aggregated, k-anonymous
  const pending = db.sos.filter((r) => !r.injected);
  for (const r of pending) r.injected = true;
  const field = db.field.filter((f) => f.seq > (body.fieldSince ?? 0));
  dispatchDb.save();
  return NextResponse.json({ sos: pending, field });
}
