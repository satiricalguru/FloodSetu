"use client";
import type { Frame, SimEvent } from "@floodsetu/engine";
import { buildWorld } from "@floodsetu/engine";
import { QuadraticBezierLine } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Landing WebGL world (Active Theory philosophy: chrome whispers, the world carries the colour).
 * Terrain + houses are built from the SAME synthetic world graph the engine uses; beacons, boats and bid arcs are
 * driven by a real @floodsetu/engine instance running in a Web Worker — not a canned animation.
 */
export interface SceneState {
  progress: number; // 0..1 page scroll
  frame: Frame | null;
  awards: SimEvent[];
}

const W = 10;
const H = 7;
const SX = 1.2; // world km → scene units
const toX = (x: number) => (x - W / 2) * SX;
const toZ = (y: number) => -(y - H / 2) * SX;
const ELEV = 0.16; // metres → scene units

function heightField() {
  const w = buildWorld();
  const pts = w.nodes.filter((n) => n.kind !== "river");
  return (x: number, y: number) => {
    let ry = 3.5 + 0.55 * Math.sin(0.62 * x + 0.4) + 0.2 * Math.sin(1.7 * x);
    const d = Math.abs(y - ry);
    if (d < 0.32) return -0.9 + d * 1.2;
    // inverse-distance weighting of the 3 nearest node elevations
    let a = [Infinity, Infinity, Infinity];
    let e = [0, 0, 0];
    for (const n of pts) {
      const dd = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (dd < a[2]) {
        const i = dd < a[0] ? 0 : dd < a[1] ? 1 : 2;
        a.splice(i, 0, dd);
        e.splice(i, 0, n.elev);
        a = a.slice(0, 3);
        e = e.slice(0, 3);
      }
    }
    const ws = a.map((q) => 1 / (q + 0.02));
    ry = (ws[0] * e[0] + ws[1] * e[1] + ws[2] * e[2]) / (ws[0] + ws[1] + ws[2]);
    return ry;
  };
}

