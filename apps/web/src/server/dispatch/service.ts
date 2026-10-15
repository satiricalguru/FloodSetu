import { audit, coarsen, deviceHash, handleFor, liveRisk, newRequestId, phoneHash, placeInSim, uidFor, type SosInput, type SosRecord, type SosStatus } from "@floodsetu/dispatch";
import { buildWorld } from "@floodsetu/engine";
import { ENV } from "../env";
import { notifyFamily } from "./alerts";
import { dispatchDb } from "./store";
import { REGIONAL } from "@/lib/i18n-regional";

const centres = Object.fromEntries(buildWorld().nbhds.map((n) => [n.id, { x: n.cx, y: n.cy }]));

export const COOLDOWN_MS = 60_000;
const URG: Record<string, number> = { needs_help: 0, urgent: 1, critical: 2 };

export function createSos(input: SosInput, ctx: { uid?: string; otpAbuse?: boolean }): { record: SosRecord; created: boolean; cooldown?: boolean } {
  const db = dispatchDb.get();
  const existing = db.sos.find((r) => r.clientId === input.clientId);
  if (existing) return { record: existing, created: false }; // idempotent (offline outbox retries)
  const dev = deviceHash(ENV.pepper, input.deviceId);
  // Cooldown: a second SOS from the same phone within 60 s is folded into the first — never refused. If it is more
  // serious (e.g. "I'm in the water" after a form SOS) the open request is upgraded, so escalation always gets through.
  const recentOwn = db.sos.filter((r) => r.deviceHash === dev && r.status !== "resolved" && Date.now() - Date.parse(r.createdAt) < COOLDOWN_MS).at(-1);
  if (recentOwn) {
    const now = new Date().toISOString();
    const upgrades: string[] = [];
    if (URG[input.urgency]! > URG[recentOwn.urgency]!) (recentOwn.urgency = input.urgency), upgrades.push(`urgency → ${input.urgency.replace("_", " ")}`);
    const newNeeds = input.needs.filter((n) => !recentOwn.needs.includes(n));
    if (newNeeds.length) (recentOwn.needs = [...recentOwn.needs, ...newNeeds]), upgrades.push(`+ ${newNeeds.join(", ")}`);
    if (input.people > recentOwn.people) (recentOwn.people = input.people), upgrades.push(`${input.people} people`);
    if (input.lat !== undefined && input.lng !== undefined) recentOwn.precise = { lat: input.lat, lng: input.lng, accuracy: input.accuracy };
    recentOwn.timeline.push({ status: "received", at: now, note: upgrades.length ? `Repeat SOS within 60 s — request updated (${upgrades.join(", ")})` : "Repeat SOS within 60 s — already received, help is on the way" });
    if (upgrades.length) recentOwn.injected = false; // re-deliver the escalated request to the control room
    audit(db.audit, "DISPATCH", recentOwn.handle, { event: "SOS_COOLDOWN_MERGE", sos: recentOwn.id, upgrades });
    dispatchDb.save();
    return { record: recentOwn, created: false, cooldown: true };
  }
  let id = newRequestId();
  while (db.sos.some((r) => r.id === id)) id = newRequestId();
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
    lastSeenAt: new Date().toISOString(),
    battery: input.battery ?? null,
    altContactHash: input.altPhone ? phoneHash(ENV.pepper, input.altPhone) : undefined,
    altContact: input.altPhone || undefined,
    track: input.lat !== undefined && input.lng !== undefined ? [{ lat: input.lat, lng: input.lng, accuracy: input.accuracy, at: new Date().toISOString() }] : [],
  };
  record.risk = liveRisk(record, recent, { otpAbuse: ctx.otpAbuse });
  db.sos.push(record);
  audit(db.audit, "DISPATCH", record.handle, { event: "SOS_CREATED", sos: id, urgency: input.urgency, people: input.people, risk: record.risk.score, guest: !ctx.uid });
  notifyFamily(record, "sent");
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
      if (next === "assigned" || next === "rescue_in_progress") {
        if (s.unit) r.assigned = { unit: s.unit, unitType: s.unitType ?? "boat", eta: s.eta ?? null, at: now, position: s.pos };
        notifyFamily(r, "assigned");
      }
      if (next === "resolved") notifyFamily(r, "safe");
    }
    if (s.unit) r.assigned = { unit: s.unit, unitType: s.unitType ?? "boat", eta: s.eta ?? null, at: now, position: s.pos };
  }
  // location minimisation: purge precise coordinates after resolution + retention window
  for (const r of db.sos)
    if (r.resolvedAt && (r.precise || r.altContact || r.track?.length) && Date.now() - Date.parse(r.resolvedAt) > ENV.retentionHours * 3_600_000) (r.precise = null), (r.altContact = undefined), (r.track = []);
}

