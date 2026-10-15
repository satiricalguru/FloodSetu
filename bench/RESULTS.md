# Benchmark results

_Generated 2026-10-15T22:11:41.739Z · 140 runs · 5 seeds per scenario · `pnpm bench`_

## Verdict (auto-generated, honest)

- Across 7 scenarios × 5 seeds (140 runs), all invariant checks: 0 violations in every run.
- Decentralised CNP wins on: Requests past deadline; Idle while demand open; Contradiction resolution; Plan stabilisation after contradiction; Cascade recovery (re-assign all).
- Centralised (same-info) wins on: Urgency-weighted time to service; Critical time to service; Route violations.
- Greedy floor wins on: Time to service (mean); Time to service (P90); People rescued; Unmet requests at end; Worst-neighbourhood P90; Decommits per task.
- Critical time-to-service: CNP 27.68 min vs central 27.3 min (1%) vs greedy 41.7 min — central is faster on the most urgent cases; urgency-blind greedy is worst by far, even though it has the best plain mean TTS (it serves nearest-first).
- Why central still wins some scenarios: it solves a global Hungarian assignment every tick over the same fused picture, while CNP settles one (task, bid) pair at a time (a greedy approximation). Where false reports are frequent (fraud-mix) CNP's per-incident auctions are easier to lure before verification.
- Price of partial information: omniscient reaches 37.03 min mean TTS and 0 route violations vs CNP 47.16 min / 6.6 — the gap is what perfect sensing + comms would buy.
- Churn: CNP 1.35 vs central 2 decommits/task — leveled commitment means agents only switch when the gain beats an 8-min penalty; greedy never re-plans (0.39).
- baseline-monsoon: CNP 43.08 vs central 52.1 min mean TTS → CNP better
- blackout: CNP 68.84 vs central 65.46 min mean TTS → central better
- contradiction: CNP 28.18 vs central 26.84 min mean TTS → central better
- dam-release: CNP 41.76 vs central 42.48 min mean TTS → CNP better
- fraud-mix: CNP 34.18 vs central 33.36 min mean TTS → central better
- sos-surge: CNP 71.5 vs central 73.08 min mean TTS → CNP better
- triple-failure: CNP 42.6 vs central 42.76 min mean TTS → CNP better

## Overall means

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) (min) ↓ | 47.16 | 48.01 | 37.03 | 42.59 |
| Time to service (P90) (min) ↓ | 112.57 | 113.54 | 87.06 | 92.49 |
| Urgency-weighted time to service (min) ↓ | 36.26 | 36.19 | 27.21 | 42.05 |
| Critical time to service (min) ↓ | 27.68 | 27.3 | 20.52 | 41.7 |
| People rescued (%) ↑ | 65.01 | 62.85 | 67.46 | 66.4 |
| Unmet requests at end ↓ | 15.89 | 17.57 | 12.17 | 12.29 |
| Requests past deadline ↓ | 5.74 | 5.83 | 2.97 | 7.34 |
| Idle while demand open (%) ↓ | 25.77 | 29.54 | 29.62 | 26.99 |
| Resource idle time (%) ↓ | 50.2 | 52.61 | 53.31 | 49.16 |
| Route violations ↓ | 6.6 | 5.83 | 0 | 6.57 |
| Fairness (Jain, nbhd waits) ↑ | 0.89 | 0.87 | 0.91 | 0.89 |
| Fairness (Gini, nbhd waits) ↓ | 0.18 | 0.19 | 0.15 | 0.17 |
| Worst-neighbourhood P90 (min) ↓ | 143.11 | 143.49 | 117.34 | 118.51 |
| Decommits per task ↓ | 1.35 | 2 | 1.25 | 0.39 |
| Contradiction resolution (min) ↓ | 13.48 | 46.94 | 10.84 | 61 |
| Plan stabilisation after contradiction (min) ↓ | 0 | 1.1 | 0 | 2.2 |
| Cascade recovery (re-assign all) (min) ↓ | 3.11 | 13.9 | 6.5 | 21.31 |
| Invariant violations ↓ | 0 | 0 | 0 | 0 |

