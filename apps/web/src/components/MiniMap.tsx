"use client";
import { buildWorld } from "@floodsetu/engine";
import { useMemo } from "react";

/** Light SVG map for phones (citizen & rescuer): river, roads, shelters, the request site and the team. */
export function MiniMap({ site, team, teamType, route, shelters = true, height = 200, focus }: { site?: { x: number; y: number } | null; team?: { x: number; y: number } | null; teamType?: "boat" | "ground"; route?: [number, number][]; shelters?: boolean; height?: number; focus?: { x: number; y: number } | null }) {
  const w = useMemo(() => buildWorld(), []);
  const W = w.bounds.w;
  const H = w.bounds.h;
  const c = focus ?? site ?? team ?? { x: W / 2, y: H / 2 };
  const span = 3.2;
  const vb = `${Math.max(-0.3, Math.min(W - span, c.x - span / 2))} ${Math.max(-0.3, Math.min(H - span * 0.62, H - c.y - span * 0.31))} ${span} ${span * 0.62}`;
  const Y = (y: number) => H - y;
  const roads = useMemo(() => w.edges.filter((e) => e.kind !== "water").map((e) => ({ id: e.id, a: w.nodes[e.a], b: w.nodes[e.b], bridge: e.kind === "bridge" })), [w]);
  return (
    <svg viewBox={vb} className="block w-full rounded-[12px] bg-[#0b1016]" style={{ height }} role="img" aria-label="Map of your location and the rescue team">
      <path d={w.river.map(([x, y], i) => `${i ? "L" : "M"}${x},${Y(y)}`).join("")} stroke="#0c3440" strokeWidth={0.5} fill="none" strokeLinecap="round" />
      <path d={w.river.map(([x, y], i) => `${i ? "L" : "M"}${x},${Y(y)}`).join("")} stroke="#2ec5d3" strokeOpacity={0.6} strokeWidth={0.03} fill="none" />
      {roads.map((r) => (
        <line key={r.id} x1={r.a.x} y1={Y(r.a.y)} x2={r.b.x} y2={Y(r.b.y)} stroke={r.bridge ? "#eceae3" : "#9aa6b8"} strokeOpacity={r.bridge ? 0.8 : 0.22} strokeWidth={r.bridge ? 0.05 : 0.018} />
      ))}
      {shelters
        ? w.shelters.map((s) => {
            const n = w.nodes[s.node];
            return (
              <g key={s.id}>
                <circle cx={n.x} cy={Y(n.y)} r={0.07} fill="#0d1117" stroke="#3ccf8e" strokeWidth={0.025} />
                <text x={n.x + 0.1} y={Y(n.y) + 0.04} fontSize={0.11} fill="#9aa6b8" fontFamily="ui-monospace">{s.id}</text>
              </g>
            );
          })
        : null}
      {route && route.length > 1 ? <path d={route.map(([x, y], i) => `${i ? "L" : "M"}${x},${Y(y)}`).join("")} stroke="#7fb2ff" strokeWidth={0.035} strokeDasharray="0.08 0.06" fill="none" /> : null}
      {site ? (
        <g>
          <circle cx={site.x} cy={Y(site.y)} r={0.16} fill="#ff5a36" opacity={0.25}>
            <animate attributeName="r" values="0.08;0.28;0.08" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx={site.x} cy={Y(site.y)} r={0.07} fill="#ff5a36" />
        </g>
      ) : null}
      {team ? (
        <g>
          <circle cx={team.x} cy={Y(team.y)} r={0.11} fill="none" stroke="#7fb2ff" strokeWidth={0.025} />
          {teamType === "boat" ? <path d={`M${team.x - 0.07},${Y(team.y) + 0.04} L${team.x + 0.07},${Y(team.y) + 0.04} L${team.x},${Y(team.y) - 0.08}Z`} fill="#eceae3" /> : <circle cx={team.x} cy={Y(team.y)} r={0.05} fill="#eceae3" />}
        </g>
      ) : null}
    </svg>
  );
}
