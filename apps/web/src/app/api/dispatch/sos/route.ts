import { deviceHash, deviceFlagged, SosInput } from "@jalsetu/dispatch";
import { NextResponse } from "next/server";
import { clientIp, session } from "@/server/auth";
import { citizenView, createSos } from "@/server/dispatch/service";
import { dispatchDb } from "@/server/dispatch/store";
import { ENV } from "@/server/env";

/** Guest SOS — NO login required. Tiny payload, idempotent by clientId (offline outbox retries are safe). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const p = SosInput.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "invalid", issues: p.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  const s = await session();
  const db = dispatchDb.get();
  // abuse limits are generous and only FLAG — an SOS is never refused for rate reasons
  const ip = await clientIp();
  const dev = deviceHash(ENV.pepper, p.data.deviceId);
  const recentFromDevice = db.sos.filter((r) => r.deviceHash === dev && Date.now() - Date.parse(r.createdAt) < 10 * 60_000).length;
  const otpAbuse = deviceFlagged(db.otp, p.data.deviceId) || recentFromDevice > 5;
  void ip;
  const { record, created } = createSos(p.data, { uid: s?.sub, otpAbuse });
  return NextResponse.json({ ok: true, created, request: citizenView(record) }, { status: created ? 201 : 200 });
}

/** My requests (by device) — the citizen's own view only. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const device = url.searchParams.get("device");
  const s = await session();
  const db = dispatchDb.get();
  if (s && (s.role === "operator" || s.role === "admin")) {
    return NextResponse.json({ requests: db.sos.slice(-200).map((r) => ({ ...citizenView(r), handle: r.handle, risk: r.risk, precise: r.status !== "resolved" ? r.precise : null })) });
  }
  if (!device && !s) return NextResponse.json({ requests: [] });
  const dev = device ? deviceHash(ENV.pepper, device) : null;
  const mine = db.sos.filter((r) => (dev && r.deviceHash === dev) || (s && r.uid === s.sub));
  return NextResponse.json({ requests: mine.map(citizenView) });
}
