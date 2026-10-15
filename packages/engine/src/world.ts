import { CONFIG } from "./config";
import { mulberry32 } from "./rng";
import type { AgentType, Neighbourhood, ShelterDef, WEdge, WNode, World } from "./types";

/**
 * "Jalnagar" — a fictional riverine town, 10 km × 7 km, generated deterministically.
 * A sinuous river runs west→east; six neighbourhoods differ in elevation, population and vulnerability.
 */
export const W_KM = 10;
export const H_KM = 7;
const GRID = 0.5;

export function riverY(x: number): number {
  return 3.5 + 0.55 * Math.sin(0.62 * x + 0.4) + 0.2 * Math.sin(1.7 * x);
}

export const NBHD_DEFS: Omit<Neighbourhood, "cx" | "cy" | "polygon">[] = [
  { id: "GHT", name: "Ghat Tola", nameHi: "घाट टोला", population: 9000, vulnerability: 0.8, note: "Riverside, dense informal housing" },
  { id: "PRB", name: "Purani Basti", nameHi: "पुरानी बस्ती", population: 12000, vulnerability: 0.6, note: "Old town, high elderly share" },
  { id: "SHN", name: "Shanti Nagar", nameHi: "शांति नगर", population: 10000, vulnerability: 0.3, note: "Northern upland, schools & hospital" },
  { id: "RLC", name: "Rail Colony", nameHi: "रेल कॉलोनी", population: 8000, vulnerability: 0.35, note: "Railway quarters on raised ground" },
  { id: "MCH", name: "Machhua Tola", nameHi: "मछुआ टोला", population: 6000, vulnerability: 0.7, note: "Fishers' quarter, lowest ground" },
  { id: "UCH", name: "Unchi Pahadi", nameHi: "ऊँची पहाड़ी", population: 7000, vulnerability: 0.2, note: "Southern ridge" },
];

const ELEV_OFFSET: Record<string, number> = { GHT: -0.15, PRB: 0.15, SHN: 0.2, RLC: 0.25, MCH: -0.2, UCH: 0.45 };

export function nbhdAt(x: number, y: number): string {
  const ry = riverY(x);
  const d = Math.abs(y - ry);
  if (y > ry) {
    if (d > 1.8) return "SHN";
    return x < 3.6 ? "GHT" : "PRB";
  }
  if (d > 2.0) return "UCH";
  return x < 6 ? "RLC" : "MCH";
}

const SHELTER_SPECS = [
  { id: "S1", name: "Shanti Nagar Govt School", x: 3.0, y: 6.2, capacity: 160, medical: false, raise: 0 },
  { id: "S2", name: "Purani Basti Community Hall", x: 6.6, y: 5.0, capacity: 80, medical: false, raise: 1.2 },
  { id: "S3", name: "Rail Colony Stadium", x: 2.4, y: 1.8, capacity: 140, medical: false, raise: 0.6 },
  { id: "S4", name: "Unchi Pahadi College", x: 7.2, y: 0.8, capacity: 200, medical: false, raise: 0 },
  { id: "S5", name: "District Hospital", x: 5.6, y: 6.4, capacity: 40, medical: true, raise: 0 },
  { id: "S6", name: "Ghat Tola Embankment Camp", x: 1.2, y: 4.9, capacity: 60, medical: false, raise: 2.0 },
];

const GHAT_SPECS = [
  { x: 1.6, side: 1 }, { x: 4.2, side: 1 }, { x: 7.6, side: 1 },
  { x: 2.6, side: -1 }, { x: 5.6, side: -1 }, { x: 8.8, side: -1 },
];

const BRIDGE_SPECS = [
  { id: "B1", label: "Station Bridge", x: 1.9, sensor: true },
  { id: "B2", label: "Old Town Bridge", x: 5.0, sensor: false },
  { id: "B3", label: "Mill Bridge", x: 8.3, sensor: true },
];

let cached: World | null = null;

