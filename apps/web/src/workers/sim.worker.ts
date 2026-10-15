/// <reference lib="webworker" />
import { buildWorld, explainTask, runMetrics, Simulation, type StrategyName } from "@jalsetu/engine";
import type { FromWorker, ToWorker, WorldGeom } from "../lib/protocol";
import { scenarioById } from "../lib/scenarios";

/**
 * The engine runs here so the UI stays at 60fps. Same @jalsetu/engine package as the headless bench.
 */
const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m);

let sim: Simulation | null = null;
let playing = false;
let speed = 5; // ticks per real second
let acc = 0;
let last = 0;
let sentEvents = 0;
let lastPost = 0;
let replay: number | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function geom(): WorldGeom {
  const w = buildWorld();
  return {
    nodes: w.nodes.map(({ id, x, y, kind, nbhd, elev, label }) => ({ id, x, y, kind, nbhd, elev, label })),
    edges: w.edges.map(({ id, a, b, kind, label, sensor, nbhd }) => ({ id, a, b, kind, label, sensor, nbhd })),
    nbhds: w.nbhds.map(({ id, name, nameHi, cx, cy, population, vulnerability, note }) => ({ id, name, nameHi, cx, cy, population, vulnerability, note })),
    shelters: w.shelters,
    ghats: w.ghats,
    bridges: w.bridges,
    river: w.river,
    bounds: w.bounds,
  };
}

function sendFrame(force = false) {
  if (!sim) return;
  const now = performance.now();
  if (!force && now - lastPost < 45) return;
  lastPost = now;
  const frame = sim.frames[sim.frames.length - 1] ?? sim.frame();
  const events = sim.log.slice(sentEvents);
  sentEvents = sim.log.length;
  post({
    type: "frame",
    frame,
    events,
    cascades: sim.cascades.slice(-12),
    contradictions: sim.contradictions,
    maxTick: sim.frames.length - 1,
    playing,
    done: sim.done,
    live: sim.liveStatus(),
    units: sim.units(),
    areas: sim.areaInputs(),
    series: sim.series.slice(-240),
    metrics: sim.done || !playing ? runMetrics(sim) : undefined,
  });
}

function loop() {
  timer = null;
  if (!sim || !playing) return;
  const now = performance.now();
  acc += ((now - last) / 1000) * speed;
  last = now;
  let n = Math.min(60, Math.floor(acc));
  acc -= n;
  while (n-- > 0 && !sim.done) sim.step();
  if (sim.done) playing = false;
  sendFrame(sim.done);
  if (playing) timer = setTimeout(loop, 16);
}

function start() {
  if (timer) clearTimeout(timer);
  last = performance.now();
  acc = 0;
  timer = setTimeout(loop, 16);
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  try {
    switch (m.type) {
      case "init": {
        const sc = scenarioById(m.scenarioId);
        sim = new Simulation({ ...sc, seed: m.seed ?? sc.seed }, { strategy: m.strategy, recordFrames: true, extraEvents: m.extraEvents });
        sentEvents = 0;
        replay = null;
        post({ type: "world", world: geom(), scenario: { id: sc.id, name: sc.name, description: sc.description, duration: sc.duration, seed: m.seed ?? sc.seed }, strategy: m.strategy });
        sim.step();
        sendFrame(true);
        break;
      }
      case "play":
        if (!sim || sim.done) return;
        playing = true;
        replay = null;
        start();
        sendFrame(true);
        break;
      case "pause":
        playing = false;
        sendFrame(true);
        break;
      case "step":
        if (!sim) return;
        for (let i = 0; i < (m.n ?? 1) && !sim.done; i++) sim.step();
        sendFrame(true);
        break;
      case "runTo":
        if (!sim) return;
        while (sim.tick < m.tick && !sim.done) sim.step();
        sendFrame(true);
        break;
      case "speed":
        speed = Math.max(0.25, Math.min(600, m.value));
        break;
      case "inject":
        if (!sim) return;
        sim.inject(m.event);
        if (!playing) {
          sim.step();
          sendFrame(true);
        }
        break;
      case "seek": {
        if (!sim) return;
        replay = m.tick;
        if (m.tick === null) {
          sendFrame(true);
          return;
        }
        const f = sim.frames[Math.max(0, Math.min(sim.frames.length - 1, m.tick))];
        if (f) post({ type: "replayFrame", frame: f });
        break;
      }
      case "explain": {
        if (!sim) return;
        let taskId = m.taskId;
        if (!taskId && m.incidentId) {
          const inc = sim.incidents.get(m.incidentId);
          taskId = inc?.taskIds.find((t) => sim!.tasks.get(t)?.kind !== "VERIFY") ?? inc?.taskIds[0];
        }
        const why = taskId ? explainTask(sim, taskId) : null;
        const inc = m.incidentId ? sim.incidents.get(m.incidentId) : undefined;
        post({ type: "explain", reqId: m.reqId, why, incident: inc ? { ...inc, reports: inc.reports.map((r) => ({ ...r })) } : undefined });
        break;
      }
      case "compare": {
        if (!sim) return;
        const sc = sim.scenario;
        const strategies: StrategyName[] = ["cnp", "central", "omniscient", "greedy"];
        const results = [];
        let k = 0;
        for (let s = 0; s < m.seeds; s++) {
          for (const st of strategies) {
            const run = new Simulation({ ...sc, seed: sc.seed + s * 101 }, { strategy: st, recordFrames: false }).run();
            results.push(runMetrics(run));
            post({ type: "compare", reqId: m.reqId, progress: ++k / (m.seeds * strategies.length) });
          }
        }
        post({ type: "compare", reqId: m.reqId, results });
        break;
      }
    }
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? `${err.message}\n${err.stack}` : String(err) });
  }
};
void replay;
