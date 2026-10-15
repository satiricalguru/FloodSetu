# Progress log

## Phase 0 — Research ✅
- `docs/RESEARCH.md`: 10 topics with sources, chosen approaches, and an Aarogya Setu borrow-vs-fix table.
- `docs/ARCHITECTURE.md`: monorepo map, Mermaid system and tick diagrams, the firewall, the info model, and the live bridge.
- `docs/DECISIONS.md`: D1–D20.
- Design tokens drafted from the nine Refero DESIGN.md extracts → `packages/ui/tokens.css`.

## Phase 1 — Engine core ✅
- `packages/engine`: Jalnagar world (279 nodes / 496 edges / 3 bridges / 6 ghats / 6 shelters). The truth / COP / agent-belief layers use log-odds fusion with decay and contradiction detection. Agents comprise 8 boats and 15 ground teams with skills, fuel, capacity and escort. CNP has bundles, leveled commitment and preemption. There is a common MONITOR phase with reason-coded decommits, 9 invariants checked every tick, event sourcing, frames and cascades.
- Scenarios: baseline-monsoon, sos-surge, contradiction, triple-failure, blackout, fraud-mix.
- Tests: 55 passing, including fast-check property tests (random disruptions × 4 strategies → 0 invariant violations) and determinism (log hash).

## Phase 2 — Baselines + metrics + bench ✅
- Central Hungarian (same-info and omniscient) and the greedy floor run through the same tick, execution and invariants.
- `pnpm bench`: 6 scenarios × 5 seeds × 4 strategies = 120 runs in about 65 s. Outputs `bench/results.{json,csv}`, `bench/RESULTS.md`, and an auto verdict.
- Honest headline: **central (same-info) beats CNP on critical response; greedy beats both on mean TTS and throughput; CNP wins idle-while-demand, cascade recovery, and the baseline and blackout mean TTS.** Logged, not hidden.

## Phase 3 — Control Room ✅
- Engine in a Web Worker. Canvas2D map: flood raster, belief-coloured edges (dashed unknown, cross-hatched closed, violet contested), hatched verifying areas, capacity donuts, route flow and reroute ghosts.
- KPI bar with sparklines and the invariant badge, the negotiation feed, the Why? drawer (bids, utility, constraints, original reports), and the cascade panel (cancelled → reason → re-auction → bids → plain language → before/after).
- Views: Incidents, Agents, Shelters, Verification, Scenarios, Compare (bench and live), Replay (AAR), Audit. ⌘K palette and keyboard shortcuts.

## Phases 4–6 — SOS, Rescuer, auth, fraud, relief ✅
- Guest SOS PWA (EN/हिं) with IndexedDB outbox (Queued → Sent → Received), idempotent server, lifecycle stepper, team ETA and position, tips, thread, SMS fallback.
- Rescuer app: task card with route and Why?, crew actions, field reports (road, water, bridge) that feed beliefs, Lamport-ordered offline outbox.
- OTP plus HMAC sessions with refresh rotation and reuse detection, CSRF double-submit, RBAC on every route, rotating handles, account delete and export, location coarsening and purge.
- Relief: campaigns (verified orgs only), inventory flow, hash-chained public ledger with in-browser verify and tamper demo, Sankey, needs vs fulfilled (k ≥ 5), fraud flags. Admin: audit chain, flags, badges, roles.

## Phases 7–8 — Landing + polish ✅
- R3F scene built from the engine's world graph, a custom GLSL water shader, GPU rain, and beacons, boats and bid arcs driven by a live worker engine. The triple failure is injected on scroll, then a night → dawn transition. GSAP and Lenis drive the scroll; there is a reduced-motion and no-WebGL static fallback.
- Playwright: 7 e2e tests pass. Vitest: 75 pass. ESLint firewall rule is active. Bench: 120 runs with 0 invariant violations.
- Late tuning (D27, D28): MAX_QUEUE = 1 kept, the critical extra slot rejected (data-driven).

## Current state (final audit, 16 Oct 2026)

- **Fleet:** 8 boats + 17 ground teams (incl. 2 flood-rescue engineer teams) = 25 agents. **10 invariants**, 0 violations across 7 scenarios × 4 strategies (140 bench runs).
- **Audit run:** every scenario × {CNP, central} records one replay frame per tick. Every AWARD/DECOMMIT carries a reason, reroutes are reason-coded, contradictions are detected and resolved, the triple-failure cascade is captured, all 3 river gauges report, and multi-device corroboration fires.
- **Tests:** 109 unit/property/architecture/i18n/river (vitest) + 11 Playwright e2e. **Live:** https://floodsetu.vercel.app. The later items (river monitoring, alerts, live GPS, cooldown, corroboration, engineers, family SMS, iPhone app) are logged in DECISIONS D40–D43.
