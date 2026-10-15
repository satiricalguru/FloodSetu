import { CONFIG } from "./config";
import { hashStr, mulberry32, pick, randInt, requestId, type Rng } from "./rng";
import type { Need, Scenario, ScenarioEvent, SosSpec, Urgency, World } from "./types";
import { interpCurve, nodeDepth } from "./world";

const TEXTS: Record<Urgency, string[]> = {
  critical: [
    "Water up to the ceiling, we are on the roof with children",
    "Paani chhat tak aa gaya, bachao, buzurg hain",
    "House collapsing, 2 injured, water rising fast",
    "Old man unconscious, water entering first floor",
    "Pregnant woman in labour, cannot leave house, water chest deep",
  ],
  urgent: [
    "Water entering house, need evacuation",
    "Ghar mein paani ghus gaya hai, madad chahiye",
    "Stuck on first floor, water rising slowly",
    "Elderly couple alone, cannot walk through water",
    "Family of six trapped, no food since morning",
  ],
  needs_help: [
    "Need drinking water and food, safe for now",
    "Pani aur khana chahiye, bacche bhookhe hain",
    "Need medicines for diabetes, cannot go out",
    "Power out, need torch and dry food",
  ],
};

const NEED_POOL: Need[] = ["elderly", "child", "pregnant", "disabled", "medical", "injured", "pets"];

export function truthLevel(s: Scenario, nbhd: string, t: number, surges: { nbhds: string[]; delta: number; tick: number; duration: number }[] = []): number {
  let lvl = interpCurve(s.flood[nbhd], t);
  for (const g of surges) {
    if (!g.nbhds.includes(nbhd) || t < g.tick) continue;
    const ramp = Math.min(1, (t - g.tick) / 20);
    const decay = t > g.tick + g.duration ? Math.max(0, 1 - (t - g.tick - g.duration) / 60) : 1;
    lvl += g.delta * ramp * decay;
  }
  return lvl;
}

function surgesOf(s: Scenario) {
  return s.events.filter((e): e is Extract<ScenarioEvent, { type: "RAIN_SURGE" }> => e.type === "RAIN_SURGE").map((e) => ({ nbhds: e.nbhds, delta: e.delta, tick: e.tick, duration: e.duration }));
}

function floodedNodes(world: World, s: Scenario, nbhd: string, t: number, minDepth = 0.15) {
  const surges = surgesOf(s);
  return world.nodes.filter((n) => n.kind === "junction" && n.nbhd === nbhd && nodeDepth(n, (nb) => truthLevel(s, nb, t, surges)) >= minDepth);
}

function makeSos(rng: Rng, world: World, s: Scenario, t: number, nbhd: string, urgency: Urgency, extra: Partial<SosSpec> = {}): SosSpec | null {
  const cands = floodedNodes(world, s, nbhd, t);
  const pool = cands.length ? cands : world.nodes.filter((n) => n.kind === "junction" && n.nbhd === nbhd);
  if (!pool.length) return null;
  const node = pick(rng, pool);
  const needs: Need[] = [];
  for (const nd of NEED_POOL) if (rng() < (urgency === "critical" ? 0.22 : 0.12)) needs.push(nd);
  if (urgency === "critical" && rng() < 0.08) needs.push("trapped"); // collapsed / damaged structure → engineers
  const people = urgency === "needs_help" ? randInt(rng, 1, 5) : randInt(rng, 1, 9);
  return {
    id: requestId(rng),
    tick: t,
    node: node.id,
    x: node.x + (rng() - 0.5) * 0.06,
    y: node.y + (rng() - 0.5) * 0.06,
    nbhd,
    people,
    urgency,
    needs,
    text: pick(rng, TEXTS[urgency]),
    phone: `ph_${Math.floor(rng() * 1e8).toString(36)}`,
    source: "citizen",
    real: true,
    ...extra,
  };
}

function urgencyFrom(rng: Rng, mix: [number, number, number]): Urgency {
  const r = rng() * (mix[0] + mix[1] + mix[2]);
  return r < mix[0] ? "critical" : r < mix[0] + mix[1] ? "urgent" : "needs_help";
}

/**
 * Expand generators (sosRate, SOS_BURST) into concrete, seeded SOS events.
 * Done ONCE per scenario+seed, so every strategy sees the identical request stream.
 */
