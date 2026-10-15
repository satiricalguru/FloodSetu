// ───────────────────────────── World ─────────────────────────────
export type NodeKind = "junction" | "river" | "ghat" | "shelter";
export type EdgeKind = "road" | "water" | "bridge";
export type AgentType = "boat" | "ground";
export type Skill = "first_aid" | "supplies" | "verification" | "logistics";
export type Urgency = "critical" | "urgent" | "needs_help";
export type Need = "elderly" | "child" | "pregnant" | "disabled" | "medical" | "injured" | "pets";
export type Source = "citizen" | "rescuer" | "control_room" | "sensor" | "self";
export type AreaStatus = "normal" | "at_risk" | "flooded" | "verification_pending";
export type Verification = "pending" | "under_review" | "verified" | "needs_attention";
export type StrategyName = "cnp" | "central" | "omniscient" | "greedy";

export interface WNode {
  id: number;
  x: number; // km
  y: number; // km
  kind: NodeKind;
  nbhd: string;
  elev: number; // m above town datum
  label?: string;
}

export interface WEdge {
  id: string;
  a: number;
  b: number;
  kind: EdgeKind;
  length: number; // km
  nbhd: string;
  label?: string;
  sensor?: boolean;
}

export interface Neighbourhood {
  id: string;
  name: string;
  nameHi: string;
  cx: number;
  cy: number;
  population: number;
  vulnerability: number; // 0..1
  note: string;
  polygon: [number, number][];
}

export interface ShelterDef {
  id: string;
  name: string;
  node: number;
  capacity: number;
  medical: boolean;
  nbhd: string;
}

export interface World {
  nodes: WNode[];
  edges: WEdge[];
  edgeById: Map<string, WEdge>;
  adj: { edge: string; to: number }[][];
  nbhds: Neighbourhood[];
  shelters: ShelterDef[];
  ghats: number[];
  bridges: string[];
  river: [number, number][];
  bounds: { w: number; h: number };
}

// ───────────────────────────── Scenario ─────────────────────────────
export interface SosSpec {
  id?: string;
  tick: number;
  node?: number;
  x?: number;
  y?: number;
  nbhd?: string;
  people: number;
  urgency: Urgency;
  needs?: Need[];
  text?: string;
  phone?: string; // phone hash (pseudonymous)
  building?: string;
  source?: "citizen" | "sms" | "field" | "live";
  /** hidden ground truth: false reports find nobody on site */
  real?: boolean;
  gpsMismatch?: boolean;
}

export type ScenarioEvent =
  | { tick: number; type: "RAIN_SURGE"; nbhds: string[]; delta: number; duration: number }
  | { tick: number; type: "EDGE_CLOSE"; edge: string; announce?: Source | null }
  | { tick: number; type: "EDGE_OPEN"; edge: string; announce?: Source | null }
  | { tick: number; type: "BRIDGE_COLLAPSE"; edge: string }
  | { tick: number; type: "AGENT_FAILURE"; agent: string; cause?: string }
  | { tick: number; type: "AGENT_RECOVER"; agent: string }
  | { tick: number; type: "SHELTER_OVERFLOW"; shelter: string; walkIns?: number; capacityDrop?: number }
  | { tick: number; type: "SOS"; sos: SosSpec }
  | { tick: number; type: "SOS_BURST"; nbhd: string; count: number; urgencyMix?: [number, number, number]; duplicates?: number; sameBuilding?: number }
  | { tick: number; type: "REPORT"; edge: string; claim: "open" | "closed"; source: Source; confidence: number; note?: string }
  | { tick: number; type: "SHELTER_REPORT"; shelter: string; claimFree: number; source: Source; note?: string }
  | { tick: number; type: "BLACKOUT"; nbhd: string; duration: number }
  | { tick: number; type: "CONTROL_OVERRIDE"; action: "pin" | "veto"; task: string; agent: string; reason: string }
  | { tick: number; type: "TRIPLE_FAILURE"; bridge: string; agent: string; shelter: string; walkIns: number };

/** A scenario event without its tick (distributes over the union). */
export type InjectEvent = ScenarioEvent extends infer E ? (E extends ScenarioEvent ? Omit<E, "tick"> & { tick?: number } : never) : never;

export interface Scenario {
  id: string;
  name: string;
  description: string;
  seed: number;
  duration: number;
  /** keyframes per neighbourhood: [tick, waterLevel m] */
  flood: Record<string, [number, number][]>;
  /** background SOS generator */
  sosRate?: { perTick: number; until: number; weights?: Record<string, number>; urgencyMix?: [number, number, number]; fakeShare?: number };
  events: ScenarioEvent[];
  fleet?: { boats?: number; ground?: number };
  tags?: string[];
}

// ───────────────────────────── Dynamic state ─────────────────────────────
export interface EdgeBelief {
  L: number; // log-odds of OPEN
  t: number; // tick of last update
  contested: boolean;
  contestedSince?: number;
  sources: { source: Source; claim: "open" | "closed"; confidence: number; tick: number; by?: string }[];
}

export interface BeliefStore {
  edges: Map<string, EdgeBelief>;
  level: Map<string, { level: number; t: number }>; // water level estimate per nbhd
}

export type Phase = "queued" | "to_site" | "on_site" | "to_shelter" | "done";

