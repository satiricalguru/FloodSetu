"use client";
import { DEFAULT_DAMS, type Frame } from "@floodsetu/engine";
import { useEffect, useRef } from "react";
import type { WorldGeom } from "@/lib/protocol";
import type { Layers, Selection } from "./store";

/**
 * Offline Canvas2D map (DECISIONS D5). The map is the brightest object on screen.
 * Visual language of uncertainty: dashed = unknown, cross-hatched red = closed, violet dashed pulse = contested,
 * violet hatch over an area = verification pending (e.g. comms blackout). Every colour also has a legend label.
 */
const C = {
  bg: "#080b0f",
  land: ["#0d1218", "#0f141b"],
  border: "rgba(255,255,255,0.10)",
  road: "rgba(154,166,184,0.20)",
  roadBoat: "rgba(46,197,211,0.42)",
  water: "#2ec5d3",
  river: "#0c3440",
  sos: "#ff5a36",
  warn: "#f2b33d",
  safe: "#3ccf8e",
  verify: "#a48bff",
  info: "#7fb2ff",
  bone: "#eceae3",
  mute: "#6b7788",
  text: "#9aa6b8",
  hi: "#eef2f7",
};
const URG: Record<string, string> = { critical: C.sos, urgent: C.warn, needs_help: C.info };
const STATUS_RING: Record<string, string> = { idle: C.mute, en_route: C.info, rescuing: C.warn, working: C.warn, transporting: C.safe, returning: C.mute, refuelling: C.mute, holding: C.warn, failed: C.sos };

interface Props {
  world: WorldGeom;
  frame: Frame | null;
  layers: Layers;
  selection: Selection;
  onSelect: (s: Selection) => void;
  compact?: boolean;
  focus?: string | null;
}

