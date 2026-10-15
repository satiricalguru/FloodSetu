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
