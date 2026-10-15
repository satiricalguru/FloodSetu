import { audit } from "@jalsetu/dispatch";
import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";

/** Area-wide alerts in a CAP-1.2-shaped structure (exportable to NDMA SACHET-style systems). */
export async function GET() {
  const db = dispatchDb.get();
  const seed = db.broadcasts.length
    ? db.broadcasts
    : [{ id: "CAP-0001", at: new Date().toISOString(), area: "GHT,MCH", headline: "Severe flooding along the river", text: "Move to the nearest shelter or highest floor. Boats are operating from Ghats 1–6. Call 112 for life-threatening emergencies.", severity: "Severe" as const, urgency: "Immediate" as const, certainty: "Observed" as const, sender: "Jalnagar DDMA (synthetic)" }];
  return NextResponse.json({ alerts: [...seed].reverse().map((b) => ({ ...b, cap: { identifier: b.id, sender: b.sender, sent: b.at, status: "Exercise", msgType: "Alert", scope: "Public", info: { category: "Met", event: "Flood", urgency: b.urgency, severity: b.severity, certainty: b.certainty, headline: b.headline, description: b.text, area: { areaDesc: b.area } } } })) });
}

const Body = z.object({ area: z.string().max(40), headline: z.string().min(3).max(120), text: z.string().min(3).max(600), severity: z.enum(["Extreme", "Severe", "Moderate"]).default("Severe") });

export async function POST(req: Request) {
  const g = await guard("/api/dispatch/live", { roles: ["operator", "admin"], mutate: true });
  if ("error" in g) return g.error;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = dispatchDb.get();
  const b = { id: `CAP-${String(db.broadcasts.length + 2).padStart(4, "0")}`, at: new Date().toISOString(), ...p.data, urgency: "Immediate" as const, certainty: "Observed" as const, sender: "Jalnagar Control Room (synthetic)" };
  db.broadcasts.push(b);
  audit(db.audit, "DISPATCH", g.claims.sub, { event: "BROADCAST", id: b.id, area: b.area });
  dispatchDb.save();
  return NextResponse.json({ ok: true, alert: b });
}
