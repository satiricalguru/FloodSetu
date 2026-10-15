# Decisions log

Format: **What was asked → What we did → Why.**

| # | Asked | Did | Why |
|---|---|---|---|
| D1 | Name "JalSetu" | Kept **JalSetu** | Short, bilingual, and the Setu lineage is intentional. Other projects may use the same name, so this is fine for a hackathon prototype but needs a trademark check before any real deployment |
| D2 | Contract Net Protocol, CBBA if time | **CNP with priority-ordered sequential auctions + bundles (≤2) + leveled commitment** | A one-task-at-a-time CBBA special case that is easy to explain to an operator. Full CBBA consensus rounds are logged as future work (RESEARCH §4.1) |
| D3 | `packages/baseline` separate | Baselines live in `packages/engine/src/strategies/` | Execution, monitoring, invariants and metrics must be *identical* across strategies for a fair comparison. One package keeps a single source of truth. A strategy is a pluggable `Strategy` interface |
| D4 | OR-Tools sidecar optional | **Pure-TS Hungarian** for central | Deterministic, offline, and no Python process during the demo. OR-Tools VRP is listed in LIMITATIONS |
| D5 | MapLibre GL + deck.gl | **Custom Canvas2D map renderer** over synthetic town geometry | A fully offline demo needs no tiles. We get full control of the uncertainty visual language (dashed unknown edges, cross-hatched closures, hatch fills for unverified areas, glow, flow animation), and the landing page's R3F keeps the only WebGL context. About 300 nodes, 600 edges and 23 agents render at 60fps on Canvas2D. Swapping to MapLibre for a real basemap is a renderer change only |
| D6 | Synthetic town or real overlay | **Fictional riverine town "Jalnagar"** in local km coordinates (displayed as synthetic lat/lng anchored at 25.40°N 85.00°E, labelled fictional) | No risk of being mistaken for operational data about a real place |
| D7 | Postgres/PostGIS or SQLite | **File-backed JSON stores behind repository functions** (`.data/dispatch.json`, `.data/relief.json`) | Zero setup (setup in ≤3 commands). The two separate files make the module isolation physical. A repository interface makes Postgres a drop-in |
| D8 | Socket.IO / Supabase Realtime | **2 s polling** for the live bridge | Works through any network, needs no extra server process, and is easy to reason about offline. Latency is fine for a demo |
| D9 | next-intl | Tiny typed dictionary + `useT()` hook, `en`/`hi` | No routing rewrite. Panels toggle language instantly, and the choice persists in localStorage |
| D10 | next-pwa / Serwist | Hand-written `public/sw.js` + IndexedDB outbox (`idb-keyval`) | Transparent and small, with no build-plugin coupling to Next 15. Background Sync is used when present |
| D11 | shadcn/ui primitives | Own primitives restyled to tokens; `cmdk` for ⌘K | Avoids an interactive CLI and network scaffolding. Each component is small and token-driven |
| D12 | Recharts/visx | **Own SVG charts** (sparklines, grouped bars, Sankey via `d3-sankey` layout only) | Visual consistency with tokens and a tiny bundle |
| D13 | Turborepo | **pnpm workspaces only** (`pnpm -r`) | Five packages with TS-source consumption and no build step, so Turbo's cache adds nothing here |
| D14 | Passability rules | Ground ≤ 0.5 m depth; boats ≥ 0.4 m on roads; river = boat-only; bridge = ground-only | The 0.4–0.5 m overlap reflects shallow-draft IRBs. Thresholds live in `config.ts` |
| D15 | Contradiction handling | Contested edges: **closed for ground agents, ×3 cost for boats**, and a VERIFY task is auctioned | "Prefer safe routing" (PS) |
| D16 | Verification gating | Unverified non-critical requests are **never blocked**. They carry a confidence factor (0.6–1.0) in priority. Critical requests ignore verification entirely | Invariant 7, plus ordering under scarcity |
| D17 | Extra reason code | Added `CENTRAL_REPLAN` (baseline reassignment) and `TASK_RESOLVED` (merged/withdrawn) | The PS reason codes don't cover baseline churn. Every decommit must carry a reason (invariant 9) |
| D18 | Jain's index input | Jain over **per-neighbourhood mean waits** (equality of treatment), paired with **worst-neighbourhood P90** | Jain measures equality, not level. P90 adds the Rawlsian worst-off view (RESEARCH §4.3) |
| D19 | Live real-phone SOS | The control-room browser is the dispatch brain. Phones talk to the server, which bridges to the worker | Keeps the judged engine in one place. The rescuer phone is "logged in as" a fleet unit |
| D20 | Expectant (black) triage | Not modelled | A dispatch tool must not encode abandonment decisions |
