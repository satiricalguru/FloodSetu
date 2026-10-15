# FloodSetu — Flood Rescue Dispatch

> *When the water rises, every second negotiates.*
> Code-E-Manipal 2.0 · Track 06 Multi-Agent Systems / Logistics · **PS 27** · synthetic simulation

FloodSetu treats rescue boats, ground teams, shelters, bridges and SOS clusters as **autonomous agents** with **partial information**. They negotiate with a **Contract-Net auction with leveled commitment**, and the system compares that against a **centralised Hungarian baseline** (same-information and omniscient) plus a greedy floor. All four run on the same seeded, time-stepped engine with **10 explicit safety invariants**, which are checked every tick.

It also includes **Indian earth observation with live data latency**: EOS-04 and NISAR S-band SAR, INSAT-3DS/3DR rainfall nowcasts, and a cloud-blocked Resourcesat-2A. There is a **dam register** whose old dams mark downstream **high-risk zones**, and a tested answer to **"what if the caller's phone drowns?"** (heartbeat watchdog plus invariant 10).

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
| `/sos` | Citizen SOS (guest, 13 languages: English default, Hindi, plus the regional language suggested from your location; offline outbox) |
| `/rescuer` | Rescuer phone (demo: tap a unit, or OTP with `9000000001` → B-1) |
| `/relief` | Public transparency ledger (light mode). Click **Verify ledger** |
| `/admin` | Audit chain, fraud flags, badges, roles |
| `/awareness`, `/design`, `/dev/inbox` | Safety guide (EN/हिं), design tokens, mock SMS inbox |

## Evidence

```bash
pnpm test     # 102 unit/property/architecture/i18n tests (vitest + fast-check)
```
```bash
pnpm bench    # 7 scenarios × 5 seeds × 4 strategies = 140 runs → bench/RESULTS.md
```
```bash
pnpm e2e      # Playwright: guest SOS, live rescuer accept, triple failure, Why?, ledger tamper check
```
```bash
pnpm sim scenarios/triple-failure.json cnp   # headless run, prints the metric JSON
```

### Headline results (`bench/RESULTS.md`)

| Metric | CNP (decentralised) | Central same-info | Omniscient (upper bound) | Greedy |
|---|---|---|---|---|
| Mean time-to-service | 49.6 min | 49.5 min | 41.5 | **45.5** |
| Critical time-to-service | 28.8 | **27.5** | 22.5 | 43.9 |
| People rescued | **64.8 %** | 63.2 % | 68.5 % | 67.7 % |
| Idle while demand open | **22.2 %** | 26.1 % | 26.7 % | 25.4 % |
| Cascade recovery | **10.3 min** | 10.5 min | 2.4 | 27.4 |
| Invariant violations (10 invariants) | **0** | **0** | **0** | **0** |

**Honest verdict (7 scenarios × 5 seeds = 140 runs):** CNP and same-info central are within 0.1 min on mean TTS. CNP wins mean TTS in **4 of 7** scenarios (baseline, blackout, contradiction, triple failure) and rescues slightly more people. Central is about 5% faster on critical cases and wins fraud-mix, SOS surge, and narrowly dam-release. Urgency-blind greedy has the best plain mean but is the slowest on critical cases (43.9 min).

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
`docs/RESEARCH.md` · `docs/ARCHITECTURE.md` · `docs/DECISIONS.md` (D1–D39) · `docs/JUDGE_QA.md` · `docs/DEMO.md` (3-minute script) · `docs/LIMITATIONS.md` · `docs/PROGRESS.md`

*Jalnagar is a fictional town. All data is synthetic. No real victims, live feeds or payments.*
