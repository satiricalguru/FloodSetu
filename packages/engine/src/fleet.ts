import { CONFIG } from "./config";
import { newBeliefs } from "./beliefs";
import type { Agent, AgentType, Skill, World } from "./types";

interface Spec {
  id: string;
  type: AgentType;
  name: string;
  capacity: number;
  skills: Skill[];
  crew: number;
  base: { ghat?: number; shelter?: string };
  fuel?: number;
}

const BOATS: Spec[] = [
  { id: "B-1", type: "boat", name: "IRB Alpha", capacity: 8, skills: ["first_aid"], crew: 4, base: { ghat: 0 }, fuel: 360 },
  { id: "B-2", type: "boat", name: "IRB Bravo", capacity: 6, skills: [], crew: 3, base: { ghat: 1 }, fuel: 330 },
  { id: "B-3", type: "boat", name: "IRB Charlie", capacity: 10, skills: ["first_aid"], crew: 4, base: { ghat: 2 }, fuel: 360 },
  { id: "B-4", type: "boat", name: "IRB Delta", capacity: 4, skills: [], crew: 2, base: { ghat: 3 }, fuel: 300 },
  { id: "B-5", type: "boat", name: "IRB Echo", capacity: 12, skills: ["first_aid"], crew: 5, base: { ghat: 4 }, fuel: 390 },
  { id: "B-6", type: "boat", name: "IRB Foxtrot", capacity: 6, skills: [], crew: 3, base: { ghat: 5 }, fuel: 330 },
  { id: "B-7", type: "boat", name: "IRB Golf", capacity: 8, skills: ["first_aid"], crew: 4, base: { ghat: 0 }, fuel: 360 },
  { id: "B-8", type: "boat", name: "IRB Hotel", capacity: 10, skills: [], crew: 4, base: { ghat: 3 }, fuel: 360 },
];

const G = (id: string, skills: Skill[], shelter: string): Spec => ({
  id,
  type: "ground",
  name: `Ground team ${id.slice(2)}`,
  capacity: CONFIG.ESCORT_CAPACITY,
  skills,
  crew: 3,
  base: { shelter },
});

const GROUND: Spec[] = [
  G("G-01", ["first_aid", "verification"], "S1"),
  G("G-02", ["supplies", "logistics"], "S3"),
  G("G-03", ["first_aid"], "S5"),
  G("G-04", ["verification", "logistics"], "S2"),
  G("G-05", ["supplies"], "S4"),
  G("G-06", ["first_aid", "supplies"], "S6"),
  G("G-07", ["verification"], "S3"),
  G("G-08", ["logistics"], "S1"),
  G("G-09", ["first_aid", "logistics"], "S4"),
  G("G-10", ["supplies", "verification"], "S5"),
  G("G-11", ["first_aid"], "S3"),
  G("G-12", ["logistics", "supplies"], "S2"),
  G("G-13", ["verification", "first_aid"], "S4"),
  G("G-14", ["supplies"], "S1"),
  G("G-15", ["logistics"], "S6"),
  // flood rescue engineers: extraction from collapsed / damaged structures, and structural checks of bridges and embankments
  { ...G("G-16", ["engineering", "first_aid"], "S1"), name: "Rescue engineers A" },
  { ...G("G-17", ["engineering", "verification"], "S4"), name: "Rescue engineers B" },
];

export const FLEET_SPECS = [...BOATS, ...GROUND];

export function createFleet(world: World, levels: Record<string, number>, opts?: { boats?: number; ground?: number }): Agent[] {
  const boats = BOATS.slice(0, opts?.boats ?? BOATS.length);
  const ground = GROUND.slice(0, opts?.ground ?? GROUND.length);
  return [...boats, ...ground].map((s) => {
    const node = s.base.ghat !== undefined ? world.ghats[s.base.ghat] : world.shelters.find((x) => x.id === s.base.shelter)!.node;
    const n = world.nodes[node];
    const fuel = s.type === "boat" ? (s.fuel ?? 360) : 1e9;
    return {
      id: s.id,
      type: s.type,
      name: s.name,
      capacity: s.capacity,
      skills: s.skills,
      crew: s.crew,
      baseNode: node,
      node,
      next: null,
      progress: 0,
      x: n.x,
      y: n.y,
      path: [],
      target: null,
      status: "idle",
      onboard: 0,
      fuel,
      fuelMax: fuel,
      queue: [],
      belief: newBeliefs(levels),
      connected: true,
      outbox: [],
      workLeft: 0,
      vetoed: new Set<string>(),
      stats: { idle: 0, idleWhileDemand: 0, busy: 0, alive: 0, km: 0 },
    } satisfies Agent;
  });
}
