import { parseSms } from "@floodsetu/dispatch";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSos } from "@/server/dispatch/service";

/** MOCKED SMS/USSD gateway: "SOS 4 C near ghat 2" from a feature phone becomes a normal SOS. */
const Body = z.object({ from: z.string().regex(/^\+?\d{10,13}$/), body: z.string().max(160) });
const AREAS: [RegExp, string][] = [[/ghat|घाट/i, "GHT"], [/machhua|machua|fisher|मछुआ/i, "MCH"], [/purani|old town|basti/i, "PRB"], [/rail|station/i, "RLC"], [/shanti/i, "SHN"], [/pahadi|ridge/i, "UCH"]];

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const parsed = parseSms(p.data.body);
  if (!parsed) return NextResponse.json({ reply: "Format: SOS <people> <C|U|H> <landmark>. Example: SOS 4 C near ghat 2. For life-threatening emergencies call 112." });
  const nbhd = AREAS.find(([re]) => re.test(parsed.landmark))?.[1] ?? "GHT";
  const { record } = createSos({ clientId: `sms-${p.data.from}-${Date.now()}`, people: parsed.people, urgency: parsed.urgency, needs: [], text: `[SMS] ${parsed.landmark}`, phone: p.data.from, nbhd, deviceId: `sms:${p.data.from}`, lang: "en" }, {});
  return NextResponse.json({ reply: `FloodSetu: request ${record.id} received (${parsed.people} people, ${parsed.urgency}). Stay on the highest floor. Reply STATUS ${record.id} for updates.`, id: record.id });
}