export function buildWorld(): World {
  if (cached) return cached;
  const rng = mulberry32(7);
  const nodes: WNode[] = [];
  const grid = new Map<string, number>();
  const cols = Math.round(W_KM / GRID);
  const rows = Math.round(H_KM / GRID);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const bx = GRID / 2 + i * GRID;
      const by = GRID / 2 + j * GRID;
      if (Math.abs(by - riverY(bx)) < 0.32) continue;
      const x = bx + (rng() - 0.5) * 0.14;
      const y = by + (rng() - 0.5) * 0.14;
      const nb = nbhdAt(x, y);
      const d = Math.abs(y - riverY(x));
      const elev = 0.45 + 0.85 * d + ELEV_OFFSET[nb] + (rng() - 0.5) * 0.24;
      const id = nodes.length;
      nodes.push({ id, x, y, kind: "junction", nbhd: nb, elev: Math.round(elev * 100) / 100 });
      grid.set(`${i},${j}`, id);
    }
  }

  const edges: WEdge[] = [];
  const edgeKey = new Set<string>();
  const dist = (a: WNode, b: WNode) => Math.hypot(a.x - b.x, a.y - b.y);
  const sameSide = (a: WNode, b: WNode) => {
    const sa = Math.sign(a.y - riverY(a.x));
    const sb = Math.sign(b.y - riverY(b.x));
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const sm = Math.sign(my - riverY(mx));
    return sa === sb && sb === sm;
  };
  const addEdge = (a: number, b: number, kind: WEdge["kind"], extra: Partial<WEdge> = {}) => {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (edgeKey.has(k)) return;
    edgeKey.add(k);
    const na = nodes[a];
    const nb = nodes[b];
    edges.push({
      id: extra.id ?? `e${edges.length}`,
      a,
      b,
      kind,
      length: Math.round(dist(na, nb) * 1000) / 1000,
      nbhd: na.kind === "river" ? nb.nbhd : na.nbhd,
      ...extra,
    });
  };

  // roads: 4-neighbour grid + sparse diagonals, never crossing the river
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const a = grid.get(`${i},${j}`);
      if (a === undefined) continue;
      for (const [di, dj, p] of [[1, 0, 0.93], [0, 1, 0.93], [1, 1, 0.12], [1, -1, 0.12]] as const) {
        const b = grid.get(`${i + di},${j + dj}`);
        if (b === undefined) continue;
        if (!sameSide(nodes[a], nodes[b])) continue;
        if (rng() > p) continue;
        addEdge(a, b, "road");
      }
    }
  }

  // river centreline nodes + water edges
  const riverNodes: number[] = [];
  for (let x = 0; x <= W_KM + 1e-9; x += 0.5) {
    const id = nodes.length;
    nodes.push({ id, x, y: riverY(x), kind: "river", nbhd: "RIV", elev: -2 });
    riverNodes.push(id);
  }
  for (let k = 1; k < riverNodes.length; k++) addEdge(riverNodes[k - 1], riverNodes[k], "water");

  const junctions = () => nodes.filter((n) => n.kind === "junction");
  const nearestJunction = (x: number, y: number, filter?: (n: WNode) => boolean) => {
    let best = -1;
    let bd = Infinity;
    for (const n of junctions()) {
      if (filter && !filter(n)) continue;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bd) {
        bd = d;
        best = n.id;
      }
    }
    return best;
  };
  const nearestRiver = (x: number) => riverNodes.reduce((b, id) => (Math.abs(nodes[id].x - x) < Math.abs(nodes[b].x - x) ? id : b), riverNodes[0]);

  // ghats (boat launch points) — water edge from bank junction to river
  const ghats: number[] = [];
  for (const g of GHAT_SPECS) {
    const ry = riverY(g.x);
    const j = nearestJunction(g.x, ry + g.side * 0.45, (n) => Math.sign(n.y - riverY(n.x)) === g.side);
    nodes[j].kind = "ghat";
    nodes[j].label = `Ghat ${ghats.length + 1}`;
    ghats.push(j);
    addEdge(j, nearestRiver(nodes[j].x), "water");
  }

  // bridges (ground only)
  const bridges: string[] = [];
  for (const b of BRIDGE_SPECS) {
    const ry = riverY(b.x);
    const n = nearestJunction(b.x, ry + 0.45, (nd) => nd.y > riverY(nd.x) && nd.kind === "junction");
    const s = nearestJunction(b.x, ry - 0.45, (nd) => nd.y < riverY(nd.x) && nd.kind === "junction");
    addEdge(n, s, "bridge", { id: b.id, label: b.label, sensor: b.sensor });
    bridges.push(b.id);
  }

  // shelters on raised plinths
  const shelters: ShelterDef[] = [];
  for (const s of SHELTER_SPECS) {
    const j = nearestJunction(s.x, s.y, (n) => n.kind === "junction");
    const node = nodes[j];
    node.kind = "shelter";
    node.label = s.name;
    node.elev = Math.round((node.elev + s.raise) * 100) / 100;
    shelters.push({ id: s.id, name: s.name, node: j, capacity: s.capacity, medical: s.medical, nbhd: node.nbhd });
  }

  const adj: World["adj"] = nodes.map(() => []);
  for (const e of edges) {
    adj[e.a].push({ edge: e.id, to: e.b });
    adj[e.b].push({ edge: e.id, to: e.a });
  }

  const nbhds: Neighbourhood[] = NBHD_DEFS.map((d) => {
    const ns = nodes.filter((n) => n.nbhd === d.id);
    const cx = ns.reduce((s, n) => s + n.x, 0) / ns.length;
    const cy = ns.reduce((s, n) => s + n.y, 0) / ns.length;
    return { ...d, cx, cy, polygon: [] };
  });

  const river: [number, number][] = [];
  for (let x = -0.2; x <= W_KM + 0.2; x += 0.1) river.push([x, riverY(x)]);

  cached = {
    nodes,
    edges,
    edgeById: new Map(edges.map((e) => [e.id, e])),
    adj,
    nbhds,
    shelters,
    ghats,
    bridges,
    river,
    bounds: { w: W_KM, h: H_KM },
  };
  return cached;
}

