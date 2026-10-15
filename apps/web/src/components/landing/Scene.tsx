"use client";
import type { Frame } from "@floodsetu/engine";
import { buildWorld, DEFAULT_DAMS, nbhdAt } from "@floodsetu/engine";
import { Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * "Topographic field terminal at midnight" (INVERSA lineage): the landing world is a full-bleed, satellite-style
 * aerial of Jalnagar rendered in ONE terrain shader — earth-tone fields, rooftop grain, faint contours, and silty
 * monsoon floodwater whose current flows along the river. Lime is used only for annotations (SAR swath, tags).
 * Water levels, SOS beacons, boats, dam state and satellite passes come from a live @floodsetu/engine worker.
 */
export interface SceneState {
  progress: number;
  band: string;
  frame: Frame | null;
  awards: unknown[];
}

const NB_ORDER = ["GHT", "PRB", "SHN", "RLC", "MCH", "UCH"];
const X0 = -1.2;
const Y0 = -1.2;
const WW = 12.4;
const HH = 9.4;
const TW = 372;
const TH = 282;
export const toX = (x: number) => x - 5;
export const toZ = (y: number) => -(y - 3.5);
const riverY = (x: number) => 3.5 + 0.55 * Math.sin(0.62 * x + 0.4) + 0.2 * Math.sin(1.7 * x);

/** One RGBA8 texture: R height, G neighbourhood id, B settlement density, A road mask. */
function buildDataTexture() {
  const w = buildWorld();
  const land = w.nodes.filter((n) => n.kind !== "river");
  const cv = document.createElement("canvas");
  cv.width = TW;
  cv.height = TH;
  const g = cv.getContext("2d")!;
  g.strokeStyle = "#fff";
  g.lineCap = "round";
  const px = (x: number) => ((x - X0) / WW) * TW;
  const py = (y: number) => ((y - Y0) / HH) * TH;
  for (const e of w.edges) {
    if (e.kind === "water") continue;
    const a = w.nodes[e.a];
    const b = w.nodes[e.b];
    g.lineWidth = e.kind === "bridge" ? 2.2 : 1.1;
    g.beginPath();
    g.moveTo(px(a.x), py(a.y));
    g.lineTo(px(b.x), py(b.y));
    g.stroke();
  }
  const roads = g.getImageData(0, 0, TW, TH).data;
  const data = new Uint8Array(TW * TH * 4);
  for (let j = 0; j < TH; j++) {
    for (let i = 0; i < TW; i++) {
      const x = X0 + ((i + 0.5) / TW) * WW;
      const y = Y0 + ((j + 0.5) / TH) * HH;
      const cx = Math.min(10, Math.max(0, x));
      const cy = Math.min(7, Math.max(0, y));
      const d = Math.abs(cy - riverY(cx));
      let h: number;
      let dmin = Infinity;
      if (d < 0.3) h = -0.9 + d * 1.5;
      else {
        let s = 0;
        let ws = 0;
        for (const n of land) {
          const dd = (n.x - cx) ** 2 + (n.y - cy) ** 2;
          if (dd < dmin) dmin = dd;
          if (dd > 1.2) continue;
          const wgt = 1 / (dd + 0.03) ** 2;
          s += wgt * n.elev;
          ws += wgt;
        }
        h = ws ? s / ws : 3;
      }
      const out = Math.max(0, x < 0 ? -x : x > 10 ? x - 10 : 0, y < 0 ? -y : y > 7 ? y - 7 : 0);
      h += out * 1.6;
      const nb = d < 0.3 ? 6 : NB_ORDER.indexOf(nbhdAt(cx, cy));
      const dens = d < 0.3 || out > 0.15 ? 0 : Math.exp(-dmin / 0.035);
      const k = (j * TW + i) * 4;
      data[k] = Math.max(0, Math.min(255, Math.round(((h + 1) / 8) * 255)));
      data[k + 1] = nb * 32;
      data[k + 2] = Math.round(Math.min(1, dens) * 255);
      data[k + 3] = out > 0.05 ? 0 : roads[k];
    }
  }
  const tex = new THREE.DataTexture(data, TW, TH, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const terrainVert = /* glsl */ `
uniform sampler2D uData;
varying vec2 vUv;
varying vec2 vW;
void main() {
  vUv = uv;
  vec4 d = texture2D(uData, uv);
  float h = d.r * 8.0 - 1.0;
  vec3 p = position;
  p.z += max(h, -0.2) * 0.07;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = vec2(wp.x + 5.0, -wp.z + 3.5);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const terrainFrag = /* glsl */ `
precision highp float;
uniform sampler2D uData;
uniform float uTime;
uniform float uLevels[7];
uniform float uZone[6];
uniform float uScanX;
uniform float uDim;
uniform float uZoneA;
uniform vec2 uTexel;
varying vec2 vUv;
varying vec2 vW;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
float riverY(float x){ return 3.5 + 0.55*sin(0.62*x+0.4) + 0.2*sin(1.7*x); }
float levelFor(float idx){ float l=0.0; for(int k=0;k<7;k++){ if(abs(float(k)-idx)<0.5) l=uLevels[k]; } return l; }
float zoneFor(float idx){ float z=0.0; for(int k=0;k<6;k++){ if(abs(float(k)-idx)<0.5) z=uZone[k]; } return z; }

void main(){
  vec4 d = texture2D(uData, vUv);
  float h = d.r*8.0 - 1.0;
  float idx = floor(d.g*255.0/32.0 + 0.5);
  float dens = d.b;
  float road = d.a;
  float hx = texture2D(uData, vUv+vec2(uTexel.x,0.0)).r - texture2D(uData, vUv-vec2(uTexel.x,0.0)).r;
  float hy = texture2D(uData, vUv+vec2(0.0,uTexel.y)).r - texture2D(uData, vUv-vec2(0.0,uTexel.y)).r;
  vec3 n = normalize(vec3(-hx*40.0, -hy*40.0, 1.0));
  float shade = clamp(dot(n, normalize(vec3(-0.5,0.6,0.7))), 0.0, 1.0);

  vec2 w = vW;
  float field = hash(floor(w*vec2(5.0,7.0) + vec2(floor(fbm(w*2.0)*2.0))));
  vec3 crop = mix(vec3(0.20,0.26,0.13), vec3(0.32,0.33,0.17), field);
  crop = mix(crop, vec3(0.36,0.30,0.20), step(0.78, field));
  crop *= 0.82 + 0.3*fbm(w*14.0);
  vec3 col = crop;
  // blocks of 4×3 lots separated by lanes → reads as streets + houses, not noise
  vec2 g = w*vec2(26.0, 30.0);
  vec2 cell = fract(g);
  vec2 blk = fract(w*vec2(6.5, 7.5));
  float lane = step(0.06, blk.x)*step(blk.x, 0.94)*step(0.07, blk.y)*step(blk.y, 0.93);
  float lot = hash(floor(g));
  float inLot = step(0.12, cell.x)*step(cell.x, 0.88)*step(0.14, cell.y)*step(cell.y, 0.86) * lane;
  float built = step(1.0 - dens*0.95, lot) * inLot;
  vec3 roof = mix(vec3(0.58,0.56,0.51), vec3(0.50,0.32,0.24), step(0.55, hash(floor(g)+7.1)));
  roof = mix(roof, vec3(0.38,0.44,0.48), step(0.82, hash(floor(g)+3.3)));
  col = mix(col, mix(vec3(0.24,0.23,0.21), col, 0.4), clamp(dens*1.2, 0.0, 0.8));
  col = mix(col, roof, built*0.9);
  col = mix(col, vec3(0.46,0.44,0.40), road*0.28);
  col *= 0.55 + 0.6*shade;
  float c = abs(fract(h*2.5) - 0.5);
  float cl = 1.0 - smoothstep(0.0, fwidth(h*2.5)*1.2, c);
  col = mix(col, vec3(0.96,0.95,0.91), cl*0.10*(1.0-built));

  float level = idx > 5.5 ? max(uLevels[6], 0.0) : levelFor(idx);
  float depth = level - h;
  if (depth > 0.0) {
    float nrm = w.y - riverY(clamp(w.x, -2.0, 12.0));
    float channel = 1.0 - smoothstep(0.25, 0.9, abs(nrm));
    float speed = mix(0.12, 0.85, channel);
    vec2 fp = vec2(w.x*3.0 - uTime*speed, nrm*26.0 + sin(w.x*1.3)*1.5);
    float streak = smoothstep(0.68, 0.95, noise(fp)) * smoothstep(0.2, 0.6, noise(fp*vec2(0.35,0.12)+3.0));
    float turb = fbm(vec2(w.x*2.0 - uTime*speed*0.6, nrm*6.0));
    vec3 silt = vec3(0.42,0.36,0.24);
    vec3 deep = vec3(0.17,0.25,0.25);
    vec3 water = mix(silt, deep, clamp(depth/1.6 + channel*0.35, 0.0, 1.0));
    water *= 0.8 + 0.35*turb;
    water += streak * mix(0.0, 0.26, channel*channel);
    water += (turb - 0.5) * 0.05 * (1.0 - channel);
    water += pow(hash(floor(w*70.0 + vec2(uTime*2.0, 0.0))), 220.0) * 0.45 * channel;
    float edge = 1.0 - smoothstep(0.0, 0.06, depth);
    water = mix(water, vec3(0.55,0.5,0.4), edge*0.55);
    water = mix(water, roof*0.6, built*0.35*(1.0 - smoothstep(0.0, 0.8, depth)));
    col = mix(col, water, smoothstep(0.0, 0.02, depth));
  }
  float zr = idx < 5.5 ? zoneFor(idx) : 0.0;
  float hatch = step(0.9, fract((w.x + w.y)*7.0));
  col = mix(col, vec3(1.0,0.36,0.2), hatch*zr*uZoneA);
  float dx = w.x - uScanX;
  float line = 1.0 - smoothstep(0.0, 0.03, abs(dx));
  float trail = (1.0 - smoothstep(0.0, 1.6, -dx)) * step(dx, 0.0);
  col = mix(col, vec3(0.92,0.99,0.45), line*0.9 + trail*0.10);
  col *= uDim;
  gl_FragColor = vec4(col, 1.0);
}`;

function Terrain({ state }: { state: React.MutableRefObject<SceneState> }) {
  const tex = useMemo(() => buildDataTexture(), []);
  const uniforms = useMemo(
    () => ({
      uData: { value: tex },
      uTime: { value: 0 },
      uLevels: { value: [0.3, 0.2, 0, 0.2, 0.3, 0, 0.4] },
      uZone: { value: [0.7, 0, 0, 0.7, 0.3, 0] },
      uScanX: { value: -99 },
      uDim: { value: 0.82 },
      uZoneA: { value: 0.1 },
      uTexel: { value: new THREE.Vector2(1 / TW, 1 / TH) },
    }),
    [tex],
  );
  useFrame((st, dt) => {
    uniforms.uTime.value += dt;
    const f = state.current.frame;
    if (f) {
      const lv = NB_ORDER.map((k, i) => THREE.MathUtils.lerp(uniforms.uLevels.value[i], f.levels[k] ?? 0, Math.min(1, dt * 2)));
      const stage = Math.max(...NB_ORDER.map((k) => f.levels[k] ?? 0)) * 0.6 - 0.2;
      uniforms.uLevels.value = [...lv, stage];
      uniforms.uZone.value = NB_ORDER.map((k) => (f.damZones?.[k] === "very_high" ? 1 : f.damZones?.[k] === "high" ? 0.7 : f.damZones?.[k] === "moderate" ? 0.25 : 0));
    }
    const targetA = state.current.band === "dams" ? 0.42 : 0.08;
    uniforms.uZoneA.value += (targetA - uniforms.uZoneA.value) * Math.min(1, dt * 2);
    const t = st.clock.elapsedTime;
    if (f?.scan) uniforms.uScanX.value = -0.5 + f.scan.progress * 11;
    else {
      const ph = t % 14;
      uniforms.uScanX.value = ph < 5 ? -1 + (ph / 5) * 12.5 : -99;
    }
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[X0 + WW / 2 - 5, 0, -(Y0 + HH / 2 - 3.5)]}>
      <planeGeometry args={[WW, HH, 186, 141]} />
      <shaderMaterial uniforms={uniforms} vertexShader={terrainVert} fragmentShader={terrainFrag} />
    </mesh>
  );
}

const URG: Record<string, THREE.Color> = { critical: new THREE.Color("#ff5a36"), urgent: new THREE.Color("#ffb347"), needs_help: new THREE.Color("#f4f3e8") };

function Beacons({ state }: { state: React.MutableRefObject<SceneState> }) {
  const MAX = 160;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(MAX), 1));
    return g;
  }, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    const f = state.current.frame;
    if (!f) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const size = geo.attributes.size as THREE.BufferAttribute;
    let k = 0;
    for (const i of f.incidents) {
      if (k >= MAX || i.status === "resolved" || i.status === "false_report") continue;
      pos.setXYZ(k, toX(i.x), 0.16, toZ(i.y));
      const c = URG[i.urgency] ?? URG.needs_help;
      col.setXYZ(k, c.r, c.g, c.b);
      size.setX(k, 0.5 + Math.sqrt(i.people) * 0.3);
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
        vertexShader={`attribute float size; attribute vec3 color; uniform float uTime; varying vec3 vC; varying float vS; varying float vP; void main(){ vC = color; vS = size; vP = fract(uTime*0.6 + position.x*1.7); vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 34.0 * (6.0 / -mv.z); gl_Position = projectionMatrix * mv; }`}
        fragmentShader={`varying vec3 vC; varying float vS; varying float vP; void main(){ if (vS <= 0.0) discard; float d = length(gl_PointCoord - 0.5); float core = smoothstep(0.09, 0.0, d); float ring = smoothstep(0.03, 0.0, abs(d - vP*0.48)) * (1.0 - vP); gl_FragColor = vec4(vC, core + ring*0.9); }`}
      />
    </points>
  );
}

function Boats({ state }: { state: React.MutableRefObject<SceneState> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const failed = useMemo(() => new THREE.Color("#5b5a52"), []);
  const ok = useMemo(() => new THREE.Color("#f4f3e8"), []);
  const geom = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.07);
    s.lineTo(0.03, -0.04);
    s.lineTo(0, -0.02);
    s.lineTo(-0.03, -0.04);
    s.closePath();
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  useFrame(() => {
    const f = state.current.frame;
    if (!ref.current || !f) return;
    let k = 0;
    for (const a of f.agents) {
      if (a.type !== "boat") continue;
      o.position.set(toX(a.x), 0.17, toZ(a.y));
      if (a.route.length > 1) o.rotation.y = Math.atan2(toX(a.route[1][0]) - toX(a.x), toZ(a.route[1][1]) - toZ(a.y)) + Math.PI;
      o.updateMatrix();
      ref.current.setMatrixAt(k, o.matrix);
      ref.current.setColorAt(k, a.status === "failed" ? failed : ok);
      k++;
    }
    ref.current.count = k;
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geom, undefined, 8]}>
      <meshBasicMaterial color="#f4f3e8" side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Tags({ state, show }: { state: React.MutableRefObject<SceneState>; show: boolean }) {
  const d1 = DEFAULT_DAMS[0];
  const tag = "pointer-events-none whitespace-nowrap font-mono text-[10.5px] uppercase leading-tight tracking-[0.04em]";
  if (!show) return null;
  return (
    <>
      <Html position={[toX(d1.x), 0.2, toZ(d1.y)]} zIndexRange={[5, 0]}>
        <div className={tag}>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#ebfc72]" /><span className="bg-[#ebfc72] px-1.5 py-0.5 text-[#13140e]">D1 · Jalnagar Barrage</span></div>
          <div className="mt-1 pl-3.5 text-[#f4f3e8]">built {d1.builtYear} · {2026 - d1.builtYear} yrs · high-risk zone ↘</div>
        </div>
      </Html>
      <Html position={[toX(5.0), 0.2, toZ(3.05)]} zIndexRange={[5, 0]}>
        <div className={`${tag} text-[#f4f3e8]`}>
          <div>+ 25.4135°N 85.0496°E</div>
          <div className="text-[#84837b]">main channel · flow → east</div>
        </div>
      </Html>
      <Html position={[toX(8.6), 0.2, toZ(2.2)]} zIndexRange={[5, 0]}>
        <div className={`${tag} text-[#f4f3e8]`}>
          <div>+ Machhua Tola</div>
          <div className="text-[#84837b]">{state.current.frame ? `water ${(state.current.frame.levels.MCH ?? 0).toFixed(2)} m` : "—"}</div>
        </div>
      </Html>
    </>
  );
}

const PRESETS: Record<string, { p: [number, number, number]; t: [number, number, number] }> = {
  hero: { p: [0.4, 8.2, 4.9], t: [0.4, 0, 0.3] },
  sos: { p: [-1.8, 4.6, 3.0], t: [-1.8, 0, 0.1] },
  negotiate: { p: [1.6, 5.0, 3.4], t: [1.6, 0, 0.2] },
  fail: { p: [-2.6, 3.9, 2.6], t: [-3.0, 0, 0.0] },
  orbit: { p: [0.0, 12.5, 1.2], t: [0, 0, 0] },
  dams: { p: [-3.6, 3.6, 2.4], t: [-4.2, 0, -0.1] },
  end: { p: [0.6, 9.8, 6.4], t: [0.6, 0, 0.6] },
};

function Rig({ state }: { state: React.MutableRefObject<SceneState> }) {
  const { camera, size } = useThree();
  const look = useMemo(() => new THREE.Vector3(0.4, 0, 0.3), []);
  const tp = useMemo(() => new THREE.Vector3(), []);
  const tt = useMemo(() => new THREE.Vector3(), []);
  useFrame((st, dt) => {
    const pr = PRESETS[state.current.band] ?? PRESETS.hero;
    const drift = st.clock.elapsedTime;
    tt.set(...pr.t);
    // narrow (portrait) screens: pull the camera back along its view ray so the town keeps its scale
    const pull = size.width / size.height < 1 ? 1.75 : 1;
    tp.set(pr.t[0] + (pr.p[0] - pr.t[0]) * pull + Math.sin(drift * 0.07) * 0.25, pr.t[1] + (pr.p[1] - pr.t[1]) * pull, pr.t[2] + (pr.p[2] - pr.t[2]) * pull + Math.cos(drift * 0.05) * 0.15);
    const k = 1 - Math.exp(-dt * 1.6);
    camera.position.lerp(tp, k);
    look.lerp(tt, k);
    camera.lookAt(look);
  });
  return null;
}

export default function Scene({ state, quality, tags }: { state: React.MutableRefObject<SceneState>; quality: { dpr: number }; tags: boolean }) {
  return (
    <Canvas dpr={[1, quality.dpr]} camera={{ fov: 34, position: [0.4, 8.2, 4.9], near: 0.1, far: 60 }} gl={{ antialias: true, powerPreference: "high-performance" }} aria-hidden>
      <color attach="background" args={["#13140e"]} />
      <fog attach="fog" args={["#13140e", 9, 22]} />
      <Terrain state={state} />
      <Beacons state={state} />
      <Boats state={state} />
      <Tags state={state} show={tags} />
      <Rig state={state} />
    </Canvas>
  );
}