export interface Commitment {
  id: string;
  taskId: string;
  agentId: string;
  count: number;
  awardedTick: number;
  bid: number;
  phase: Phase;
  shelterId?: string;
  dropNode?: number;
  pickedUp?: number;
}

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  capacity: number;
  skills: Skill[];
  crew: number;
  baseNode: number;
  node: number; // last node reached
  next: number | null; // node we are travelling towards (mid-edge)
  progress: number; // km along edge node→next
  x: number;
  y: number;
  path: number[]; // remaining nodes after `next` (or after node if not moving)
  target: number | null;
  status: "idle" | "en_route" | "rescuing" | "transporting" | "working" | "returning" | "refuelling" | "holding" | "failed";
  onboard: number;
  fuel: number;
  fuelMax: number;
  queue: Commitment[];
  belief: BeliefStore;
  connected: boolean;
  outbox: Message[];
  workLeft: number;
  failedTick?: number;
  failCause?: string;
  vetoed: Set<string>;
  stats: { idle: number; idleWhileDemand: number; busy: number; alive: number; km: number };
}

export interface Report {
  id: string;
  sosId: string;
  tick: number; // created (truth time)
  receivedTick: number;
  node: number;
  x: number;
  y: number;
  nbhd: string;
  people: number;
  urgency: Urgency;
  needs: Need[];
  text: string;
  phone?: string;
  building?: string;
  source: string;
  real: boolean;
  risk: { score: number; reasons: string[] };
}

export interface Incident {
  id: string;
  reports: Report[];
  node: number;
  x: number;
  y: number;
  nbhd: string;
  urgency: Urgency;
  needs: Need[];
  people: number; // estimate
  peopleRange: [number, number];
  createdTick: number; // first report truth tick
  knownTick: number; // first report received at COP
  verification: Verification;
  risk: { score: number; reasons: string[] };
  status: "open" | "assigned" | "in_progress" | "resolved" | "false_report" | "merged";
  firstServedTick?: number;
  resolvedTick?: number;
  rescued: number;
  taskIds: string[];
  escalated: boolean;
  escalatedTick?: number;
  realPeople: number;
  isReal: boolean;
}

export type TaskKind = "RESCUE" | "MEDICAL" | "SUPPLY" | "VERIFY";

export interface Task {
  id: string;
  kind: TaskKind;
  incidentId?: string;
  edgeId?: string;
  node: number;
  nbhd: string;
  createdTick: number;
  urgency: Urgency;
  mode: AgentType;
  skills: Skill[];
  prefSkills: Skill[];
  demand: number; // people (RESCUE) or 1
  served: number; // people picked up / work done
  committed: number;
  status: "open" | "assigned" | "in_progress" | "done" | "cancelled";
  firstServedTick?: number;
  doneTick?: number;
  priority: number;
  decommits: number;
  awards: number;
}

export interface ShelterState {
  id: string;
  capacity: number;
  occupancy: number;
  reservations: { id: string; agentId: string; count: number; tick: number }[];
  reachable: boolean;
}

export interface Message {
  from: string;
  to: string;
  kind: "report" | "heartbeat" | "sos" | "gauge";
  tick: number;
  payload: unknown;
}

export type ReasonCode =
  | "ROUTE_BLOCKED"
  | "RESOURCE_FAILURE"
  | "SHELTER_FULL"
  | "HIGHER_URGENCY_PREEMPTION"
  | "INFO_CONTRADICTED"
  | "CONTROL_OVERRIDE"
  | "CENTRAL_REPLAN"
  | "BETTER_OFFER"
  | "TASK_RESOLVED";

export interface BidRecord {
  agent: string;
  bid: number;
  eta: number;
  breakdown: Record<string, number>;
  excluded?: string;
}

export interface SimEvent {
  seq: number;
  tick: number;
  type: string;
  msg: string;
  reason?: ReasonCode | string;
  agent?: string;
  task?: string;
  incident?: string;
  edge?: string;
  shelter?: string;
  data?: Record<string, unknown>;
  severity?: "info" | "warn" | "critical" | "good";
}

export interface CascadeEntry {
  tick: number;
  causes: { type: string; target: string; msg: string }[];
  cancelled: { commitment: string; task: string; incident?: string; agent: string; reason: ReasonCode; people: number }[];
  reassigned: { task: string; incident?: string; agent: string; eta: number; bids: { agent: string; bid: number }[]; tick: number }[];
  reroutes: { agent: string; from?: string; to?: string; reason: string }[];
  explanation: string[];
  resolvedTick?: number;
}

export interface FrameAgent {
  id: string;
  type: AgentType;
  x: number;
  y: number;
  status: Agent["status"];
  onboard: number;
  capacity: number;
  fuel: number;
  connected: boolean;
  route: [number, number][];
  task?: string;
  lastSeen?: number;
}

export interface FrameIncident {
  id: string;
  x: number;
  y: number;
  people: number;
  urgency: Urgency;
  status: Incident["status"];
  verification: Verification;
  reports: number;
  escalated: boolean;
  nbhd: string;
  wait: number;
}

export interface Kpis {
  openSos: number;
  criticalWaiting: number;
  p90Wait: number;
  idlePct: number;
  violations: number;
  fairness: number;
  rescued: number;
  invariantViolations: number;
}

export interface Frame {
  tick: number;
  agents: FrameAgent[];
  incidents: FrameIncident[];
  edgeCop: string; // one char per edge: o open, c closed, u unknown, x contested
  edgeTruth: string; // o open, c closed (structural)
  levels: Record<string, number>; // truth
  levelsCop: Record<string, number>;
  areaStatus: Record<string, AreaStatus>;
  shelters: { id: string; occupancy: number; reserved: number; capacity: number }[];
  blackout: string[];
  kpis: Kpis;
}