function Terrain() {
  const geo = useMemo(() => {
    const h = heightField();
    const g = new THREE.PlaneGeometry(W * SX + 2, H * SX + 2, 110, 80);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const sx = pos.getX(i) / SX + W / 2;
      const sy = -pos.getZ(i) / SX + H / 2;
      const e = h(Math.min(W, Math.max(0, sx)), Math.min(H, Math.max(0, sy)));
      pos.setY(i, e * ELEV + (Math.sin(sx * 7.1) * Math.cos(sy * 5.3)) * 0.012);
      c.setHSL(0.58, 0.22, 0.075 + Math.min(0.16, Math.max(0, e) * 0.035));
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g.toNonIndexed();
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  );
}

function Houses() {
  const { mesh, windows } = useMemo(() => {
    const w = buildWorld();
    const h = heightField();
    const nodes = w.nodes.filter((n) => n.kind === "junction" || n.kind === "shelter");
    const count = nodes.length * 2;
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#222b37", roughness: 0.7, emissive: "#0b0f15" }), count);
    const o = new THREE.Object3D();
    const win: number[] = [];
    let k = 0;
    let r = 3;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (const n of nodes) {
      for (let j = 0; j < 2; j++) {
        const x = n.x + (rnd() - 0.5) * 0.36;
        const y = n.y + (rnd() - 0.5) * 0.36;
        const e = h(x, y) * ELEV;
        const hh = 0.025 + rnd() * (n.nbhd === "PRB" ? 0.09 : 0.05);
        o.position.set(toX(x), e + hh / 2, toZ(y));
        o.scale.set(0.045 + rnd() * 0.035, hh, 0.045 + rnd() * 0.035);
        o.rotation.y = rnd() * Math.PI;
        o.updateMatrix();
        m.setMatrixAt(k++, o.matrix);
        if (rnd() < 0.55) win.push(toX(x), e + hh * 0.7, toZ(y));
      }
    }
    m.instanceMatrix.needsUpdate = true;
    const wg = new THREE.BufferGeometry();
    wg.setAttribute("position", new THREE.Float32BufferAttribute(win, 3));
    return { mesh: m, windows: wg };
  }, []);
  return (
    <group>
      <primitive object={mesh} />
      <points geometry={windows}>
        <pointsMaterial color="#f2c879" size={0.016} sizeAttenuation transparent opacity={0.85} />
      </points>
    </group>
  );
}

const waterVert = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vWave;
float wave(vec2 p, float t) {
  return 0.010 * sin(p.x * 9.0 + t * 1.6) + 0.008 * sin(p.y * 11.0 - t * 1.2) + 0.005 * sin((p.x + p.y) * 23.0 + t * 2.7);
}
void main() {
  vec3 p = position;
  float w = wave(p.xz, uTime);
  p.y += w;
  float e = 0.02;
  float wx = wave(p.xz + vec2(e, 0.0), uTime) - w;
  float wz = wave(p.xz + vec2(0.0, e), uTime) - w;
  vNormal = normalize(vec3(-wx / e, 1.0, -wz / e));
  vWave = w;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const waterFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uMoon;
uniform float uDawn;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vWave;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 L = normalize(uMoon);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 140.0) * 1.6;
  // fake refraction: ripple-distorted tint of the submerged town (no render target — see DECISIONS)
  float caust = 0.5 + 0.5 * sin(vWorld.x * 18.0 + vWave * 120.0) * sin(vWorld.z * 15.0 - uTime);
  vec3 refr = mix(uDeep * 0.6, uDeep * 1.4, caust * 0.35);
  vec3 col = mix(refr, uSky, fres);
  col += spec * mix(vec3(0.75, 0.9, 1.0), vec3(1.0, 0.85, 0.6), uDawn);
  float edge = smoothstep(0.0, 0.02, abs(vWave));
  gl_FragColor = vec4(col + edge * 0.02, 0.86);
}`;

function Water({ state }: { state: React.MutableRefObject<SceneState> }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uDeep: { value: new THREE.Color("#0b4a55") }, uSky: { value: new THREE.Color("#14303a") }, uMoon: { value: new THREE.Vector3(-0.4, 0.6, -0.7) }, uDawn: { value: 0 } }), []);
  useFrame((_, dt) => {
    const p = state.current.progress;
    uniforms.uTime.value += dt;
    // rises through the first half of the story, recedes at dawn (section 7)
    const rise = Math.min(1, p / 0.42);
    const recede = p > 0.62 ? Math.min(1, (p - 0.62) / 0.15) : 0;
    const lvl = (-0.2 + rise * 1.9 - recede * 1.0) * ELEV;
    if (mesh.current) mesh.current.position.y = lvl;
    uniforms.uDawn.value = recede;
    uniforms.uSky.value.set("#14303a").lerp(new THREE.Color("#5f8696"), recede);
    uniforms.uDeep.value.set("#0b4a55").lerp(new THREE.Color("#2b8aa0"), recede);
  });
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[W * SX + 4, H * SX + 4, 180, 130]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={waterVert} fragmentShader={waterFrag} transparent depthWrite={false} />
    </mesh>
  );
}

function Rain({ count, state }: { count: number; state: React.MutableRefObject<SceneState> }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * 14;
      a[i * 3 + 1] = Math.random() * 6;
      a[i * 3 + 2] = (Math.random() - 0.5) * 11;
    }
    g.setAttribute("position", new THREE.BufferAttribute(a, 3));
    return g;
  }, [count]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAlpha: { value: 0.5 } }), []);
  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    const p = state.current.progress;
    uniforms.uAlpha.value = p > 0.62 ? Math.max(0, 0.5 - (p - 0.62) * 4) : 0.5;
  });
  return (
    <points geometry={geo}>
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`uniform float uTime; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y - uTime * 3.2, 6.0); p.x -= p.y * 0.08; vA = smoothstep(0.0, 1.0, p.y); vec4 mv = modelViewMatrix * vec4(p,1.0); gl_PointSize = 1.6 * (6.0 / -mv.z); gl_Position = projectionMatrix * mv; }`}
        fragmentShader={`uniform float uAlpha; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, abs(c.x) * 4.0 + abs(c.y)); gl_FragColor = vec4(0.62,0.8,0.9, a * uAlpha * vA); }`}
      />
    </points>
  );
}

const URG = { critical: new THREE.Color("#ff5a36"), urgent: new THREE.Color("#f2b33d"), needs_help: new THREE.Color("#7fb2ff") };

function Beacons({ state }: { state: React.MutableRefObject<SceneState> }) {
  const MAX = 160;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(MAX), 1));
    return g;
  }, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uShow: { value: 0 } }), []);
  const h = useMemo(() => heightField(), []);
  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    const p = state.current.progress;
    uniforms.uShow.value = Math.min(1, Math.max(0, (p - 0.08) / 0.08)) * (p > 0.7 ? Math.max(0, 1 - (p - 0.7) * 6) : 1);
    const f = state.current.frame;
    if (!f) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const size = geo.attributes.size as THREE.BufferAttribute;
    let k = 0;
    for (const i of f.incidents) {
      if (k >= MAX || i.status === "resolved" || i.status === "false_report") continue;
      pos.setXYZ(k, toX(i.x), Math.max(h(i.x, i.y), (f.levels[i.nbhd] ?? 0)) * ELEV + 0.12, toZ(i.y));
      const c = URG[i.urgency];
      col.setXYZ(k, c.r, c.g, c.b);
      size.setX(k, 0.6 + Math.sqrt(i.people) * 0.35);
      k++;
    }
    for (let j = k; j < MAX; j++) size.setX(j, 0);
    pos.needsUpdate = col.needsUpdate = size.needsUpdate = true;
  });
  return (
    <points geometry={geo}>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`attribute float size; attribute vec3 color; uniform float uTime; varying vec3 vC; varying float vS; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); float pulse = 1.0 + 0.35 * sin(uTime * 3.0 + position.x * 4.0); vS = size; gl_PointSize = size * pulse * 26.0 * (5.0 / -mv.z); gl_Position = projectionMatrix * mv; }`}
        fragmentShader={`uniform float uShow; varying vec3 vC; varying float vS; void main(){ float d = length(gl_PointCoord - 0.5); if (vS <= 0.0) discard; float core = smoothstep(0.16, 0.0, d); float halo = smoothstep(0.5, 0.0, d) * 0.45; gl_FragColor = vec4(vC * (core * 1.6 + halo), (core + halo) * uShow); }`}
      />
    </points>
  );
}

function Agents({ state }: { state: React.MutableRefObject<SceneState> }) {
  const boats = useRef<THREE.InstancedMesh>(null);
  const h = useMemo(() => heightField(), []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const failed = useMemo(() => new THREE.Color("#3a4250"), []);
  const ok = useMemo(() => new THREE.Color("#eceae3"), []);
  useFrame(() => {
    const f = state.current.frame;
    const p = state.current.progress;
    const show = p > 0.2 && p < 0.72;
    if (!boats.current) return;
    boats.current.visible = show;
    if (!f) return;
    let k = 0;
    for (const a of f.agents) {
      if (a.type !== "boat") continue;
      const lvl = (f.levels[f.incidents[0]?.nbhd ?? "GHT"] ?? 1) * ELEV;
      o.position.set(toX(a.x), Math.max(h(a.x, a.y) * ELEV, lvl * 0.6) + 0.04, toZ(a.y));
      if (a.route.length > 1) o.rotation.y = Math.atan2(toX(a.route[1][0]) - toX(a.x), toZ(a.route[1][1]) - toZ(a.y));
      o.scale.setScalar(a.status === "failed" ? 0.8 : 1);
      o.updateMatrix();
      boats.current.setMatrixAt(k, o.matrix);
      boats.current.setColorAt(k, a.status === "failed" ? failed : ok);
      k++;
    }
    boats.current.count = k;
    boats.current.instanceMatrix.needsUpdate = true;
    if (boats.current.instanceColor) boats.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={boats} args={[undefined, undefined, 8]}>
      <coneGeometry args={[0.035, 0.13, 3]} />
      <meshStandardMaterial emissive="#eceae3" emissiveIntensity={0.6} color="#eceae3" />
    </instancedMesh>
  );
}

function Arcs({ state }: { state: React.MutableRefObject<SceneState> }) {
  const group = useRef<THREE.Group>(null);
  const arcs = useRef<{ s: THREE.Vector3; e: THREE.Vector3; m: THREE.Vector3; t: number }[]>([]);
  const lines = useRef<(THREE.Object3D | null)[]>([]);
  useFrame((_, dt) => {
    const st = state.current;
    const show = st.progress > 0.25 && st.progress < 0.62;
    if (group.current) group.current.visible = show;
    const f = st.frame;
    if (f && st.awards.length) {
      for (const ev of st.awards.splice(0)) {
        const a = f.agents.find((x) => x.id === ev.agent);
        const inc = f.incidents.find((x) => x.id === ev.incident);
        if (!a || !inc) continue;
        const s = new THREE.Vector3(toX(a.x), 0.25, toZ(a.y));
        const e = new THREE.Vector3(toX(inc.x), 0.25, toZ(inc.y));
        const m = s.clone().lerp(e, 0.5).add(new THREE.Vector3(0, 0.5 + s.distanceTo(e) * 0.3, 0));
        arcs.current.push({ s, e, m, t: 0 });
      }
      arcs.current = arcs.current.slice(-10);
    }
    arcs.current.forEach((a) => (a.t += dt));
    arcs.current.forEach((a, i) => {
      const l = lines.current[i] as unknown as { material?: { opacity: number; dashOffset?: number }; setPoints?: (s: THREE.Vector3, e: THREE.Vector3, m: THREE.Vector3) => void };
      if (!l) return;
      l.setPoints?.(a.s, a.e, a.m);
      if (l.material) {
        l.material.opacity = Math.max(0, 1 - a.t / 3);
        if ("dashOffset" in l.material) l.material.dashOffset = -a.t * 2;
      }
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: 10 }).map((_, i) => (
        <QuadraticBezierLine key={i} ref={(r) => void (lines.current[i] = r as unknown as THREE.Object3D)} start={[0, -10, 0]} end={[0, -10, 0]} mid={[0, -10, 0]} color="#7fb2ff" lineWidth={1.4} dashed dashSize={0.06} gapSize={0.04} transparent opacity={0} />
      ))}
    </group>
  );
}

function Bridges({ state }: { state: React.MutableRefObject<SceneState> }) {
  const w = useMemo(() => buildWorld(), []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const items = useMemo(
    () =>
      w.bridges.map((id) => {
        const e = w.edgeById.get(id)!;
        const a = w.nodes[e.a];
        const b = w.nodes[e.b];
        const len = Math.hypot(toX(a.x) - toX(b.x), toZ(a.y) - toZ(b.y));
        return { id, x: (toX(a.x) + toX(b.x)) / 2, z: (toZ(a.y) + toZ(b.y)) / 2, len, rot: Math.atan2(toX(b.x) - toX(a.x), toZ(b.y) - toZ(a.y)) };
      }),
    [w],
  );
  useFrame((_, dt) => {
    const f = state.current.frame;
    items.forEach((it, i) => {
      const m = refs.current[i];
      if (!m || !f) return;
      const idx = w.edges.findIndex((e) => e.id === it.id);
      const collapsed = f.edgeTruth[idx] === "c";
      m.rotation.z = THREE.MathUtils.lerp(m.rotation.z, collapsed ? 0.35 : 0, dt * 3);
      m.position.y = THREE.MathUtils.lerp(m.position.y, collapsed ? 0.02 : 0.2, dt * 3);
      (m.material as THREE.MeshStandardMaterial).emissive.set(collapsed ? "#ff5a36" : "#3a3f46");
    });
  });
  return (
    <>
      {items.map((it, i) => (
        <mesh key={it.id} ref={(r) => void (refs.current[i] = r)} position={[it.x, 0.2, it.z]} rotation={[0, it.rot, 0]}>
          <boxGeometry args={[0.04, 0.02, it.len]} />
          <meshStandardMaterial color="#9aa6b8" emissive="#3a3f46" />
        </mesh>
      ))}
    </>
  );
}

function Rig({ state }: { state: React.MutableRefObject<SceneState> }) {
  const { camera, scene } = useThree();
  const bgNight = useMemo(() => new THREE.Color("#05070a"), []);
  const bgDawn = useMemo(() => new THREE.Color("#344a58"), []); // overcast dawn — keeps light text AA-readable
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame((st) => {
    const p = state.current.progress;
    const t = st.clock.elapsedTime;
    // keyframed dolly: wide hero → closer beacons → orbit negotiation → bridge focus → pull back → dawn
    const k = [
      [0.0, 0, 6.8, 7.6],
      [0.15, -1.5, 3.9, 5.2],
      [0.32, 1.2, 3.2, 4.4],
      [0.48, -3.0, 2.2, 2.8],
      [0.62, 0, 5.0, 6.0],
      [1.0, 0, 6.5, 7.5],
    ];
    let i = 0;
    while (i < k.length - 2 && p > k[i + 1][0]) i++;
    const a = k[i];
    const b = k[i + 1];
    const u = THREE.MathUtils.smoothstep(p, a[0], b[0]);
    camera.position.set(THREE.MathUtils.lerp(a[1], b[1], u) + Math.sin(t * 0.08) * 0.2, THREE.MathUtils.lerp(a[2], b[2], u), THREE.MathUtils.lerp(a[3], b[3], u));
    camera.lookAt(0, 0, 0);
    const dawn = p > 0.62 ? Math.min(1, (p - 0.62) / 0.15) : 0;
    tmp.copy(bgNight).lerp(bgDawn, dawn);
    scene.background = tmp;
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(tmp);
  });
  return null;
}

export default function Scene({ state, quality }: { state: React.MutableRefObject<SceneState>; quality: { dpr: number; rain: number } }) {
  return (
    <Canvas dpr={[1, quality.dpr]} camera={{ fov: 42, position: [0, 6.8, 7.6] }} gl={{ antialias: quality.dpr > 1, powerPreference: "high-performance" }} aria-hidden>
      <fog attach="fog" args={["#05070a", 6, 16]} />
      <ambientLight intensity={0.35} color="#7f9bb8" />
      <directionalLight position={[-4, 6, -5]} intensity={0.9} color="#b9d4ff" />
      <pointLight position={[0, 2, 0]} intensity={0.6} color="#2ec5d3" distance={8} />
      <Terrain />
      <Houses />
      <Bridges state={state} />
      <Water state={state} />
      <Beacons state={state} />
      <Agents state={state} />
      <Arcs state={state} />
      <Rain count={quality.rain} state={state} />
      <Rig state={state} />
    </Canvas>
  );
}