// ───────────────────────────── physics ─────────────────────────────

export function nodeDepth(n: WNode, level: (nbhd: string) => number): number {
  if (n.kind === "river") return 3;
  return Math.max(0, level(n.nbhd) - n.elev);
}

export function edgeDepth(world: World, e: WEdge, level: (nbhd: string) => number): number {
  if (e.kind === "water") return 3;
  if (e.kind === "bridge") return 0;
  return Math.max(nodeDepth(world.nodes[e.a], level), nodeDepth(world.nodes[e.b], level));
}

/** km/h for an agent type on an edge at a given depth; 0 = impassable. */
export function speedKmh(type: AgentType, kind: WEdge["kind"], depth: number, escorting = false): number {
  if (type === "ground") {
    if (kind === "water") return 0;
    if (kind === "bridge") return escorting ? CONFIG.GROUND_SPEED_ESCORT : CONFIG.GROUND_SPEED_DRY;
    if (depth > CONFIG.GROUND_MAX_DEPTH) return 0;
    const s = depth > CONFIG.GROUND_SLOW_DEPTH ? CONFIG.GROUND_SPEED_WADE : CONFIG.GROUND_SPEED_DRY;
    return escorting ? Math.min(s, CONFIG.GROUND_SPEED_ESCORT) : s;
  }
  if (kind === "bridge") return 0;
  if (kind === "water") return CONFIG.BOAT_SPEED_RIVER;
  if (depth < CONFIG.BOAT_MIN_DEPTH) return 0;
  return depth < CONFIG.BOAT_FAST_DEPTH ? CONFIG.BOAT_SPEED_SHALLOW : CONFIG.BOAT_SPEED_DEEP;
}

/** Linear interpolation over [tick, level] keyframes. */
export function interpCurve(curve: [number, number][] | undefined, t: number): number {
  if (!curve || curve.length === 0) return 0;
  if (t <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [t1, v1] = curve[i];
    const [t0, v0] = curve[i - 1];
    if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / Math.max(1e-9, t1 - t0);
  }
  return curve[curve.length - 1][1];
}

export function toLatLng(x: number, y: number): { lat: number; lng: number } {
  const lat = CONFIG.ANCHOR_LAT + y / 110.57;
  const lng = CONFIG.ANCHOR_LNG + x / (111.32 * Math.cos((CONFIG.ANCHOR_LAT * Math.PI) / 180));
  return { lat, lng };
}

export function fromLatLng(lat: number, lng: number): { x: number; y: number } {
  return {
    x: (lng - CONFIG.ANCHOR_LNG) * 111.32 * Math.cos((CONFIG.ANCHOR_LAT * Math.PI) / 180),
    y: (lat - CONFIG.ANCHOR_LAT) * 110.57,
  };
}

export function nearestNode(world: World, x: number, y: number, kinds: WNode["kind"][] = ["junction", "ghat", "shelter"]): number {
  let best = 0;
  let bd = Infinity;
  for (const n of world.nodes) {
    if (!kinds.includes(n.kind)) continue;
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = n.id;
    }
  }
  return best;
}