export function expandScenario(s: Scenario, world: World): ScenarioEvent[] {
  const rng = mulberry32(s.seed ^ hashStr(s.id));
  const out: ScenarioEvent[] = [];
  const nb = world.nbhds;

  if (s.sosRate) {
    const mix = s.sosRate.urgencyMix ?? [0.25, 0.45, 0.3];
    for (let t = 1; t < Math.min(s.sosRate.until, s.duration); t++) {
      let lambda = s.sosRate.perTick;
      while (lambda > 0) {
        if (rng() < Math.min(1, lambda)) {
          // weight neighbourhoods by flooded nodes × population × explicit weight
          const weights = nb.map((n) => floodedNodes(world, s, n.id, t, 0.2).length * n.population * (s.sosRate!.weights?.[n.id] ?? 1));
          const tot = weights.reduce((a, b) => a + b, 0);
          if (tot > 0) {
            let r = rng() * tot;
            let k = 0;
            while (r > weights[k]) r -= weights[k++];
            const fake = rng() < (s.sosRate.fakeShare ?? 0);
            const sos = makeSos(rng, world, s, t, nb[k].id, urgencyFrom(rng, mix), fake ? { real: false } : {});
            if (sos) out.push({ tick: t, type: "SOS", sos });
          }
        }
        lambda -= 1;
      }
    }
  }

  const buildingAt = new Map<string, { node: number; x: number; y: number }>();
  for (const ev of s.events) {
    if (ev.type !== "SOS_BURST") {
      if (ev.type === "SOS") {
        let sos = { ...ev.sos, id: ev.sos.id ?? requestId(rng) };
        if (sos.node === undefined && sos.x === undefined && sos.nbhd) {
          // place in the neighbourhood (prefer flooded nodes) deterministically; one building = one place
          const known = sos.building ? buildingAt.get(sos.building) : undefined;
          const placed = known ?? makeSos(rng, world, s, ev.tick, sos.nbhd, sos.urgency);
          if (placed) {
            sos = { ...sos, node: placed.node, x: placed.x! + (known ? (rng() - 0.5) * 0.01 : 0), y: placed.y! + (known ? (rng() - 0.5) * 0.01 : 0) };
            if (sos.building && !known) buildingAt.set(sos.building, { node: placed.node!, x: placed.x!, y: placed.y! });
          }
        }
        out.push({ ...ev, sos });
      } else out.push(ev);
      continue;
    }
    const mix = ev.urgencyMix ?? [0.35, 0.45, 0.2];
    const base: SosSpec[] = [];
    const genuine = Math.max(0, ev.count - (ev.duplicates ?? 0));
    const sameB = ev.sameBuilding ?? 0;
    // genuine same-building clusters: many phones, one building — a REAL large incident
    for (let b = 0; b < sameB; b++) {
      const anchor = makeSos(rng, world, s, ev.tick, ev.nbhd, "critical");
      if (!anchor) continue;
      const building = `BLD-${anchor.node}-${b}`;
      const n = randInt(rng, 4, 7);
      for (let k = 0; k < n; k++) {
        const t = ev.tick + randInt(rng, 0, 15);
        base.push({ ...anchor, id: requestId(rng), tick: t, building, people: randInt(rng, 2, 6), phone: `ph_${Math.floor(rng() * 1e8).toString(36)}`, x: anchor.x! + (rng() - 0.5) * 0.02, y: anchor.y! + (rng() - 0.5) * 0.02 });
      }
    }
    while (base.length < genuine) {
      const sos = makeSos(rng, world, s, ev.tick + randInt(rng, 0, 19), ev.nbhd, urgencyFrom(rng, mix));
      if (sos) base.push(sos);
      else break;
    }
    // duplicates: the same person re-sending (same phone, same text, minutes later)
    const dups: SosSpec[] = [];
    for (let d = 0; d < (ev.duplicates ?? 0) && base.length; d++) {
      const src = pick(rng, base);
      dups.push({ ...src, id: requestId(rng), tick: Math.min(s.duration - 1, src.tick + randInt(rng, 1, 12)) });
    }
    for (const sos of [...base, ...dups]) out.push({ tick: sos.tick, type: "SOS", sos });
  }

  out.sort((a, b) => a.tick - b.tick);
  return out;
}

export function validateScenario(s: Scenario): string[] {
  const errs: string[] = [];
  if (!s.id) errs.push("missing id");
  if (!(s.duration > 0)) errs.push("duration must be > 0");
  for (const ev of s.events) if (ev.tick < 0 || ev.tick >= s.duration) errs.push(`event ${ev.type} at ${ev.tick} outside duration`);
  for (const k of Object.keys(s.flood)) if (!["GHT", "PRB", "SHN", "RLC", "MCH", "UCH"].includes(k)) errs.push(`unknown nbhd ${k}`);
  return errs;
}

export function clock(tick: number, startMinutes = 6 * 60): string {
  const m = startMinutes + tick;
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export const DEFAULT_MAX_WAIT = CONFIG.MAX_WAIT;
