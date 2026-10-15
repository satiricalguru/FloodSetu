import { audit, coarsen, deviceHash, handleFor, liveRisk, newRequestId, phoneHash, placeInSim, uidFor, type SosInput, type SosRecord, type SosStatus } from "@floodsetu/dispatch";
import { buildWorld } from "@floodsetu/engine";
import { ENV } from "../env";
import { dispatchDb } from "./store";

const centres = Object.fromEntries(buildWorld().nbhds.map((n) => [n.id, { x: n.cx, y: n.cy }]));

export function createSos(input: SosInput, ctx: { uid?: string; otpAbuse?: boolean }): { record: SosRecord; created: boolean } {
  const db = dispatchDb.get();
  const existing = db.sos.find((r) => r.clientId === input.clientId);
  if (existing) return { record: existing, created: false }; // idempotent (offline outbox retries)
  let id = newRequestId();
  while (db.sos.some((r) => r.id === id)) id = newRequestId();
  const dev = deviceHash(ENV.pepper, input.deviceId);
  const ph = input.phone ? phoneHash(ENV.pepper, input.phone) : undefined;
  const sim = placeInSim(input, centres);
  const recent = db.sos.filter((r) => Date.now() - Date.parse(r.createdAt) < 15 * 60_000);
  const record: SosRecord = {
    id,
    clientId: input.clientId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    status: "received",
    phoneHash: ph,
    uid: ctx.uid ?? (input.phone ? uidFor(ENV.pepper, input.phone) : undefined),
    deviceHash: dev,
    handle: handleFor(ctx.uid ?? dev, id),
    people: input.people,
    urgency: input.urgency,
    needs: input.needs,
    text: input.text,
    lang: input.lang,
    precise: input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng, accuracy: input.accuracy } : null,
    coarse: input.lat !== undefined && input.lng !== undefined ? coarsen(input.lat, input.lng) : null,
    sim,
    timeline: [{ status: "received", at: new Date().toISOString(), note: sim.snapped ? `Location outside the simulated town — placed in ${sim.nbhd} for the demo` : undefined }],
    risk: { score: 0, reasons: [] },
  };
  record.risk = liveRisk(record, recent, { otpAbuse: ctx.otpAbuse });
  db.sos.push(record);
  audit(db.audit, "DISPATCH", record.handle, { event: "SOS_CREATED", sos: id, urgency: input.urgency, people: input.people, risk: record.risk.score, guest: !ctx.uid });
  if (record.risk.score >= 0.5) audit(db.audit, "FLAG", "system", { sos: id, risk: record.risk.score, reasons: record.risk.reasons, note: "routed to review — not blocked" });
  dispatchDb.save();
  return { record, created: true };
}

const STATUS_MAP: Record<string, SosStatus> = { open: "verification_pending", assigned: "assigned", in_progress: "rescue_in_progress", resolved: "resolved", false_report: "needs_attention" };