### baseline-monsoon

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 43.08 ± 5.81 | 52.1 ± 5.86 | 42.6 ± 11.39 | 42.06 ± 3.72 |
| Time to service (P90) | 100.6 ± 14.75 | 130.8 ± 15.52 | 112.2 ± 35.68 | 81.8 ± 8.93 |
| Urgency-weighted time to service | 28.56 ± 3.65 | 33.24 ± 4.84 | 27.34 ± 7.09 | 42.34 ± 4.38 |
| Critical time to service | 18.24 ± 1.89 | 19.82 ± 2.2 | 16.72 ± 2.79 | 43.46 ± 6.01 |
| People rescued | 70.65 ± 3.49 | 65.93 ± 4.3 | 70.32 ± 3.42 | 73.97 ± 5.07 |
| Unmet requests at end | 13 ± 5.55 | 15.4 ± 4.18 | 11 ± 0.89 | 9 ± 1.41 |
| Requests past deadline | 1.6 ± 1.36 | 3.6 ± 2.06 | 2.2 ± 2.4 | 10 ± 3.03 |
| Idle while demand open | 17.4 ± 3.91 | 24.3 ± 5.94 | 22.18 ± 7.03 | 26.42 ± 3.24 |
| Resource idle time | 39.02 ± 5.59 | 44.64 ± 4.56 | 44.68 ± 3.51 | 43.28 ± 4.44 |
| Route violations | 8 ± 2.61 | 6 ± 0.63 | 0 ± 0 | 6.2 ± 2.32 |
| Fairness (Jain, nbhd waits) | 0.95 ± 0.01 | 0.91 ± 0.04 | 0.95 ± 0.04 | 0.9 ± 0.07 |
| Fairness (Gini, nbhd waits) | 0.12 ± 0.02 | 0.16 ± 0.04 | 0.11 ± 0.05 | 0.16 ± 0.07 |
| Worst-neighbourhood P90 | 132.2 ± 37.33 | 169 ± 25.75 | 137.6 ± 34.2 | 138.6 ± 47.53 |
| Decommits per task | 1.19 ± 0.32 | 2.15 ± 1.15 | 1.24 ± 0.17 | 0.33 ± 0.11 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 1 ± 0 | 14.7 ± 12.2 | 1 ± 0 | 33 ± 32.19 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### blackout

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 68.84 ± 8.36 | 65.46 ± 10.83 | 25.2 ± 6.14 | 61.92 ± 9.39 |
| Time to service (P90) | 163.8 ± 16.61 | 158.4 ± 16.08 | 55.4 ± 19.09 | 156.8 ± 15 |
| Urgency-weighted time to service | 61 ± 11.55 | 58.82 ± 10.84 | 22.22 ± 4.31 | 64.12 ± 9.2 |
| Critical time to service | 52.34 ± 16.93 | 51.02 ± 13.63 | 20.42 ± 5.1 | 65.54 ± 11.97 |
| People rescued | 47.85 ± 7.61 | 51.84 ± 3.84 | 68.72 ± 4.16 | 51.73 ± 11.53 |
| Unmet requests at end | 25 ± 3.58 | 23.4 ± 5.75 | 8.4 ± 4.59 | 16.6 ± 4.32 |
| Requests past deadline | 12.6 ± 5.31 | 12.2 ± 6.27 | 1.2 ± 0.4 | 12.8 ± 5.31 |
| Idle while demand open | 36 ± 6.71 | 39.28 ± 6.41 | 40.86 ± 5.17 | 33.02 ± 5.52 |
| Resource idle time | 62.04 ± 6.03 | 63.78 ± 5.61 | 60 ± 7.45 | 58.88 ± 5.41 |
| Route violations | 6.6 ± 2.87 | 5 ± 3.63 | 0 ± 0 | 3.6 ± 2.06 |
| Fairness (Jain, nbhd waits) | 0.78 ± 0.16 | 0.72 ± 0.1 | 0.86 ± 0.17 | 0.72 ± 0.06 |
| Fairness (Gini, nbhd waits) | 0.26 ± 0.12 | 0.31 ± 0.07 | 0.17 ± 0.14 | 0.31 ± 0.04 |
| Worst-neighbourhood P90 | 180.4 ± 14.37 | 177 ± 10.37 | 100.8 ± 48.97 | 181 ± 9.06 |
| Decommits per task | 1.57 ± 0.84 | 1.1 ± 0.43 | 0.89 ± 0.36 | 0.28 ± 0.06 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 1 ± 0 | 1 ± 0 | 0 ± 0 | 11.67 ± 15.08 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### contradiction

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 28.18 ± 10.32 | 26.84 ± 11.13 | 25.36 ± 9.96 | 33.3 ± 3.68 |
| Time to service (P90) | 71 ± 30.32 | 62 ± 32.11 | 60.8 ± 39.22 | 64 ± 10.33 |
| Urgency-weighted time to service | 22.86 ± 5.7 | 21.16 ± 6.09 | 20.34 ± 4.25 | 31.46 ± 4.43 |
| Critical time to service | 20.4 ± 4.27 | 17.98 ± 4.05 | 18.08 ± 2.84 | 30.24 ± 5.32 |
| People rescued | 69.24 ± 3.14 | 67.47 ± 3.9 | 68.82 ± 5.78 | 68.33 ± 3.37 |
| Unmet requests at end | 8.8 ± 2.93 | 10 ± 4.77 | 7.6 ± 3.93 | 10.4 ± 3.2 |
| Requests past deadline | 1.6 ± 1.2 | 1.4 ± 1.2 | 0.8 ± 0.75 | 3.8 ± 1.94 |
| Idle while demand open | 30.26 ± 7.68 | 31.66 ± 5.98 | 32.98 ± 5.68 | 26.74 ± 8.31 |
| Resource idle time | 59.36 ± 11.41 | 59.5 ± 10.29 | 60.32 ± 11.02 | 49.54 ± 9.46 |
| Route violations | 4.8 ± 2.23 | 5 ± 3.41 | 0 ± 0 | 7.6 ± 4.59 |
| Fairness (Jain, nbhd waits) | 0.91 ± 0.05 | 0.91 ± 0.03 | 0.89 ± 0.06 | 0.94 ± 0.06 |
| Fairness (Gini, nbhd waits) | 0.17 ± 0.06 | 0.17 ± 0.03 | 0.17 ± 0.07 | 0.12 ± 0.07 |
| Worst-neighbourhood P90 | 93.2 ± 31.07 | 89.8 ± 29 | 69.4 ± 42.42 | 78.4 ± 10.59 |
| Decommits per task | 0.8 ± 0.24 | 1.36 ± 0.46 | 0.71 ± 0.31 | 0.42 ± 0.11 |
| Contradiction resolution | 13.48 ± 7.89 | 46.94 ± 69.66 | 10.84 ± 3.9 | 61 ± 55.49 |
| Plan stabilisation after contradiction | 0 ± 0 | 1.1 ± 2.2 | 0 ± 0 | 2.2 ± 4.4 |
| Cascade recovery (re-assign all) | 5.5 ± 4.5 | 40.65 ± 37.35 | 0 ± 0 | 36.67 ± 21.64 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### dam-release

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 41.76 ± 4.48 | 42.48 ± 2.76 | 36.42 ± 4.47 | 37.56 ± 3.99 |
| Time to service (P90) | 98.8 ± 10.57 | 103 ± 6.78 | 84 ± 17.32 | 73.4 ± 9.81 |
| Urgency-weighted time to service | 28.96 ± 1.53 | 30.06 ± 3.41 | 25.74 ± 3.99 | 35.02 ± 3.53 |
| Critical time to service | 20.54 ± 3.3 | 21.52 ± 6.92 | 19.38 ± 5.47 | 32.3 ± 3.23 |
| People rescued | 64.71 ± 3.78 | 64.42 ± 6.4 | 65.87 ± 5.44 | 68.08 ± 4.81 |
| Unmet requests at end | 17.4 ± 3.32 | 18.2 ± 5.49 | 14.4 ± 5.68 | 11 ± 3.85 |
| Requests past deadline | 2.2 ± 1.47 | 3.2 ± 1.94 | 1.8 ± 2.14 | 5.8 ± 1.6 |
| Idle while demand open | 33.48 ± 7.77 | 37.18 ± 7.13 | 37.62 ± 7.36 | 29.78 ± 7.9 |
| Resource idle time | 53.58 ± 9.1 | 56.32 ± 7.94 | 56.6 ± 7.72 | 54.1 ± 6.18 |
| Route violations | 10.8 ± 2.99 | 7.2 ± 2.23 | 0 ± 0 | 9 ± 2.76 |
| Fairness (Jain, nbhd waits) | 0.88 ± 0.06 | 0.86 ± 0.06 | 0.91 ± 0.03 | 0.94 ± 0.03 |
| Fairness (Gini, nbhd waits) | 0.18 ± 0.04 | 0.21 ± 0.04 | 0.16 ± 0.03 | 0.14 ± 0.04 |
| Worst-neighbourhood P90 | 152.2 ± 25.24 | 138.6 ± 16.04 | 118.8 ± 25.69 | 91 ± 12.21 |
| Decommits per task | 1.33 ± 0.17 | 2.54 ± 1.28 | 1.07 ± 0.16 | 0.44 ± 0.08 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### fraud-mix

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 34.18 ± 9.72 | 33.36 ± 8.16 | 23.4 ± 4.34 | 33.26 ± 1.86 |
| Time to service (P90) | 87.8 ± 31.52 | 79.6 ± 25.96 | 51.8 ± 16.23 | 61 ± 6.07 |
| Urgency-weighted time to service | 25.32 ± 5.64 | 24.58 ± 5.27 | 17.74 ± 2.25 | 30.34 ± 2.3 |
| Critical time to service | 18.58 ± 1.82 | 19.92 ± 4.12 | 14.74 ± 1.68 | 27.98 ± 2.71 |
| People rescued | 71.07 ± 3.52 | 69.8 ± 2.5 | 73.23 ± 1.77 | 74.88 ± 6.05 |
| Unmet requests at end | 10 ± 4.2 | 10 ± 4.38 | 5.2 ± 2.4 | 7.6 ± 1.36 |
| Requests past deadline | 1.4 ± 1.2 | 1 ± 1.55 | 0 ± 0 | 2.2 ± 1.6 |
| Idle while demand open | 26.74 ± 5.18 | 27.76 ± 4.06 | 25.42 ± 8 | 28.92 ± 3.26 |
| Resource idle time | 53.76 ± 4.06 | 53.34 ± 4.48 | 58.54 ± 5.18 | 52.24 ± 3.08 |
| Route violations | 5 ± 2 | 4 ± 2.1 | 0 ± 0 | 5.4 ± 1.36 |
| Fairness (Jain, nbhd waits) | 0.88 ± 0.08 | 0.89 ± 0.07 | 0.9 ± 0.07 | 0.87 ± 0.13 |
| Fairness (Gini, nbhd waits) | 0.18 ± 0.07 | 0.18 ± 0.05 | 0.16 ± 0.06 | 0.18 ± 0.09 |
| Worst-neighbourhood P90 | 109 ± 27.2 | 101.2 ± 33.88 | 79 ± 19.69 | 92.4 ± 18.64 |
| Decommits per task | 1.18 ± 0.38 | 1.9 ± 0.48 | 0.89 ± 0.29 | 0.46 ± 0.07 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### sos-surge

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 71.5 ± 7.07 | 73.08 ± 5.75 | 65.5 ± 9.76 | 50.78 ± 7.8 |
| Time to service (P90) | 171.6 ± 22.31 | 165.4 ± 14.36 | 152.8 ± 21.35 | 130 ± 33 |
| Urgency-weighted time to service | 55.46 ± 7.26 | 54.72 ± 5.32 | 49.64 ± 7.68 | 53.54 ± 9.28 |
| Critical time to service | 39.64 ± 5.14 | 38.28 ± 4.23 | 35.62 ± 5.68 | 56.02 ± 11.86 |
| People rescued | 67.88 ± 3.99 | 64.79 ± 4.64 | 64.71 ± 3.84 | 66.14 ± 3.61 |
| Unmet requests at end | 17.4 ± 4.84 | 20.6 ± 4.54 | 17.2 ± 5.84 | 13.4 ± 3.26 |
| Requests past deadline | 16.2 ± 5.56 | 16 ± 4.2 | 13.2 ± 6.14 | 10.6 ± 1.02 |
| Idle while demand open | 19.02 ± 3.18 | 22.44 ± 5.73 | 20.5 ± 3.06 | 23.38 ± 5.04 |
| Resource idle time | 45.16 ± 4.95 | 45.58 ± 4.39 | 44.62 ± 5.84 | 45.5 ± 5.54 |
| Route violations | 5 ± 0.89 | 7 ± 1.41 | 0 ± 0 | 6.2 ± 2.32 |
| Fairness (Jain, nbhd waits) | 0.93 ± 0.05 | 0.94 ± 0.07 | 0.9 ± 0.07 | 0.9 ± 0.06 |
| Fairness (Gini, nbhd waits) | 0.14 ± 0.06 | 0.12 ± 0.08 | 0.16 ± 0.07 | 0.17 ± 0.06 |
| Worst-neighbourhood P90 | 183.4 ± 18.77 | 188.6 ± 7.26 | 177.4 ± 18.06 | 152.8 ± 31.07 |
| Decommits per task | 2.09 ± 0.6 | 3.29 ± 0.44 | 2.54 ± 0.3 | 0.39 ± 0.06 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### triple-failure

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 42.6 ± 11.27 | 42.76 ± 15 | 40.76 ± 9.7 | 39.26 ± 6.94 |
| Time to service (P90) | 94.4 ± 24.68 | 95.6 ± 32.82 | 92.4 ± 16.38 | 80.4 ± 17.05 |
| Urgency-weighted time to service | 31.64 ± 9.03 | 30.78 ± 11.95 | 27.42 ± 8.35 | 37.5 ± 5.95 |
| Critical time to service | 24.02 ± 5.59 | 22.54 ± 8.16 | 18.68 ± 5.38 | 36.38 ± 6.1 |
| People rescued | 63.7 ± 7.46 | 55.67 ± 10.78 | 60.54 ± 8.48 | 61.69 ± 8.33 |
| Unmet requests at end | 19.6 ± 9.09 | 25.4 ± 11.79 | 21.4 ± 8.33 | 18 ± 6.1 |
| Requests past deadline | 4.6 ± 3.83 | 3.4 ± 3.56 | 1.6 ± 2.24 | 6.2 ± 2.71 |
| Idle while demand open | 17.48 ± 5.68 | 24.14 ± 3.73 | 27.78 ± 4.54 | 20.66 ± 5.46 |
| Resource idle time | 38.46 ± 8.52 | 45.14 ± 5.95 | 48.42 ± 4.53 | 40.56 ± 5.91 |
| Route violations | 6 ± 3.35 | 6.6 ± 2.58 | 0 ± 0 | 8 ± 1.79 |
| Fairness (Jain, nbhd waits) | 0.89 ± 0.05 | 0.89 ± 0.07 | 0.93 ± 0.05 | 0.96 ± 0.03 |
| Fairness (Gini, nbhd waits) | 0.18 ± 0.04 | 0.18 ± 0.07 | 0.15 ± 0.05 | 0.1 ± 0.05 |
| Worst-neighbourhood P90 | 151.4 ± 14.26 | 140.2 ± 42.56 | 138.4 ± 23.28 | 95.4 ± 18.76 |
| Decommits per task | 1.27 ± 0.28 | 1.67 ± 0.45 | 1.41 ± 0.27 | 0.4 ± 0.1 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 4.33 ± 6.13 | 2.75 ± 4.21 | 10 ± 14.09 | 0 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
