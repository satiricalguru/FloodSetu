# FloodSetu — Flood Rescue Dispatch

> *When the water rises, every second negotiates.*
> Code-E-Manipal 2.0 · Track 06 Multi-Agent Systems / Logistics · **PS 27** · synthetic simulation

FloodSetu treats rescue boats, ground teams, shelters, bridges and SOS clusters as **autonomous agents** with **partial information**. They negotiate with a **Contract-Net auction with leveled commitment**, and the system compares that against a **centralised Hungarian baseline** (same-information and omniscient) plus a greedy floor. All four run on the same seeded, time-stepped engine with **9 explicit safety invariants**, which are checked every tick.

Around the judged engine sits a full product: a citizen SOS PWA (works offline), a rescuer app, a control-room dashboard, and a **firewalled** relief and donations module with a hash-chained public ledger.

## Run it (3 commands)

```bash
pnpm install
```
```bash
pnpm dev
```
Then open **http://localhost:3000**. Everything runs offline: mock OTP, no map tiles, no external APIs.

| URL | What |
|---|---|
| `/` | Immersive landing. The WebGL town is driven by a real engine instance in a worker |
| `/control` | **Control Room**: live map, negotiation feed, Why? drawer, triple-failure cascade, compare, replay, audit, ⌘K |
| `/sos` | Citizen SOS (guest, bilingual, offline outbox) |
| `/rescuer` | Rescuer phone (demo: tap a unit, or OTP with `9000000001` → B-1) |
| `/relief` | Public transparency ledger (light mode). Click **Verify ledger** |
| `/admin` | Audit chain, fraud flags, badges, roles |
| `/awareness`, `/design`, `/dev/inbox` | Safety guide (EN/हिं), design tokens, mock SMS inbox |

## Evidence

```bash
pnpm test     # 75 unit/property/architecture tests (vitest + fast-check)
```
```bash
pnpm bench    # 6 scenarios × 5 seeds × 4 strategies = 120 runs → bench/RESULTS.md
```
```bash
pnpm e2e      # Playwright: guest SOS, live rescuer accept, triple failure, Why?, ledger tamper check
```
```bash
pnpm sim scenarios/triple-failure.json cnp   # headless run, prints the metric JSON
```

### Headline results (120 runs, `bench/RESULTS.md`)

| Metric | CNP (decentralised) | Central same-info | Omniscient (upper bound) | Greedy |
|---|---|---|---|---|
| Mean time-to-service | 47.7 min | 47.7 min | 41.5 | **42.5** |
| Critical time-to-service | 25.8 min | **25.0 min** | 21.7 | 40.1 |
| Urgency-weighted TTS | 35.6 | **35.2** | 30.7 | 41.5 |
| Idle while demand open | **21.9 %** | 25.4 % | 27.1 % | 24.7 % |
| Cascade recovery (re-assign all) | **7.1 min** | 12.9 min | 3.2 | 27.4 |
| Decommits per task | 1.30 | 1.86 | 1.36 | **0.34** |
| Contradiction resolution | 29.0 min | **16.1 min** | 13.1 | 21.4 |
| Invariant violations | **0** | **0** | **0** | **0** |

**Honest verdict:** CNP and the same-information central planner are within 1 minute of each other on mean TTS. CNP wins mean TTS in 4 of 6 scenarios (baseline, blackout, contradiction, SOS surge), recovers from cascades almost twice as fast, and churns less. Central wins critical TTS by about 3%, wins fraud-mix (CNP is easier to lure with false reports before verification) and triple-failure, and resolves contradictions faster. Urgency-blind **greedy has the best plain mean TTS** because it serves nearest-first, and the **worst critical TTS** (40 min). Omniscient shows the price of partial information: about 6 min of mean TTS and every route violation.

## Architecture

See `docs/ARCHITECTURE.md` (Mermaid). The short version:

```
packages/engine    sim · beliefs · CNP / Hungarian / greedy · invariants · metrics · replay
packages/dispatch  SOS intake · OTP · rotating pseudonyms · audit chain · rescue→relief summary
packages/relief    campaigns · inventory flow · hash-chained ledger · fraud flags   (never imported by rescue side)
packages/shared    sha256/hmac · hash chain · the ONE contract: AffectedAreaSummary (k ≥ 5)
apps/web           Next.js 15 · Web-Worker engine · Canvas2D map · R3F landing
```

**Firewall:** donations can never influence dispatch. This is enforced by `tests/architecture.test.ts`, an ESLint `no-restricted-imports` rule, separate stores (`.data/dispatch.json` vs `.data/relief.json`), and a priority type with no money fields (`@ts-expect-error` test).

## Docs
`docs/RESEARCH.md` · `docs/ARCHITECTURE.md` · `docs/DECISIONS.md` (D1–D32) · `docs/DEMO.md` (3-minute script) · `docs/LIMITATIONS.md` · `docs/PROGRESS.md`

*Jalnagar is a fictional town. All data is synthetic. No real victims, live feeds or payments.*