export function applyLiveStatuses(statuses: NonNullable<ReturnType<typeof dispatchDb.get>["live"]>["statuses"]) {
  const db = dispatchDb.get();
  const now = new Date().toISOString();
  for (const r of db.sos) {
    const s = statuses[r.id];
    if (!s) continue;
    r.incidentId = s.incident;
    if (s.reports > 1 && !r.mergedInto) {
      r.mergedInto = s.incident;
      r.timeline.push({ status: "merged", at: now, note: `Merged with ${s.reports - 1} other report(s) into incident ${s.incident} — help counts everyone` });
    }
    let next = STATUS_MAP[s.status] ?? r.status;
    if (next === "verification_pending" && s.verification === "verified") next = "verification_pending";
    if (next === "verification_pending" && s.unit) next = "assigned";
    if (next !== r.status) {
      // backfill lifecycle steps the 2 s poll skipped over, so the citizen stepper never jumps
      const order: SosStatus[] = ["received", "verification_pending", "assigned", "rescue_in_progress", "resolved"];
      const from = order.indexOf(r.status);
      const to = order.indexOf(next);
      if (from >= 0 && to > from + 1) for (const mid of order.slice(from + 1, to)) r.timeline.push({ status: mid, at: now, note: mid === "assigned" && s.unit ? `${s.unitType === "boat" ? "Boat team" : "Ground team"} ${s.unit}` : undefined });
      r.status = next;
      r.timeline.push({ status: next, at: now, note: s.unit ? `${s.unitType === "boat" ? "Boat team" : "Ground team"} ${s.unit}${s.eta != null ? ` · ETA ${s.eta} min` : ""}` : undefined });
      if (next === "assigned" && s.unit) audit(db.audit, "DISPATCH", "control_room", { event: "ASSIGNED", sos: r.id, unit: s.unit, eta: s.eta ?? null });
      if (next === "resolved") r.resolvedAt = now;
    }
    if (s.unit) r.assigned = { unit: s.unit, unitType: s.unitType ?? "boat", eta: s.eta ?? null, at: now, position: s.pos };
  }
  // location minimisation: purge precise coordinates after resolution + retention window
  for (const r of db.sos) if (r.resolvedAt && r.precise && Date.now() - Date.parse(r.resolvedAt) > ENV.retentionHours * 3_600_000) r.precise = null;
}

const TIPS: Record<"en" | "hi", Record<string, string[]>> = {
  en: {
    critical: ["Move to the highest floor or roof. Wave cloth or a torch.", "Switch off the mains if it is safe. Stay away from wires.", "Do not enter moving water — 60 cm can sweep away a car.", "Keep your phone on low power; we will update you here."],
    urgent: ["Move valuables, medicines and documents up high.", "Fill clean containers with drinking water now.", "Stay away from drains and manholes."],
    needs_help: ["Boil or chlorinate drinking water.", "Keep children away from floodwater.", "Watch for snakes and debris."],
  },
  hi: {
    critical: ["सबसे ऊँची मंज़िल या छत पर जाएँ। कपड़ा या टॉर्च हिलाएँ।", "सुरक्षित हो तो मेन स्विच बंद करें। तारों से दूर रहें।", "बहते पानी में न जाएँ — 60 सेमी पानी कार बहा सकता है।", "फ़ोन लो-पावर पर रखें; हम यहीं अपडेट देंगे।"],
    urgent: ["दवाइयाँ, दस्तावेज़ और ज़रूरी सामान ऊपर रखें।", "अभी साफ़ बर्तनों में पीने का पानी भर लें।", "नालों और मैनहोल से दूर रहें।"],
    needs_help: ["पानी उबालकर या क्लोरीन डालकर पिएँ।", "बच्चों को बाढ़ के पानी से दूर रखें।", "साँप और मलबे से सावधान रहें।"],
  },
};

/** What the citizen sees: never the crew's personal phone, never other people's data. */
export function citizenView(r: SosRecord) {
  const db = dispatchDb.get();
  const live = db.live;
  const stale = live ? Date.now() - Date.parse(live.at) > 2 * 60_000 : true;
  const unit = r.assigned && live ? live.units.find((u) => u.id === r.assigned!.unit) : undefined;
  const enRoute = r.status === "assigned" || r.status === "rescue_in_progress";
  return {
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
    people: r.people,
    urgency: r.urgency,
    needs: r.needs,
    timeline: r.timeline,
    incidentId: r.incidentId,
    mergedInto: r.mergedInto,
    team: r.assigned
      ? {
          role: r.assigned.unitType === "boat" ? "Boat rescue team (inflatable boat, 3–5 crew)" : "Ground rescue team (first aid / evacuation)",
          callsign: r.assigned.unit,
          eta: r.assigned.eta,
          position: enRoute && unit ? { x: unit.x, y: unit.y } : null,
          updatedAt: r.assigned.at,
        }
      : null,
    site: { x: r.sim.x, y: r.sim.y, nbhd: r.sim.nbhd, snapped: r.sim.snapped },
    liveAsOf: live?.at ?? null,
    stale,
    tips: TIPS[r.lang][r.urgency],
    thread: (db.threads[r.id] ?? []).filter((m) => m.public),
  };
}
