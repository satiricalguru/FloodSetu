# Benchmark results

_Generated 2026-10-15T15:48:46.977Z · 120 runs · 5 seeds per scenario · `pnpm bench`_

## Verdict (auto-generated, honest)

- Across 6 scenarios × 5 seeds (120 runs), all invariant checks: 0 violations in every run.
- Decentralised CNP wins on: Idle while demand open; Cascade recovery (re-assign all).
- Centralised (same-info) wins on: Urgency-weighted time to service; Critical time to service; Requests past deadline; Contradiction resolution; Plan stabilisation after contradiction.
- Greedy floor wins on: Time to service (mean); Time to service (P90); People rescued; Unmet requests at end; Route violations; Fairness (Jain, nbhd waits); Worst-neighbourhood P90; Decommits per task.
- Critical time-to-service: CNP 25.81 min vs central 24.99 min (3%) vs greedy 40.1 min — central is faster on the most urgent cases; urgency-blind greedy is worst by far, even though it has the best plain mean TTS (it serves nearest-first).
- Why central still wins some scenarios: it solves a global Hungarian assignment every tick over the same fused picture, while CNP settles one (task, bid) pair at a time (a greedy approximation). Where false reports are frequent (fraud-mix) CNP's per-incident auctions are easier to lure before verification.
- Price of partial information: omniscient reaches 41.46 min mean TTS and 0 route violations vs CNP 47.71 min / 5.53 — the gap is what perfect sensing + comms would buy.
- Churn: CNP 1.3 vs central 1.86 decommits/task — leveled commitment means agents only switch when the gain beats an 8-min penalty; greedy never re-plans (0.34).
- baseline-monsoon: CNP 47.26 vs central 52.88 min mean TTS → CNP better
- blackout: CNP 46.16 vs central 47.9 min mean TTS → CNP better
- contradiction: CNP 26.58 vs central 29.86 min mean TTS → CNP better
- fraud-mix: CNP 44.9 vs central 31.98 min mean TTS → central better
- sos-surge: CNP 68.14 vs central 71.4 min mean TTS → CNP better
- triple-failure: CNP 53.24 vs central 52.06 min mean TTS → central better

## Overall means

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) (min) ↓ | 47.71 | 47.68 | 41.46 | 42.5 |
| Time to service (P90) (min) ↓ | 110.77 | 106.33 | 93.13 | 87.77 |
| Urgency-weighted time to service (min) ↓ | 35.63 | 35.16 | 30.7 | 41.5 |
| Critical time to service (min) ↓ | 25.81 | 24.99 | 21.71 | 40.1 |
| People rescued (%) ↑ | 66.87 | 66.3 | 68.48 | 69.69 |
| Unmet requests at end ↓ | 15.6 | 15.3 | 13.5 | 11.57 |
| Requests past deadline ↓ | 5.07 | 4.77 | 3.87 | 7.27 |
| Idle while demand open (%) ↓ | 21.93 | 25.43 | 27.07 | 24.74 |
| Resource idle time (%) ↓ | 45.94 | 47.9 | 49.8 | 46.67 |
| Route violations ↓ | 5.53 | 5.93 | 0 | 5.17 |
| Fairness (Jain, nbhd waits) ↑ | 0.91 | 0.89 | 0.9 | 0.92 |
| Fairness (Gini, nbhd waits) ↓ | 0.15 | 0.18 | 0.16 | 0.15 |
| Worst-neighbourhood P90 (min) ↓ | 141.57 | 141.23 | 121.77 | 118.53 |
| Decommits per task ↓ | 1.3 | 1.86 | 1.36 | 0.34 |
| Contradiction resolution (min) ↓ | 29 | 16.08 | 13.14 | 21.38 |
| Plan stabilisation after contradiction (min) ↓ | 2.4 | 2 | 0 | 4 |
| Cascade recovery (re-assign all) (min) ↓ | 7.09 | 12.85 | 3.2 | 27.43 |
| Invariant violations ↓ | 0 | 0 | 0 | 0 |