const TIPS: Record<string, Record<string, string[]>> = {
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

/** en/hi have full tip sets; regional languages get the short translated set, English fills any gap. */
function tipsFor(lang: string, urgency: string): string[] {
  if (TIPS[lang]) return TIPS[lang]![urgency] ?? TIPS.en![urgency] ?? [];
  const r = (REGIONAL as Record<string, Record<string, string>>)[lang];
  if (!r) return TIPS.en![urgency] ?? [];
  const keys = urgency === "critical" ? ["tipC1", "tipC2", "tipC3"] : urgency === "urgent" ? ["tipU1", "tipC2"] : ["tipH1"];
  const out = keys.map((k) => r[k]).filter((x): x is string => !!x);
  return out.length ? out : TIPS.en![urgency] ?? [];
}

export const DEVICE_SILENT_MS = 90_000;

/**
 * Heartbeat watchdog ("what if the caller's phone drowns?"). Every status poll is a heartbeat. If an ACTIVE request's
 * phone is silent for 90 s, we do NOT cancel anything: the request keeps its last-known location, the control room
 * escalates it to critical, the team is told to search the last-known position, and the alternate contact is
 * called/SMSed (mock). Low battery (≤10 %) is flagged early so the system acts before the phone dies.
 */
export function watchDevices(): { lost: SosRecord[]; lowBattery: SosRecord[] } {
  const db = dispatchDb.get();
  const now = Date.now();
  const lost: SosRecord[] = [];
  const lowBattery: SosRecord[] = [];
  for (const r of db.sos) {
    if (r.status === "resolved" || r.status === "needs_attention" || !r.injected || r.deviceLost) continue;
    const seen = Date.parse(r.lastSeenAt ?? r.createdAt);
    if (now - seen > DEVICE_SILENT_MS) {
      r.deviceLost = { at: new Date().toISOString(), lastSeenAt: r.lastSeenAt ?? r.createdAt };
      r.timeline.push({ status: "device_lost", at: new Date().toISOString(), note: `Phone unreachable since ${new Date(seen).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}. Request kept at last-known location, escalated to CRITICAL${r.altContactHash ? "; calling your alternate number" : ""}; IVR/SMS callback attempted (mock).` });
      audit(db.audit, "DISPATCH", "watchdog", { event: "DEVICE_LOST", sos: r.id, lastSeen: r.lastSeenAt ?? null, altContact: !!r.altContactHash });
      lost.push(r);
      notifyFamily(r, "silent");
    } else if (r.battery !== null && r.battery !== undefined && r.battery <= 0.1 && !r.batteryWarned) {
      r.batteryWarned = true;
      r.timeline.push({ status: "battery_low", at: new Date().toISOString(), note: `Battery ${Math.round(r.battery * 100)}% — last location saved; if the phone dies the team still comes here.` });
      lowBattery.push(r);
    }
  }
  return { lost, lowBattery };
}

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
    tips: tipsFor(r.lang, r.urgency),
    thread: (db.threads[r.id] ?? []).filter((m) => m.public),
    deviceLost: r.deviceLost ?? null,
    battery: r.battery ?? null,
  };
}
