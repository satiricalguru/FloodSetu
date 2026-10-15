# Benchmark results

_Generated 2026-10-15T17:19:12.251Z · 140 runs · 5 seeds per scenario · `pnpm bench`_

## Verdict (auto-generated, honest)

- Across 7 scenarios × 5 seeds (140 runs), all invariant checks: 0 violations in every run.
- Decentralised CNP wins on: Idle while demand open; Cascade recovery (re-assign all).
- Centralised (same-info) wins on: Urgency-weighted time to service; Critical time to service; Requests past deadline; Contradiction resolution; Plan stabilisation after contradiction.
- Greedy floor wins on: Time to service (mean); Time to service (P90); People rescued; Unmet requests at end; Route violations; Fairness (Jain, nbhd waits); Worst-neighbourhood P90; Decommits per task.
- Critical time-to-service: CNP 28.79 min vs central 27.49 min (5%) vs greedy 43.85 min — central is faster on the most urgent cases; urgency-blind greedy is worst by far, even though it has the best plain mean TTS (it serves nearest-first).
- Why central still wins some scenarios: it solves a global Hungarian assignment every tick over the same fused picture, while CNP settles one (task, bid) pair at a time (a greedy approximation). Where false reports are frequent (fraud-mix) CNP's per-incident auctions are easier to lure before verification.
- Price of partial information: omniscient reaches 41.46 min mean TTS and 0 route violations vs CNP 49.6 min / 5.86 — the gap is what perfect sensing + comms would buy.
- Churn: CNP 1.26 vs central 2 decommits/task — leveled commitment means agents only switch when the gain beats an 8-min penalty; greedy never re-plans (0.34).
- baseline-monsoon: CNP 45.7 vs central 54.32 min mean TTS → CNP better
- blackout: CNP 65.76 vs central 67.68 min mean TTS → CNP better
- contradiction: CNP 26.14 vs central 30.28 min mean TTS → CNP better
- dam-release: CNP 44.8 vs central 44.38 min mean TTS → central better
- fraud-mix: CNP 44.36 vs central 30.92 min mean TTS → central better
- sos-surge: CNP 70.56 vs central 67.62 min mean TTS → central better
- triple-failure: CNP 49.86 vs central 51.58 min mean TTS → CNP better

## Overall means

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) (min) ↓ | 49.6 | 49.54 | 41.46 | 45.53 |
| Time to service (P90) (min) ↓ | 114 | 116.8 | 93.86 | 96.89 |
| Urgency-weighted time to service (min) ↓ | 38.01 | 37.34 | 30.64 | 44.83 |
| Critical time to service (min) ↓ | 28.79 | 27.49 | 22.54 | 43.85 |
| People rescued (%) ↑ | 64.76 | 63.21 | 68.49 | 67.67 |
| Unmet requests at end ↓ | 17.46 | 17.94 | 13.74 | 12.97 |
| Requests past deadline ↓ | 6.2 | 5.83 | 3.94 | 8.74 |
| Idle while demand open (%) ↓ | 22.15 | 26.14 | 26.67 | 25.41 |
| Resource idle time (%) ↓ | 46 | 48.45 | 48.76 | 46.82 |
| Route violations ↓ | 5.86 | 6.2 | 0 | 5.4 |
| Fairness (Jain, nbhd waits) ↑ | 0.88 | 0.85 | 0.9 | 0.89 |
| Fairness (Gini, nbhd waits) ↓ | 0.19 | 0.2 | 0.16 | 0.17 |
| Worst-neighbourhood P90 (min) ↓ | 145.43 | 151.43 | 123.46 | 132.09 |
| Decommits per task ↓ | 1.26 | 2 | 1.41 | 0.34 |
| Contradiction resolution (min) ↓ | 25.6 | 16.08 | 14.46 | 21.38 |
| Plan stabilisation after contradiction (min) ↓ | 2.4 | 2 | 0 | 4 |
| Cascade recovery (re-assign all) (min) ↓ | 10.31 | 10.5 | 2.38 | 27.43 |
| Invariant violations ↓ | 0 | 0 | 0 | 0 |