### baseline-monsoon

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 47.26 ± 5.57 | 52.88 ± 9.82 | 46.44 ± 5.09 | 40.48 ± 4.37 |
| Time to service (P90) | 108.2 ± 12.46 | 128.6 ± 18.83 | 107 ± 10.37 | 80.4 ± 10.78 |
| Urgency-weighted time to service | 30.36 ± 4.08 | 33.14 ± 6.89 | 29.06 ± 4.15 | 37.88 ± 2.52 |
| Critical time to service | 18.52 ± 2.09 | 19.42 ± 2.95 | 17.12 ± 2.57 | 35 ± 4.99 |
| People rescued | 72.61 ± 3.71 | 69.07 ± 4.71 | 71.11 ± 6.78 | 74.34 ± 4.88 |
| Unmet requests at end | 10 ± 2.9 | 14 ± 5.51 | 11 ± 5.18 | 7.2 ± 2.14 |
| Requests past deadline | 1.6 ± 1.5 | 1.8 ± 2.64 | 1.4 ± 1.5 | 7.2 ± 2.99 |
| Idle while demand open | 17.98 ± 4.47 | 25.9 ± 1.83 | 27.24 ± 4.93 | 25.08 ± 4.39 |
| Resource idle time | 37.7 ± 5.31 | 43.66 ± 1.44 | 45.98 ± 3.66 | 44.4 ± 3.22 |
| Route violations | 7.8 ± 1.47 | 7.4 ± 1.02 | 0 ± 0 | 5 ± 2.83 |
| Fairness (Jain, nbhd waits) | 0.91 ± 0.09 | 0.89 ± 0.08 | 0.92 ± 0.05 | 0.91 ± 0.05 |
| Fairness (Gini, nbhd waits) | 0.15 ± 0.08 | 0.18 ± 0.07 | 0.16 ± 0.05 | 0.16 ± 0.05 |
| Worst-neighbourhood P90 | 158.4 ± 23.07 | 188.6 ± 23.72 | 152.6 ± 25.78 | 123.6 ± 33.25 |
| Decommits per task | 1.23 ± 0.12 | 1.72 ± 0.27 | 1.32 ± 0.38 | 0.32 ± 0.04 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 3.33 ± 3.3 | 0.5 ± 0.5 | 1.5 ± 0.5 | 33.75 ± 21.99 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### blackout

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 46.16 ± 11.29 | 47.9 ± 14.3 | 28.12 ± 7.81 | 43.26 ± 6.41 |
| Time to service (P90) | 100.6 ± 32.59 | 104.4 ± 31.77 | 60.6 ± 20.2 | 85.2 ± 15.37 |
| Urgency-weighted time to service | 37.56 ± 8.36 | 38.94 ± 9.82 | 23.42 ± 5.4 | 43.76 ± 5.45 |
| Critical time to service | 30.56 ± 6.41 | 31.8 ± 6.13 | 19.56 ± 4.24 | 44.08 ± 6.15 |
| People rescued | 67.68 ± 5.18 | 65.02 ± 4.35 | 72.91 ± 5.13 | 71.26 ± 2.96 |
| Unmet requests at end | 14.8 ± 5.84 | 14.2 ± 6.11 | 7.6 ± 2.42 | 9.4 ± 2.73 |
| Requests past deadline | 5 ± 2.76 | 5.6 ± 3.26 | 2 ± 1.41 | 6.6 ± 3.14 |
| Idle while demand open | 32.38 ± 5.55 | 34.98 ± 4.08 | 36.26 ± 2.95 | 33.92 ± 4.07 |
| Resource idle time | 57.06 ± 5.31 | 57.66 ± 3.43 | 56.46 ± 5.02 | 55.22 ± 6.37 |
| Route violations | 6.6 ± 1.2 | 4.4 ± 1.62 | 0 ± 0 | 4 ± 1.79 |
| Fairness (Jain, nbhd waits) | 0.92 ± 0.04 | 0.91 ± 0.02 | 0.96 ± 0.04 | 0.95 ± 0.05 |
| Fairness (Gini, nbhd waits) | 0.15 ± 0.06 | 0.16 ± 0.03 | 0.1 ± 0.05 | 0.12 ± 0.06 |
| Worst-neighbourhood P90 | 119.8 ± 38.75 | 125.2 ± 36.83 | 76 ± 34.39 | 102.2 ± 26.75 |
| Decommits per task | 1.12 ± 0.46 | 1.57 ± 0.24 | 0.98 ± 0.4 | 0.33 ± 0.06 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 1 ± 0 | 0 ± 0 | 0 ± 0 | 1 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### contradiction

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 26.58 ± 7.5 | 29.86 ± 4.18 | 26.72 ± 6.03 | 36.48 ± 6.59 |
| Time to service (P90) | 58 ± 20.66 | 68 ± 12.99 | 58.2 ± 17.93 | 69.2 ± 15.16 |
| Urgency-weighted time to service | 20.82 ± 5.46 | 21.82 ± 3.15 | 20.48 ± 4.35 | 33.44 ± 5.78 |
| Critical time to service | 15.94 ± 3.09 | 15.76 ± 2.08 | 14.88 ± 2.53 | 29 ± 5.54 |
| People rescued | 65.89 ± 3.37 | 63 ± 4.29 | 65.75 ± 5.02 | 64.24 ± 3.69 |
| Unmet requests at end | 11.2 ± 4.66 | 12.6 ± 3.38 | 11.6 ± 5.71 | 14 ± 4.9 |
| Requests past deadline | 1 ± 1.1 | 0.6 ± 0.49 | 0.6 ± 0.8 | 3 ± 2.76 |
| Idle while demand open | 24.58 ± 4.93 | 24.42 ± 3.64 | 27.94 ± 3.83 | 26.28 ± 3.38 |
| Resource idle time | 51.48 ± 6.3 | 50.14 ± 5.45 | 54.34 ± 6.2 | 48.12 ± 2.86 |
| Route violations | 6 ± 0.63 | 7.2 ± 1.17 | 0 ± 0 | 6.6 ± 3.67 |
| Fairness (Jain, nbhd waits) | 0.84 ± 0.13 | 0.82 ± 0.13 | 0.82 ± 0.13 | 0.9 ± 0.03 |
| Fairness (Gini, nbhd waits) | 0.22 ± 0.11 | 0.23 ± 0.1 | 0.23 ± 0.11 | 0.17 ± 0.03 |
| Worst-neighbourhood P90 | 91.2 ± 34 | 106.8 ± 27.22 | 97.2 ± 37.14 | 97.8 ± 23.46 |
| Decommits per task | 0.97 ± 0.21 | 1.35 ± 0.26 | 0.67 ± 0.23 | 0.35 ± 0.07 |
| Contradiction resolution | 29 ± 23.84 | 16.08 ± 7.77 | 13.14 ± 11.85 | 21.38 ± 5.53 |
| Plan stabilisation after contradiction | 2.4 ± 4.8 | 2 ± 4 | 0 ± 0 | 4 ± 5.15 |
| Cascade recovery (re-assign all) | 12 ± 10.89 | 32.83 ± 35.96 | 0 ± 0 | 52 ± 21.4 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### fraud-mix

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 44.9 ± 12.95 | 31.98 ± 6.63 | 27.48 ± 4.94 | 34.6 ± 4.52 |
| Time to service (P90) | 114.4 ± 27.47 | 68.4 ± 17.87 | 62.4 ± 13.89 | 71.4 ± 14.14 |
| Urgency-weighted time to service | 31.5 ± 7.03 | 23.78 ± 5.97 | 21.76 ± 3.4 | 33.98 ± 5.61 |
| Critical time to service | 22.44 ± 4.76 | 16.52 ± 3.02 | 17.4 ± 2.85 | 33.2 ± 6.5 |
| People rescued | 64.71 ± 15.39 | 67.65 ± 6.06 | 71.38 ± 6.48 | 74.22 ± 3.45 |
| Unmet requests at end | 16 ± 7.62 | 10.2 ± 3.25 | 8.8 ± 2.71 | 6.8 ± 2.32 |
| Requests past deadline | 1.6 ± 1.62 | 0.8 ± 1.6 | 0.6 ± 0.8 | 3.8 ± 2.23 |
| Idle while demand open | 24.12 ± 5 | 24.48 ± 5.62 | 28.52 ± 6.87 | 26.28 ± 6.36 |
| Resource idle time | 49.74 ± 2.07 | 49.88 ± 2.3 | 55.92 ± 4.7 | 50.9 ± 2.02 |
| Route violations | 4.8 ± 2.04 | 5.4 ± 2.33 | 0 ± 0 | 3.4 ± 1.62 |
| Fairness (Jain, nbhd waits) | 0.97 ± 0.01 | 0.94 ± 0.04 | 0.95 ± 0.03 | 0.95 ± 0.02 |
| Fairness (Gini, nbhd waits) | 0.1 ± 0.02 | 0.12 ± 0.05 | 0.12 ± 0.04 | 0.12 ± 0.02 |
| Worst-neighbourhood P90 | 134.2 ± 32.87 | 101.4 ± 22.13 | 81.6 ± 20.63 | 100.4 ± 25.24 |
| Decommits per task | 1.36 ± 0.18 | 1.61 ± 0.16 | 0.92 ± 0.17 | 0.43 ± 0.08 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### sos-surge

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 68.14 ± 15.39 | 71.4 ± 13.16 | 66.26 ± 11.29 | 54.86 ± 6.34 |
| Time to service (P90) | 163.8 ± 31.35 | 160.4 ± 31.88 | 152 ± 29 | 124 ± 17.17 |
| Urgency-weighted time to service | 54.2 ± 13.4 | 57.28 ± 11.45 | 52 ± 8.81 | 55.08 ± 6.02 |
| Critical time to service | 41.02 ± 12.67 | 43.18 ± 8.6 | 39.06 ± 6.72 | 53.72 ± 6.69 |
| People rescued | 69.5 ± 5.78 | 71.8 ± 5.5 | 69.83 ± 5.41 | 69.01 ± 4.55 |
| Unmet requests at end | 17.8 ± 6.97 | 16.8 ± 5.42 | 16.4 ± 5.75 | 14.2 ± 2.86 |
| Requests past deadline | 15.8 ± 6.79 | 17 ± 6.75 | 14.6 ± 5.31 | 13.2 ± 2.79 |
| Idle while demand open | 15.72 ± 5.01 | 19.22 ± 2.35 | 18.34 ± 2.54 | 15.84 ± 5.71 |
| Resource idle time | 42.58 ± 7.3 | 43.92 ± 4.21 | 43.16 ± 4.87 | 40.1 ± 6.19 |
| Route violations | 3.4 ± 1.02 | 4.2 ± 1.17 | 0 ± 0 | 6.2 ± 2.93 |
| Fairness (Jain, nbhd waits) | 0.92 ± 0.05 | 0.91 ± 0.05 | 0.92 ± 0.03 | 0.88 ± 0.06 |
| Fairness (Gini, nbhd waits) | 0.13 ± 0.07 | 0.15 ± 0.05 | 0.15 ± 0.03 | 0.18 ± 0.05 |
| Worst-neighbourhood P90 | 179.8 ± 24.86 | 179.2 ± 23.34 | 171 ± 25.6 | 166.4 ± 35.86 |
| Decommits per task | 1.23 ± 0.41 | 3 ± 1.17 | 2.82 ± 1.09 | 0.28 ± 0.11 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### triple-failure

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 53.24 ± 5.81 | 52.06 ± 6.94 | 53.76 ± 5.94 | 45.3 ± 4.94 |
| Time to service (P90) | 119.6 ± 15.69 | 108.2 ± 16.61 | 118.6 ± 13.69 | 96.4 ± 9.52 |
| Urgency-weighted time to service | 39.34 ± 5.95 | 36.02 ± 5 | 37.46 ± 4.55 | 44.88 ± 5.4 |
| Critical time to service | 26.4 ± 5.2 | 23.24 ± 5.74 | 22.26 ± 4.54 | 45.62 ± 7.02 |
| People rescued | 60.84 ± 5.07 | 61.26 ± 3.6 | 59.92 ± 3.35 | 65.05 ± 4.31 |
| Unmet requests at end | 23.8 ± 7.39 | 24 ± 3.95 | 25.6 ± 4.36 | 17.8 ± 4.79 |
| Requests past deadline | 5.4 ± 3.61 | 2.8 ± 2.32 | 4 ± 2 | 9.8 ± 2.14 |
| Idle while demand open | 16.82 ± 7.32 | 23.58 ± 3.72 | 24.12 ± 3.7 | 21.06 ± 4.52 |
| Resource idle time | 37.08 ± 7.79 | 42.12 ± 5.4 | 42.94 ± 6.14 | 41.26 ± 5.11 |
| Route violations | 4.6 ± 2.42 | 7 ± 3.85 | 0 ± 0 | 5.8 ± 2.14 |
| Fairness (Jain, nbhd waits) | 0.91 ± 0.08 | 0.85 ± 0.07 | 0.83 ± 0.08 | 0.93 ± 0.04 |
| Fairness (Gini, nbhd waits) | 0.16 ± 0.08 | 0.22 ± 0.07 | 0.22 ± 0.07 | 0.14 ± 0.04 |
| Worst-neighbourhood P90 | 166 ± 23.24 | 146.2 ± 35.67 | 152.2 ± 25.72 | 120.8 ± 16.19 |
| Decommits per task | 1.89 ± 0.73 | 1.89 ± 0.31 | 1.44 ± 0.28 | 0.35 ± 0.15 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 6.33 ± 8.96 | 7.25 ± 5.49 | 5.8 ± 5.42 | 22.5 ± 23.2 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