export function MapCanvas({ world, frame, layers, selection, onSelect, compact, focus }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ frame, layers, selection, world, focus });
  st.current = { frame, layers, selection, world, focus };
  const view = useRef({ scale: 60, ox: 0, oy: 0, userMoved: false, w: 0, h: 0 });
  const ghosts = useRef(new Map<string, { route: [number, number][]; t: number }>());
  const lastRoutes = useRef(new Map<string, { end: string; route: [number, number][] }>());
  const hover = useRef<{ x: number; y: number; label: string } | null>(null);

  // static geometry
  const geo = useRef<{ cells: { cx: number; cy: number; nbhd: string; elev: number; key: string }[]; cellMap: Map<string, string> } | null>(null);
  if (!geo.current || geo.current && st.current.world !== world) {
    const cells: { cx: number; cy: number; nbhd: string; elev: number; key: string }[] = [];
    const cellMap = new Map<string, string>();
    for (const n of world.nodes) {
      if (n.kind === "river") continue;
      const i = Math.floor(n.x / 0.5);
      const j = Math.floor(n.y / 0.5);
      const key = `${i},${j}`;
      cellMap.set(key, n.nbhd);
      cells.push({ cx: i * 0.5 + 0.25, cy: j * 0.5 + 0.25, nbhd: n.nbhd, elev: n.elev, key });
    }
    geo.current = { cells, cellMap };
  }

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || "ui-monospace, monospace";
    const sans = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-sans").trim() || "system-ui";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const hatch = (color: string, gap = 6) => {
      const p = document.createElement("canvas");
      p.width = gap;
      p.height = gap;
      const g = p.getContext("2d")!;
      g.strokeStyle = color;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, gap);
      g.lineTo(gap, 0);
      g.stroke();
      return ctx.createPattern(p, "repeat")!;
    };
    const hatchVerify = hatch("rgba(164,139,255,0.45)", 7);
    const hatchProne = hatch("rgba(242,179,61,0.22)", 9);
    const hatchDam = hatch("rgba(255,90,54,0.42)", 6);
    const hatchDamVH = hatch("rgba(255,90,54,0.7)", 4);

    const resize = () => {
      const r = cv.parentElement!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      cv.style.width = `${r.width}px`;
      cv.style.height = `${r.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const v = view.current;
      v.w = r.width;
      v.h = r.height;
      if (!v.userMoved || compact) fit();
    };
    const fit = () => {
      const v = view.current;
      const b = st.current.world.bounds;
      v.scale = Math.min(v.w / (b.w + 0.8), v.h / (b.h + 0.8));
      v.ox = (v.w - b.w * v.scale) / 2;
      v.oy = (v.h - b.h * v.scale) / 2;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(cv.parentElement!);
    resize();

    const W = st.current.world;
    const H = W.bounds.h;
    const sx = (x: number) => view.current.ox + x * view.current.scale;
    const sy = (y: number) => view.current.oy + (H - y) * view.current.scale;

    let raf = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      const { frame: f, layers: L, selection: sel, world: w } = st.current;
      const v = view.current;
      const sc = v.scale;
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, v.w, v.h);
      const levels = f ? (L.truth ? f.levels : f.levelsCop) : {};
      const depthOf = (nb: string, elev: number) => Math.max(0, (levels[nb] ?? 0) - elev);
      const cell = 0.5 * sc;
      const g = geo.current!;
      const nbIndex = Object.fromEntries(w.nbhds.map((n, i) => [n.id, i]));

      // land + flood raster
      for (const c of g.cells) {
        const x = sx(c.cx - 0.25);
        const y = sy(c.cy + 0.25);
        ctx.fillStyle = C.land[(nbIndex[c.nbhd] ?? 0) % 2];
        ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
        if (L.floodExtent && f) {
          const d = depthOf(c.nbhd, c.elev);
          if (d > 0.02) {
            const a = Math.min(0.78, 0.1 + d / 1.8);
            ctx.fillStyle = `rgba(46,197,211,${a.toFixed(3)})`;
            ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
          }
        }
        if (L.floodProne && c.elev < 1.3) {
          ctx.fillStyle = hatchProne;
          ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
        }
        if (L.areaStatus && f?.areaStatus[c.nbhd] === "verification_pending") {
          ctx.fillStyle = hatchVerify;
          ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
        }
      }
      // neighbourhood borders
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const c of g.cells) {
        const [i, j] = c.key.split(",").map(Number);
        const right = g.cellMap.get(`${i + 1},${j}`);
        const up = g.cellMap.get(`${i},${j + 1}`);
        if (right && right !== c.nbhd) {
          ctx.moveTo(sx(c.cx + 0.25), sy(c.cy - 0.25));
          ctx.lineTo(sx(c.cx + 0.25), sy(c.cy + 0.25));
        }
        if (up && up !== c.nbhd) {
          ctx.moveTo(sx(c.cx - 0.25), sy(c.cy + 0.25));
          ctx.lineTo(sx(c.cx + 0.25), sy(c.cy + 0.25));
        }
      }
      ctx.stroke();

      // dam high-risk zones (age / condition / hazard of upstream dams)
      if (L.damZones && f?.damZones) {
        for (const c of g.cells) {
          const z = f.damZones[c.nbhd];
          if (z !== "high" && z !== "very_high") continue;
          ctx.fillStyle = z === "very_high" ? hatchDamVH : hatchDam;
          ctx.fillRect(sx(c.cx - 0.25), sy(c.cy + 0.25), cell + 0.5, cell + 0.5);
        }
      }
      // satellite-observed flood extent (latest SAR product, drawn with its age)
      if (L.satFlood && f?.satFlood) {
        ctx.strokeStyle = "rgba(235,252,114,0.75)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        for (const c of g.cells) {
          const lvl = f.satFlood.levels[c.nbhd];
          if (lvl === undefined || lvl - c.elev <= 0.1) continue;
          ctx.strokeRect(sx(c.cx - 0.25) + 1.5, sy(c.cy + 0.25) + 1.5, cell - 3, cell - 3);
        }
        ctx.setLineDash([]);
      }
      // swath sweep during a satellite pass
      if (f?.scan) {
        const x = sx(-0.2 + f.scan.progress * (w.bounds.w + 0.4));
        const gr = ctx.createLinearGradient(x - 120, 0, x, 0);
        gr.addColorStop(0, "rgba(235,252,114,0)");
        gr.addColorStop(1, "rgba(235,252,114,0.16)");
        ctx.fillStyle = gr;
        ctx.fillRect(x - 120, 0, 120, v.h);
        ctx.strokeStyle = "rgba(235,252,114,0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, v.h);
        ctx.stroke();
        ctx.font = `600 10px ${mono}`;
        ctx.fillStyle = "#ebfc72";
        ctx.fillText(`${f.scan.sat.toUpperCase()} · ${f.scan.kind.toUpperCase()} ACQUIRING`, x + 6, 70);
      }

      // river
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      w.river.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
      ctx.strokeStyle = C.river;
      ctx.lineWidth = 0.52 * sc;
      ctx.stroke();
      ctx.strokeStyle = "rgba(46,197,211,0.55)";
      ctx.lineWidth = Math.max(1, 0.05 * sc);
      ctx.shadowColor = C.water;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();

      // edges
      if (L.edges && f) {
        const status = L.truth ? f.edgeTruth : f.edgeCop;
        const pulse = reduce ? 1 : 0.55 + 0.45 * Math.sin(t / 260);
        w.edges.forEach((e, i) => {
          const a = w.nodes[e.a];
          const b = w.nodes[e.b];
          const s = status[i] ?? "o";
          const x1 = sx(a.x), y1 = sy(a.y), x2 = sx(b.x), y2 = sy(b.y);
          ctx.setLineDash([]);
          if (e.kind === "water") {
            if (a.kind === "river" && b.kind === "river") return;
            ctx.strokeStyle = "rgba(46,197,211,0.6)";
            ctx.lineWidth = 1.2;
          } else if (e.kind === "bridge") {
            ctx.strokeStyle = s === "c" ? C.sos : s === "x" ? C.verify : s === "u" ? C.warn : C.bone;
            ctx.lineWidth = 3.2;
            if (s === "u" || s === "x") ctx.setLineDash([5, 4]);
            if (s === "x") ctx.globalAlpha = pulse;
          } else {
            const depth = Math.max(depthOf(a.nbhd, a.elev), depthOf(b.nbhd, b.elev));
            if (s === "c") {
              ctx.strokeStyle = C.sos;
              ctx.lineWidth = 2;
            } else if (s === "x") {
              ctx.strokeStyle = C.verify;
              ctx.lineWidth = 2.4;
              ctx.setLineDash([3, 3]);
              ctx.globalAlpha = pulse;
            } else if (s === "u") {
              ctx.strokeStyle = C.warn;
              ctx.lineWidth = 1.5;
              ctx.setLineDash([4, 4]);
            } else {
              ctx.strokeStyle = depth >= 0.4 ? C.roadBoat : C.road;
              ctx.lineWidth = 1;
            }
          }
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          if (s === "c") {
            // cross-hatch marks along closed edges
            ctx.setLineDash([]);
            ctx.strokeStyle = C.sos;
            ctx.lineWidth = 1.5;
            const n = Math.max(1, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 10));
            for (let k = 1; k <= n; k++) {
              const px = x1 + ((x2 - x1) * k) / (n + 1);
              const py = y1 + ((y2 - y1) * k) / (n + 1);
              ctx.beginPath();
              ctx.moveTo(px - 3, py - 3);
              ctx.lineTo(px + 3, py + 3);
              ctx.moveTo(px - 3, py + 3);
              ctx.lineTo(px + 3, py - 3);
              ctx.stroke();
            }
          }
          if (e.kind === "bridge" && L.labels) {
            ctx.font = `600 10px ${mono}`;
            ctx.fillStyle = s === "c" ? C.sos : C.hi;
            ctx.fillText(e.id, (x1 + x2) / 2 + 6, (y1 + y2) / 2 - 4);
          }
        });
        ctx.setLineDash([]);
      }

      // heatmap of unmet need
      if (L.heatmap && f) {
        for (const inc of f.incidents) {
          if (inc.status === "resolved" || inc.status === "false_report") continue;
          const r = (0.35 + Math.min(0.6, inc.wait / 120)) * sc;
          const gr = ctx.createRadialGradient(sx(inc.x), sy(inc.y), 0, sx(inc.x), sy(inc.y), r);
          const a = Math.min(0.5, 0.08 + inc.people * inc.wait * 0.0006);
          gr.addColorStop(0, `rgba(255,90,54,${a})`);
          gr.addColorStop(1, "rgba(255,90,54,0)");
          ctx.fillStyle = gr;
          ctx.fillRect(sx(inc.x) - r, sy(inc.y) - r, r * 2, r * 2);
        }
      }

      // ghats
      for (const gid of w.ghats) {
        const n = w.nodes[gid];
        ctx.save();
        ctx.translate(sx(n.x), sy(n.y));
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = C.water;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-3, -3, 6, 6);
        ctx.restore();
      }

      // routes (+ ghosts of replaced routes)
      if (L.routes && f) {
        const now = performance.now();
        for (const [id, gh] of ghosts.current) {
          const age = (now - gh.t) / 1600;
          if (age > 1) {
            ghosts.current.delete(id);
            continue;
          }
          ctx.globalAlpha = 0.6 * (1 - age);
          ctx.strokeStyle = C.mute;
          ctx.setLineDash([2, 4]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          gh.route.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        for (const a of f.agents) {
          if (a.route.length < 2) continue;
          const selected = sel?.kind === "agent" && sel.id === a.id;
          ctx.strokeStyle = a.type === "boat" ? C.info : C.bone;
          ctx.globalAlpha = selected ? 1 : 0.55;
          ctx.lineWidth = selected ? 2.6 : 1.6;
          ctx.setLineDash([6, 7]);
          ctx.lineDashOffset = reduce ? 0 : -(t / 40) % 13;
          ctx.beginPath();
          a.route.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }

      // dams (NRLD-style register: year built → age → risk)
      if (f) {
        for (const d of DEFAULT_DAMS) {
          const st = f.dams.find((x) => x.id === d.id);
          const risk = st?.risk ?? "low";
          const col = st?.alert === "release" || st?.alert === "breach" || risk === "very_high" || risk === "high" ? C.sos : risk === "moderate" ? C.warn : C.mute;
          const x = sx(d.x);
          const y = sy(d.y);
          ctx.fillStyle = "#0d1117";
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 10, y + 6);
          ctx.lineTo(x - 6, y - 6);
          ctx.lineTo(x + 6, y - 6);
          ctx.lineTo(x + 10, y + 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if ((st?.alert === "release" || st?.alert === "breach") && !reduce) {
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t / 160);
            ctx.beginPath();
            ctx.arc(x, y, 16, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          if (L.labels && !compact) {
            ctx.font = `600 9.5px ${mono}`;
            ctx.fillStyle = col;
            ctx.fillText(`${d.id} · ${d.builtYear} · ${2026 - d.builtYear}Y · ${risk.replace("_", " ").toUpperCase()}`, x + 13, y - 2);
            ctx.font = `9px ${mono}`;
            ctx.fillStyle = C.text;
            ctx.fillText(`${st?.reservoirPct ?? "—"}% FRL${st?.releaseCumecs ? ` · ${st.releaseCumecs.toLocaleString("en-IN")} m³/s` : ""}`, x + 13, y + 9);
          }
          if (sel?.kind === "dam" && sel.id === d.id) ring(x, y, 18, C.hi);
        }
      }

      // shelters (capacity donuts)
      if (L.shelters && f) {
        for (const s of w.shelters) {
          const n = w.nodes[s.node];
          const ss = f.shelters.find((x) => x.id === s.id);
          if (!ss) continue;
          const x = sx(n.x);
          const y = sy(n.y);
          const r = 9;
          const fr = Math.min(1, ss.occupancy / Math.max(1, ss.capacity));
          const fr2 = Math.min(1, (ss.occupancy + ss.reserved) / Math.max(1, ss.capacity));
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = "#222c3a";
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.stroke();
          const col = fr >= 0.95 ? C.sos : fr >= 0.7 ? C.warn : C.safe;
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + fr2 * Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + fr * Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#0d1117";
          ctx.beginPath();
          ctx.arc(x, y, r - 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = C.hi;
          ctx.font = `600 9px ${mono}`;
          ctx.textAlign = "center";
          ctx.fillText(s.id, x, y + 3);
          if (L.labels && !compact) {
            ctx.font = `10px ${mono}`;
            ctx.fillStyle = fr >= 0.95 ? C.sos : C.text;
            ctx.fillText(`${ss.occupancy}/${ss.capacity}`, x, y + r + 12);
          }
          ctx.textAlign = "left";
          if (sel?.kind === "shelter" && sel.id === s.id) ring(x, y, r + 6, C.hi);
        }
      }

      // incidents / SOS
      if (L.sos && f) {
        for (const inc of f.incidents) {
          const x = sx(inc.x);
          const y = sy(inc.y);
          const r = Math.min(16, 3.5 + Math.sqrt(inc.people) * 1.9);
          const col = URG[inc.urgency] ?? C.info;
          if (inc.status === "resolved") {
            ctx.strokeStyle = C.safe;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(x - 4, y);
            ctx.lineTo(x - 1, y + 3);
            ctx.lineTo(x + 5, y - 4);
            ctx.stroke();
            continue;
          }
          if (inc.status === "false_report") {
            ctx.strokeStyle = C.mute;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x - 4, y - 4);
            ctx.lineTo(x + 4, y + 4);
            ctx.moveTo(x - 4, y + 4);
            ctx.lineTo(x + 4, y - 4);
            ctx.stroke();
            continue;
          }
          const waiting = inc.status === "open" || inc.status === "assigned";
          if (waiting && !reduce) {
            const ph = ((t / 1400 + inc.x * 3.1) % 1 + 1) % 1;
            ctx.strokeStyle = col;
            ctx.globalAlpha = (1 - ph) * 0.7;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x, y, r + ph * 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          ctx.fillStyle = col;
          ctx.globalAlpha = inc.status === "in_progress" ? 0.55 : 0.9;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          if (inc.verification === "pending" || inc.verification === "under_review") {
            ctx.strokeStyle = inc.verification === "under_review" ? C.warn : C.verify;
            ctx.setLineDash([2, 2]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x, y, r + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          if (inc.escalated) {
            ctx.strokeStyle = C.hi;
            ctx.lineWidth = 1.2;
            ctx.globalAlpha = reduce ? 1 : 0.5 + 0.5 * Math.sin(t / 150);
            ctx.beginPath();
            ctx.arc(x, y, r + 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          if (inc.deviceLost) {
            ctx.font = `600 10px ${mono}`;
            ctx.fillStyle = C.hi;
            ctx.strokeStyle = C.hi;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.arc(x, y, r + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillText("PHONE LOST · LAST KNOWN", x + r + 12, y + 3);
          }
          if (inc.reports > 1 && sc > 45) {
            ctx.font = `600 9px ${mono}`;
            ctx.fillStyle = C.hi;
            ctx.fillText(`×${inc.reports}`, x + r + 2, y - r + 2);
          }
          if (sel?.kind === "incident" && sel.id === inc.id) ring(x, y, r + 9, C.hi);
        }
      }

      // agents
      if (L.agents && f) {
        for (const a of f.agents) {
          const x = sx(a.x);
          const y = sy(a.y);
          const ringCol = STATUS_RING[a.status] ?? C.mute;
          ctx.globalAlpha = a.connected ? 1 : 0.45;
          if (a.type === "boat") {
            let ang = -Math.PI / 2;
            if (a.route.length > 1) ang = Math.atan2(sy(a.route[1][1]) - y, sx(a.route[1][0]) - x);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-6, 5);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-6, -5);
            ctx.closePath();
            ctx.fillStyle = a.status === "failed" ? "#3a4250" : C.bone;
            ctx.fill();
            ctx.restore();
          } else {
            ctx.beginPath();
            ctx.arc(x, y, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = a.status === "failed" ? "#3a4250" : C.bone;
            ctx.fill();
          }
          ctx.strokeStyle = ringCol;
          ctx.lineWidth = 1.8;
          if (!a.connected) ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(x, y, a.type === "boat" ? 10 : 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          if (a.status === "failed") {
            ctx.strokeStyle = C.sos;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 5, y - 5);
            ctx.lineTo(x + 5, y + 5);
            ctx.moveTo(x - 5, y + 5);
            ctx.lineTo(x + 5, y - 5);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          if (L.labels && sc > 50 && !compact) {
            ctx.font = `600 9.5px ${mono}`;
            ctx.fillStyle = a.connected ? C.hi : C.mute;
            ctx.fillText(a.id + (a.onboard ? ` ·${a.onboard}` : ""), x + 11, y + 3);
            if (!a.connected && a.lastSeen !== undefined && f) {
              ctx.font = `9px ${mono}`;
              ctx.fillStyle = C.verify;
              ctx.fillText(`last seen T-${f.tick - a.lastSeen}m`, x + 11, y + 14);
            }
          }
          if (sel?.kind === "agent" && sel.id === a.id) ring(x, y, 15, C.hi);
        }
      }

      // neighbourhood labels + area status chips
      if (L.labels && f && !compact) {
        for (const n of w.nbhds) {
          const x = sx(n.cx);
          const y = sy(n.cy);
          const stt = f.areaStatus[n.id];
          const col = stt === "flooded" ? C.water : stt === "at_risk" ? C.warn : stt === "verification_pending" ? C.verify : C.safe;
          const label = n.name.toUpperCase();
          ctx.font = `600 10px ${mono}`;
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = "rgba(8,11,15,0.72)";
          roundRect(x - tw / 2 - 8, y - 18, tw + 16, 30, 4);
          ctx.fill();
          ctx.fillStyle = C.hi;
          ctx.textAlign = "center";
          ctx.fillText(label, x, y - 6);
          ctx.font = `9px ${mono}`;
          ctx.fillStyle = col;
          const statusText = { normal: "● NORMAL", at_risk: "▲ AT RISK", flooded: "≈ FLOODED", verification_pending: "◌ VERIFYING" }[stt ?? "normal"];
          ctx.fillText(`${statusText}  ${(levels[n.id] ?? 0).toFixed(2)}m`, x, y + 6);
          ctx.textAlign = "left";
        }
      }

      // hover tooltip
      const hv = hover.current;
      if (hv) {
        ctx.font = `11px ${sans}`;
        const tw = ctx.measureText(hv.label).width;
        ctx.fillStyle = "rgba(18,24,33,0.95)";
        roundRect(hv.x + 12, hv.y + 10, tw + 14, 22, 4);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.stroke();
        ctx.fillStyle = C.hi;
        ctx.fillText(hv.label, hv.x + 19, hv.y + 25);
      }
    };

    function ring(x: number, y: number, r: number, col: string) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    raf = requestAnimationFrame(draw);

    // ── interaction ──
    let drag: { x: number; y: number; ox: number; oy: number; moved: boolean } | null = null;
    const toWorld = (px: number, py: number) => ({ x: (px - view.current.ox) / view.current.scale, y: H - (py - view.current.oy) / view.current.scale });
    const hit = (px: number, py: number): { sel: Selection; label: string } | null => {
      const { frame: f, world: w } = st.current;
      if (!f) return null;
      let best: { d: number; sel: Selection; label: string } | null = null;
      const consider = (x: number, y: number, s: Selection, label: string, rad = 14) => {
        const d = Math.hypot(sx(x) - px, sy(y) - py);
        if (d < rad && (!best || d < best.d)) best = { d, sel: s, label };
      };
      for (const a of f.agents) consider(a.x, a.y, { kind: "agent", id: a.id }, `${a.id} · ${a.status.replace("_", " ")}${a.onboard ? ` · ${a.onboard}/${a.capacity} on board` : ""}`);
      for (const i of f.incidents) if (i.status !== "resolved") consider(i.x, i.y, { kind: "incident", id: i.id }, `${i.id} · ${i.people} people · ${i.urgency.replace("_", " ")} · ${i.verification.replace("_", " ")}`);
      for (const s of w.shelters) {
        const n = w.nodes[s.node];
        const ss = f.shelters.find((q) => q.id === s.id);
        consider(n.x, n.y, { kind: "shelter", id: s.id }, `${s.id} ${s.name} · ${ss?.occupancy}/${ss?.capacity}`);
      }
      for (const d of DEFAULT_DAMS) consider(d.x, d.y, { kind: "dam", id: d.id }, `${d.name} · built ${d.builtYear} (${2026 - d.builtYear} yrs)`, 16);
      if (best) return best;
      // edges (bridges get a generous radius)
      for (const e of w.edges) {
        const a = w.nodes[e.a];
        const b = w.nodes[e.b];
        const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y);
        const l2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
        const tt = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2));
        const d = Math.hypot(px - (ax + tt * (bx - ax)), py - (ay + tt * (by - ay)));
        if (d < (e.kind === "bridge" ? 9 : 4)) return { sel: { kind: "edge", id: e.id }, label: `${e.label ?? e.id} · ${e.kind}` };
      }
      return null;
    };
    const onDown = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, ox: view.current.ox, oy: view.current.oy, moved: false };
      cv.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      if (drag) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (drag.moved && !compact) {
          view.current.userMoved = true;
          view.current.ox = drag.ox + dx;
          view.current.oy = drag.oy + dy;
        }
        return;
      }
      const h = hit(e.clientX - r.left, e.clientY - r.top);
      hover.current = h ? { x: e.clientX - r.left, y: e.clientY - r.top, label: h.label } : null;
      cv.style.cursor = h ? "pointer" : compact ? "default" : "grab";
    };
    const onUp = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      if (drag && !drag.moved) {
        const h = hit(e.clientX - r.left, e.clientY - r.top);
        if (h) onSelect(h.sel);
        else {
          const wp = toWorld(e.clientX - r.left, e.clientY - r.top);
          const nb = geo.current!.cellMap.get(`${Math.floor(wp.x / 0.5)},${Math.floor(wp.y / 0.5)}`);
          onSelect(nb ? { kind: "nbhd", id: nb } : null);
        }
      }
      drag = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (compact) return;
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const v = view.current;
      const k = Math.exp(-e.deltaY * 0.0015);
      const ns = Math.max(30, Math.min(700, v.scale * k));
      const wx = (px - v.ox) / v.scale;
      const wy = (py - v.oy) / v.scale;
      v.scale = ns;
      v.userMoved = true;
      v.ox = px - wx * ns;
      v.oy = py - wy * ns;
    };
    const onLeave = () => (hover.current = null);
    const onDbl = () => {
      view.current.userMoved = false;
      fit();
    };
    cv.addEventListener("dblclick", onDbl);
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointerleave", onLeave);
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("wheel", onWheel);
      cv.removeEventListener("dblclick", onDbl);
    };
  }, [world, compact]);

  // ghost routes: when an agent's destination changes, fade out the old route
  useEffect(() => {
    if (!frame) return;
    for (const a of frame.agents) {
      const end = a.route.length ? `${a.route[a.route.length - 1][0].toFixed(2)},${a.route[a.route.length - 1][1].toFixed(2)}` : "";
      const prev = lastRoutes.current.get(a.id);
      if (prev && end && prev.end && prev.end !== end && prev.route.length > 1) ghosts.current.set(a.id, { route: prev.route, t: performance.now() });
      lastRoutes.current.set(a.id, { end, route: a.route });
    }
  }, [frame]);

  // focus a neighbourhood
  useEffect(() => {
    if (!focus) return;
    const n = world.nbhds.find((x) => x.id === focus);
    if (!n) return;
    const v = view.current;
    v.userMoved = true;
    v.scale = Math.min(220, Math.max(v.scale, 110));
    v.ox = v.w / 2 - n.cx * v.scale;
    v.oy = v.h / 2 - (world.bounds.h - n.cy) * v.scale;
  }, [focus, world]);

  return <canvas ref={ref} className="block h-full w-full touch-none" aria-label="Live map of Jalnagar: flood extent, roads, incidents, agents and shelters" role="img" />;
}