### baseline-monsoon

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 45.7 ± 3.4 | 54.32 ± 11.68 | 44.98 ± 9.21 | 41.28 ± 4.23 |
| Time to service (P90) | 108.4 ± 9.97 | 132.8 ± 22.15 | 109.2 ± 23.89 | 85.2 ± 17.54 |
| Urgency-weighted time to service | 29.52 ± 2.79 | 35 ± 8.11 | 27.58 ± 5.4 | 38.36 ± 2.57 |
| Critical time to service | 18.26 ± 2.06 | 20.92 ± 3 | 16.74 ± 2.69 | 34.56 ± 4.92 |
| People rescued | 73.45 ± 4.69 | 68 ± 7.89 | 71.19 ± 7.14 | 74.28 ± 4.4 |
| Unmet requests at end | 10.4 ± 3.83 | 16.6 ± 8.33 | 10.6 ± 6.71 | 7.6 ± 1.5 |
| Requests past deadline | 2 ± 1.41 | 4 ± 3.74 | 1 ± 1.26 | 7.8 ± 2.64 |
| Idle while demand open | 20.3 ± 5.99 | 25.32 ± 1.99 | 28.18 ± 4.86 | 27.58 ± 5.04 |
| Resource idle time | 39.1 ± 5.13 | 43.16 ± 2.04 | 46.92 ± 3.18 | 44.82 ± 3.23 |
| Route violations | 7.8 ± 1.72 | 7.6 ± 1.85 | 0 ± 0 | 5 ± 2.83 |
| Fairness (Jain, nbhd waits) | 0.89 ± 0.09 | 0.85 ± 0.14 | 0.93 ± 0.03 | 0.88 ± 0.09 |
| Fairness (Gini, nbhd waits) | 0.17 ± 0.08 | 0.2 ± 0.12 | 0.15 ± 0.04 | 0.18 ± 0.07 |
| Worst-neighbourhood P90 | 172.8 ± 38.78 | 192.6 ± 33.36 | 148.2 ± 33.08 | 153.8 ± 49.69 |
| Decommits per task | 1.19 ± 0.19 | 1.55 ± 0.35 | 1.25 ± 0.19 | 0.32 ± 0.04 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 9 ± 11.31 | 0.25 ± 0.43 | 2 ± 0 | 33.75 ± 21.99 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### blackout

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 65.76 ± 9.93 | 67.68 ± 12.29 | 28.32 ± 7.13 | 63 ± 7.04 |
| Time to service (P90) | 156.2 ± 15.79 | 162.2 ± 12.16 | 60.6 ± 16.86 | 149 ± 9.08 |
| Urgency-weighted time to service | 59.6 ± 8.54 | 61.36 ± 9.65 | 23.84 ± 5.34 | 65.4 ± 6.23 |
| Critical time to service | 53.64 ± 9.38 | 53.52 ± 9.05 | 20.02 ± 4.51 | 68.54 ± 10.52 |
| People rescued | 51.17 ± 2.55 | 47.92 ± 4.35 | 72.06 ± 4.95 | 59.87 ± 5.76 |
| Unmet requests at end | 25.4 ± 5.75 | 26.2 ± 6.34 | 8.4 ± 2.73 | 15.2 ± 2.86 |
| Requests past deadline | 13.6 ± 4.67 | 14.2 ± 4.83 | 2 ± 1.41 | 13.2 ± 4.02 |
| Idle while demand open | 33.5 ± 4.62 | 38.38 ± 4.37 | 35.66 ± 2.99 | 36.44 ± 4.32 |
| Resource idle time | 61.48 ± 3.87 | 63.56 ± 2.17 | 56.06 ± 5.18 | 58.9 ± 5.44 |
| Route violations | 6.6 ± 1.85 | 5 ± 2.19 | 0 ± 0 | 5 ± 2.19 |
| Fairness (Jain, nbhd waits) | 0.77 ± 0.13 | 0.76 ± 0.13 | 0.95 ± 0.04 | 0.77 ± 0.06 |
| Fairness (Gini, nbhd waits) | 0.28 ± 0.09 | 0.28 ± 0.09 | 0.1 ± 0.06 | 0.27 ± 0.05 |
| Worst-neighbourhood P90 | 175 ± 14.68 | 176 ± 10.79 | 83.4 ± 33.91 | 168.6 ± 9.22 |
| Decommits per task | 1.07 ± 0.29 | 1.06 ± 0.41 | 0.98 ± 0.38 | 0.33 ± 0.05 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 1 ± 0 | 0 ± 0 | 0 ± 0 | 1 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### contradiction

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 26.14 ± 6.12 | 30.28 ± 4.6 | 26.24 ± 5.55 | 36.48 ± 6.59 |
| Time to service (P90) | 54.6 ± 18.53 | 68.8 ± 16.33 | 55.4 ± 16.64 | 69.2 ± 15.16 |
| Urgency-weighted time to service | 20.88 ± 4.62 | 22.42 ± 3.52 | 19.74 ± 3.65 | 33.44 ± 5.78 |
| Critical time to service | 16.7 ± 3.19 | 16.52 ± 2.12 | 15.28 ± 2.51 | 29 ± 5.54 |
| People rescued | 67.15 ± 3.15 | 63.38 ± 4.25 | 66.97 ± 4.76 | 64.24 ± 3.69 |
| Unmet requests at end | 11 ± 4.69 | 12.6 ± 3.72 | 11 ± 5.55 | 14 ± 4.9 |
| Requests past deadline | 1 ± 0.63 | 0.6 ± 0.49 | 0.2 ± 0.4 | 3 ± 2.76 |
| Idle while demand open | 24.08 ± 4.45 | 24.46 ± 3.7 | 27.22 ± 4.47 | 26.28 ± 3.38 |
| Resource idle time | 50.86 ± 6.63 | 49.96 ± 5.83 | 54.16 ± 6.93 | 48.12 ± 2.86 |
| Route violations | 6.8 ± 1.33 | 7.2 ± 0.75 | 0 ± 0 | 6.6 ± 3.67 |
| Fairness (Jain, nbhd waits) | 0.79 ± 0.11 | 0.82 ± 0.12 | 0.82 ± 0.14 | 0.9 ± 0.03 |
| Fairness (Gini, nbhd waits) | 0.27 ± 0.08 | 0.23 ± 0.09 | 0.23 ± 0.1 | 0.17 ± 0.03 |
| Worst-neighbourhood P90 | 88 ± 35.61 | 106.2 ± 27.59 | 96.8 ± 37.7 | 97.8 ± 23.46 |
| Decommits per task | 0.88 ± 0.27 | 1.34 ± 0.21 | 0.68 ± 0.29 | 0.35 ± 0.07 |
| Contradiction resolution | 25.6 ± 17.57 | 16.08 ± 7.77 | 14.46 ± 12.01 | 21.38 ± 5.53 |
| Plan stabilisation after contradiction | 2.4 ± 4.8 | 2 ± 4 | 0 ± 0 | 4 ± 5.15 |
| Cascade recovery (re-assign all) | 12 ± 10.89 | 32.83 ± 35.96 | 0 ± 0 | 52 ± 21.4 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### dam-release

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 44.8 ± 8.85 | 44.38 ± 10.49 | 40.5 ± 9.31 | 42.32 ± 2.02 |
| Time to service (P90) | 99.6 ± 16.99 | 108.2 ± 28.65 | 93 ± 22.81 | 81.6 ± 6.25 |
| Urgency-weighted time to service | 32.1 ± 3.38 | 30.14 ± 6.82 | 29.16 ± 5.5 | 41.62 ± 1.77 |
| Critical time to service | 24.14 ± 1.79 | 21.54 ± 4.33 | 23.5 ± 5.73 | 40.86 ± 2.45 |
| People rescued | 66.25 ± 4 | 66.13 ± 8.62 | 70.49 ± 7.46 | 67.45 ± 3.19 |
| Unmet requests at end | 19.8 ± 3.12 | 19.2 ± 6.01 | 14.6 ± 6.53 | 14.8 ± 3.06 |
| Requests past deadline | 3.6 ± 1.62 | 2.8 ± 2.64 | 3.4 ± 2.33 | 10.6 ± 1.85 |
| Idle while demand open | 22.9 ± 5.39 | 26.58 ± 7.41 | 25.14 ± 5.6 | 24.02 ± 8.69 |
| Resource idle time | 42.42 ± 4.07 | 44.9 ± 4.81 | 43.34 ± 3.27 | 43.16 ± 8.6 |
| Route violations | 5.6 ± 2.33 | 5.6 ± 1.85 | 0 ± 0 | 5.6 ± 1.36 |
| Fairness (Jain, nbhd waits) | 0.91 ± 0.05 | 0.85 ± 0.14 | 0.92 ± 0.04 | 0.92 ± 0.04 |
| Fairness (Gini, nbhd waits) | 0.16 ± 0.05 | 0.2 ± 0.12 | 0.15 ± 0.05 | 0.15 ± 0.05 |
| Worst-neighbourhood P90 | 120.4 ± 19.06 | 155.2 ± 28.7 | 126.6 ± 30.31 | 115 ± 12.41 |
| Decommits per task | 1.45 ± 0.48 | 3.26 ± 1.88 | 1.21 ± 0.24 | 0.31 ± 0.04 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### fraud-mix

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 44.36 ± 11.97 | 30.92 ± 6.1 | 28 ± 5.51 | 35.5 ± 4.18 |
| Time to service (P90) | 114.6 ± 23.79 | 79.4 ± 21.32 | 63.6 ± 14.73 | 72.8 ± 13.67 |
| Urgency-weighted time to service | 31.44 ± 6.23 | 22.64 ± 5.27 | 21.7 ± 4.27 | 35 ± 5.27 |
| Critical time to service | 22.18 ± 4.44 | 16.38 ± 3.07 | 17 ± 3.63 | 34.68 ± 6.55 |
| People rescued | 63.88 ± 15.7 | 67.83 ± 6.05 | 70.83 ± 6.16 | 73.82 ± 3.71 |
| Unmet requests at end | 15.2 ± 7.47 | 11.2 ± 4.02 | 9 ± 1.67 | 7.2 ± 2.14 |
| Requests past deadline | 2.4 ± 2.24 | 1 ± 2 | 0.6 ± 0.8 | 3.6 ± 2.42 |
| Idle while demand open | 23.68 ± 5.32 | 24.66 ± 6.52 | 28.36 ± 7.32 | 26.68 ± 6.23 |
| Resource idle time | 49.6 ± 1.72 | 50.16 ± 2.88 | 55.4 ± 4.93 | 51.34 ± 1.86 |
| Route violations | 5.6 ± 1.02 | 5 ± 2.28 | 0 ± 0 | 3.6 ± 1.74 |
| Fairness (Jain, nbhd waits) | 0.97 ± 0.01 | 0.94 ± 0.04 | 0.94 ± 0.03 | 0.97 ± 0.02 |
| Fairness (Gini, nbhd waits) | 0.09 ± 0.01 | 0.13 ± 0.05 | 0.13 ± 0.04 | 0.09 ± 0.03 |
| Worst-neighbourhood P90 | 131.2 ± 33.13 | 106.2 ± 21.33 | 79.6 ± 19.41 | 102.2 ± 24.6 |
| Decommits per task | 1.39 ± 0.36 | 1.65 ± 0.25 | 0.96 ± 0.17 | 0.43 ± 0.07 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### sos-surge

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 70.56 ± 14.61 | 67.62 ± 10.89 | 68.88 ± 12.12 | 54.86 ± 6.34 |
| Time to service (P90) | 162.8 ± 27.74 | 154.4 ± 27.52 | 155.2 ± 28.83 | 124 ± 17.17 |
| Urgency-weighted time to service | 56.44 ± 13.04 | 53.16 ± 9.13 | 54.94 ± 10.58 | 55.08 ± 6.02 |
| Critical time to service | 43.08 ± 12.5 | 39.22 ± 7.1 | 41.8 ± 9.39 | 53.72 ± 6.69 |
| People rescued | 68.03 ± 6.06 | 68.36 ± 7.35 | 67.86 ± 7.05 | 69.01 ± 4.55 |
| Unmet requests at end | 17.8 ± 6.91 | 17 ± 6.39 | 16.6 ± 6.09 | 14.2 ± 2.86 |
| Requests past deadline | 16.2 ± 6.08 | 14.8 ± 6.11 | 16 ± 5.62 | 13.2 ± 2.79 |
| Idle while demand open | 15.06 ± 4.77 | 19.52 ± 3.59 | 18.62 ± 3 | 15.84 ± 5.71 |
| Resource idle time | 41.5 ± 6.46 | 44.28 ± 3.44 | 43.32 ± 5.34 | 40.1 ± 6.19 |
| Route violations | 3.8 ± 0.75 | 5.8 ± 0.75 | 0 ± 0 | 6.2 ± 2.93 |
| Fairness (Jain, nbhd waits) | 0.93 ± 0.06 | 0.9 ± 0.04 | 0.9 ± 0.04 | 0.88 ± 0.06 |
| Fairness (Gini, nbhd waits) | 0.13 ± 0.08 | 0.17 ± 0.05 | 0.17 ± 0.03 | 0.18 ± 0.05 |
| Worst-neighbourhood P90 | 183.4 ± 26.69 | 174.2 ± 28.39 | 175.2 ± 20.31 | 166.4 ± 35.86 |
| Decommits per task | 1.31 ± 0.35 | 3.13 ± 0.77 | 3.06 ± 1.14 | 0.28 ± 0.11 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### triple-failure

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 49.86 ± 8.23 | 51.58 ± 8.07 | 53.32 ± 6.28 | 45.3 ± 4.94 |
| Time to service (P90) | 101.8 ± 19.7 | 111.8 ± 18.62 | 120 ± 12.31 | 96.4 ± 9.52 |
| Urgency-weighted time to service | 36.12 ± 8.69 | 36.68 ± 5.76 | 37.5 ± 5.2 | 44.88 ± 5.4 |
| Critical time to service | 23.54 ± 7.61 | 24.32 ± 6.07 | 23.42 ± 5.26 | 45.62 ± 7.02 |
| People rescued | 63.37 ± 7.62 | 60.83 ± 2.2 | 60.06 ± 3.74 | 65.05 ± 4.31 |
| Unmet requests at end | 22.6 ± 8.16 | 22.8 ± 3.87 | 26 ± 4.6 | 17.8 ± 4.79 |
| Requests past deadline | 4.6 ± 3.83 | 3.4 ± 2.15 | 4.4 ± 2.15 | 9.8 ± 2.14 |
| Idle while demand open | 15.52 ± 6.51 | 24.06 ± 3.63 | 23.54 ± 2.96 | 21.06 ± 4.52 |
| Resource idle time | 37.02 ± 8.15 | 43.12 ± 4.54 | 42.14 ± 4.38 | 41.28 ± 5.09 |
| Route violations | 4.8 ± 2.23 | 7.2 ± 3.66 | 0 ± 0 | 5.8 ± 2.14 |
| Fairness (Jain, nbhd waits) | 0.87 ± 0.08 | 0.85 ± 0.07 | 0.83 ± 0.08 | 0.93 ± 0.04 |
| Fairness (Gini, nbhd waits) | 0.2 ± 0.07 | 0.22 ± 0.07 | 0.23 ± 0.07 | 0.14 ± 0.04 |
| Worst-neighbourhood P90 | 147.2 ± 31.44 | 149.6 ± 35.72 | 154.4 ± 25.06 | 120.8 ± 16.19 |
| Decommits per task | 1.54 ± 0.59 | 1.98 ± 0.39 | 1.76 ± 0.46 | 0.35 ± 0.15 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 11.6 ± 15.55 | 5.33 ± 6.85 | 4.25 ± 4.32 | 22.5 ± 23.2 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
