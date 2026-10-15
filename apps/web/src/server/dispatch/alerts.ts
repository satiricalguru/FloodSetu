import { audit, type SosRecord } from "@floodsetu/dispatch";
import { NBHD_DEFS } from "@floodsetu/engine";
import { dispatchDb, type DispatchDb, type RiverStation } from "./store";

type Alert = DispatchDb["broadcasts"][number];
const RANK: Record<string, number> = { no_data: -1, normal: 0, warning: 1, danger: 2, extreme: 3 };
const area = (nbhd: string) => NBHD_DEFS.find((n) => n.id === nbhd)?.name ?? nbhd;

function push(db: DispatchDb, a: Omit<Alert, "id" | "at" | "urgency" | "certainty">) {
  const b: Alert = { id: `CAP-${String(db.broadcasts.length + 2).padStart(4, "0")}`, at: new Date().toISOString(), urgency: "Immediate", certainty: "Observed", ...a };
  db.broadcasts.push(b);
  if (db.broadcasts.length > 200) db.broadcasts.splice(0, db.broadcasts.length - 200);
  audit(db.audit, "DISPATCH", "system", { event: "AUTO_ALERT", id: b.id, area: b.area, headline: b.headline });
}

/**
 * Automatic, CAP-shaped alerts from live conditions. Fires only when a river gauge or dam *changes* alert level, so a
 * stuck reading never spams. Escalations are Severe/Extreme; a gauge falling back below warning sends a Moderate
 * "receding" notice. Operators can still broadcast manually (POST /api/dispatch/broadcast).
 */
export function autoAlerts(river: RiverStation[] | undefined, dams: { id: string; alert: string; releaseCumecs: number; reservoirPct: number }[] | undefined) {
  const db = dispatchDb.get();
  const st = (db.alertState ??= {});
  for (const g of river ?? []) {
    if (g.status === "no_data" || g.stage === null) continue;
    const prev = st[g.id] ?? "normal";
    if (prev === g.status) continue;
    st[g.id] = g.status;
    const where = area(g.nbhd);
    const trend = g.trendCmHr > 2 ? `rising ${g.trendCmHr} cm/h` : g.trendCmHr < -2 ? `falling ${-g.trendCmHr} cm/h` : "steady";
    if (RANK[g.status]! > RANK[prev]!) {
      const sev: Alert["severity"] = g.status === "extreme" ? "Extreme" : g.status === "danger" ? "Severe" : "Moderate";
      const head = g.status === "extreme" ? `River above highest flood level at ${where}` : g.status === "danger" ? `River above DANGER level at ${where}` : `River above warning level at ${where}`;
      push(db, {
        area: where,
        headline: head,
        text: `${g.river} at ${g.name}: ${g.stage.toFixed(2)} m (danger ${g.danger} m), ${trend}, flow ${g.flow?.toLocaleString("en-IN")} m³/s. ${g.status === "warning" ? "Move valuables and medicines up; be ready to leave." : "Move to higher floors or the nearest shelter now. Do not enter moving water."}`,
        severity: sev,
        sender: `Automatic · river gauge ${g.id}`,
      });
    } else if (g.status === "normal") {
      push(db, { area: where, headline: `River back below warning level at ${where}`, text: `${g.name}: ${g.stage.toFixed(2)} m, ${trend}. Stay alert — roads and ground may still be unsafe.`, severity: "Moderate", sender: `Automatic · river gauge ${g.id}` });
    }
  }
  const DAM_RANK: Record<string, number> = { normal: 0, watch: 1, release: 2, breach: 3 };
  for (const d of dams ?? []) {
    const key = `dam:${d.id}`;
    const prev = st[key] ?? "normal";
    if (prev === d.alert) continue;
    st[key] = d.alert;
    const where = `Downstream of dam ${d.id}`;
    const res = `Reservoir at ${d.reservoirPct}% of full level`;
    if ((DAM_RANK[d.alert] ?? 0) < (DAM_RANK[prev] ?? 0)) {
      if (prev === "release" || prev === "breach") push(db, { area: where, headline: `Dam ${d.id}: release has stopped`, text: `${res}. River levels downstream may stay high for hours — keep away from the banks.`, severity: "Moderate", sender: `Automatic · dam ${d.id}` });
      continue;
    }
    if (d.alert === "watch") push(db, { area: where, headline: `Dam ${d.id} on watch: reservoir filling`, text: `${res}. A release is possible — riverside areas, be ready to move.`, severity: "Moderate", sender: `Automatic · dam ${d.id}` });
    else if (d.alert === "release") push(db, { area: where, headline: `Dam ${d.id} is releasing water`, text: `${res}${d.releaseCumecs ? `, releasing ${d.releaseCumecs.toLocaleString("en-IN")} m³/s` : ""}. Riverside areas downstream will rise quickly — move to higher ground.`, severity: "Severe", sender: `Automatic · dam ${d.id}` });
    else if (d.alert === "breach") push(db, { area: where, headline: `Dam ${d.id} BREACH — evacuate downstream now`, text: `${res}. Leave low ground immediately; do not wait for a rescue team.`, severity: "Extreme", sender: `Automatic · dam ${d.id}` });
  }
}

const mask = (n: string) => `••••••${n.slice(-4)}`;

/** Family alerts via the (mock) SMS gateway — shows up in /dev/inbox. Real deployments plug MSG91/Twilio in here. */
export function notifyFamily(r: SosRecord, kind: "sent" | "assigned" | "safe" | "silent") {
  if (!r.altContact || r.familyNotified?.includes(kind)) return; // each kind of text goes out once
  (r.familyNotified ??= []).push(kind);
  const db = dispatchDb.get();
  const link = `/track/${r.id}`;
  const text =
    kind === "sent"
      ? `FloodSetu: someone who listed you as family sent an SOS (${r.id}, ${r.urgency.replace("_", " ")}, ${r.people} people). Track: ${link}`
      : kind === "assigned"
        ? `FloodSetu: a rescue team${r.assigned ? ` (${r.assigned.unit})` : ""} is on the way for ${r.id}. Track: ${link}`
        : kind === "safe"
          ? `FloodSetu: ${r.id} is marked SAFE by the rescue team.`
          : `FloodSetu: we lost contact with the phone that sent ${r.id}. The rescue continues at the last known location. Track: ${link}`;
  db.devInbox.push({ at: new Date().toISOString(), to: mask(r.altContact), text });
}
