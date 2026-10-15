import { NextResponse } from "next/server";
import { dispatchDb } from "@/server/dispatch/store";

/** Public river monitoring feed (stage, flow, trend, thresholds per gauge) — what the control room's engine observes. */
export async function GET() {
  const r = dispatchDb.get().river;
  return NextResponse.json({ stations: r?.stations ?? [], asOf: r?.at ?? null, tick: r?.tick ?? null, stale: r ? Date.now() - Date.parse(r.at) > 2 * 60_000 : true });
}
