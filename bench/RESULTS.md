# Benchmark results

_Generated 2026-10-15T13:30:59.524Z · 36 runs · 3 seeds per scenario · `pnpm bench`_

## Verdict (auto-generated, honest)

- Across 3 scenarios × 3 seeds (36 runs), all invariant checks: 0 violations in every run.
- Decentralised CNP wins on: Idle while demand open; Cascade recovery (re-assign all).
- Centralised (same-info) wins on: Urgency-weighted time to service; Critical time to service; Requests past deadline; Worst-neighbourhood P90.
- Greedy floor wins on: Time to service (mean); Time to service (P90); People rescued; Unmet requests at end; Route violations; Decommits per task.
- Critical time-to-service: CNP 36.21 min vs central 25.71 min (41%) vs greedy 42.97 min — central's per-tick global re-optimisation of every unstarted job serves the most urgent cases faster; greedy (urgency-blind) is worst.
- Price of partial information: omniscient reaches 44.18 min mean TTS and 0 route violations vs CNP 51.24 min / 6.44 — the gap is what perfect sensing + comms would buy.
- Churn: CNP 2.51 vs central 2.25 decommits/task — leveled commitment means agents only switch when the gain beats an 8-min penalty; greedy never re-plans (0.33).
- fraud-mix: CNP 32.3 vs central 25.37 min mean TTS → central better
- sos-surge: CNP 66.27 vs central 56 min mean TTS → central better
- triple-failure: CNP 55.17 vs central 54.13 min mean TTS → central better

## Overall means

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) (min) ↓ | 51.24 | 45.17 | 44.18 | 43.06 |
| Time to service (P90) (min) ↓ | 115 | 104 | 93.11 | 92.22 |
| Urgency-weighted time to service (min) ↓ | 43.13 | 34.97 | 34.36 | 42.76 |
| Critical time to service (min) ↓ | 36.21 | 25.71 | 25.6 | 42.97 |
| People rescued (%) ↑ | 65.72 | 68.09 | 68.81 | 71.54 |
| Unmet requests at end ↓ | 16.67 | 14.44 | 15 | 11.78 |
| Requests past deadline ↓ | 7.11 | 4.89 | 4.89 | 8.22 |
| Idle while demand open (%) ↓ | 16 | 20.9 | 22.99 | 22.04 |
| Resource idle time (%) ↓ | 45.8 | 47.4 | 49.36 | 45.41 |
| Route violations ↓ | 6.44 | 6 | 0 | 5.67 |
| Fairness (Jain, nbhd waits) ↑ | 0.91 | 0.92 | 0.91 | 0.92 |
| Fairness (Gini, nbhd waits) ↓ | 0.16 | 0.14 | 0.15 | 0.15 |
| Worst-neighbourhood P90 (min) ↓ | 148.22 | 115.89 | 117.22 | 119.33 |
| Decommits per task ↓ | 2.51 | 2.25 | 1.74 | 0.33 |
| Contradiction resolution (min) ↓ | 0 | 0 | 0 | 0 |
| Plan stabilisation after contradiction (min) ↓ | 0 | 0 | 0 | 0 |
| Cascade recovery (re-assign all) (min) ↓ | 3.67 | 28.67 | 3.33 | 53 |
| Invariant violations ↓ | 0 | 0 | 0 | 0 |

### fraud-mix

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 32.3 ± 4.49 | 25.37 ± 1.87 | 28.23 ± 4.45 | 32.3 ± 0.51 |
| Time to service (P90) | 83.67 ± 16.13 | 56 ± 2.16 | 56.67 ± 16.01 | 67 ± 4.24 |
| Urgency-weighted time to service | 30.87 ± 7.05 | 21.93 ± 3.23 | 23.2 ± 2.49 | 31.33 ± 2.15 |
| Critical time to service | 29.77 ± 8.25 | 17.57 ± 2.6 | 18.4 ± 1.99 | 30.5 ± 2.81 |
| People rescued | 67.03 ± 8.63 | 71.56 ± 3.05 | 75.61 ± 2.58 | 76.14 ± 2.99 |
| Unmet requests at end | 10 ± 1.41 | 6.33 ± 1.25 | 7.67 ± 2.49 | 5.67 ± 2.05 |
| Requests past deadline | 3 ± 2.16 | 1 ± 0.82 | 0.67 ± 0.47 | 3.33 ± 1.89 |
| Idle while demand open | 24.07 ± 4.12 | 27.27 ± 7.58 | 31.6 ± 5.27 | 26.33 ± 7.21 |
| Resource idle time | 53.83 ± 0.68 | 54.33 ± 4.3 | 58.37 ± 2.18 | 51.53 ± 2.15 |
| Route violations | 6.33 ± 1.7 | 6 ± 1.41 | 0 ± 0 | 3.67 ± 2.05 |
| Fairness (Jain, nbhd waits) | 0.92 ± 0.02 | 0.96 ± 0.04 | 0.96 ± 0.03 | 0.96 ± 0.02 |
| Fairness (Gini, nbhd waits) | 0.16 ± 0.02 | 0.09 ± 0.06 | 0.1 ± 0.06 | 0.11 ± 0.03 |
| Worst-neighbourhood P90 | 112.33 ± 23.68 | 70.67 ± 8.06 | 74 ± 24.54 | 94 ± 13.74 |
| Decommits per task | 1.46 ± 0.21 | 1.59 ± 0.19 | 0.91 ± 0.23 | 0.43 ± 0.08 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### sos-surge

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 66.27 ± 13.15 | 56 ± 15.2 | 51.6 ± 7.89 | 51.4 ± 5.81 |
| Time to service (P90) | 150.33 ± 35.31 | 131 ± 29.06 | 114.67 ± 23.91 | 113.33 ± 14.29 |
| Urgency-weighted time to service | 56.83 ± 14.24 | 45 ± 12.88 | 42.47 ± 5.66 | 53.5 ± 6.95 |
| Critical time to service | 48.57 ± 16.29 | 35.53 ± 10.38 | 34.77 ± 4.67 | 54.87 ± 8.1 |
| People rescued | 67.65 ± 6.05 | 70.35 ± 5.7 | 68.85 ± 3.63 | 72.42 ± 1.48 |
| Unmet requests at end | 15.67 ± 3.86 | 12 ± 2.94 | 12 ± 1.41 | 12.33 ± 2.05 |
| Requests past deadline | 13.67 ± 4.5 | 10.67 ± 6.6 | 9.67 ± 4.5 | 12.33 ± 2.62 |
| Idle while demand open | 9.1 ± 4.26 | 12.33 ± 1.75 | 13.4 ± 3.5 | 17.2 ± 4.35 |
| Resource idle time | 38.67 ± 7.05 | 42.7 ± 5.78 | 43.53 ± 7.57 | 42 ± 6.75 |
| Route violations | 5.33 ± 1.7 | 5 ± 2.45 | 0 ± 0 | 6.67 ± 3.68 |
| Fairness (Jain, nbhd waits) | 0.92 ± 0.05 | 0.95 ± 0.04 | 0.94 ± 0.04 | 0.87 ± 0.08 |
| Fairness (Gini, nbhd waits) | 0.15 ± 0.05 | 0.11 ± 0.04 | 0.12 ± 0.04 | 0.19 ± 0.06 |
| Worst-neighbourhood P90 | 184.67 ± 21.3 | 140.67 ± 32.83 | 126 ± 22.38 | 145 ± 28.58 |
| Decommits per task | 3.72 ± 0.21 | 3.18 ± 1.05 | 2.6 ± 0.54 | 0.31 ± 0.12 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |

### triple-failure

| Metric | Decentralised CNP | Central (same-info) | Central (omniscient, upper bound) | Greedy floor |
|---|---|---|---|---|
| Time to service (mean) | 55.17 ± 6.75 | 54.13 ± 3.18 | 52.7 ± 7.13 | 45.47 ± 5.06 |
| Time to service (P90) | 111 ± 16.99 | 125 ± 17.11 | 108 ± 13.59 | 96.33 ± 11.95 |
| Urgency-weighted time to service | 41.7 ± 7.02 | 37.97 ± 4.5 | 37.4 ± 7.2 | 43.43 ± 4.16 |
| Critical time to service | 30.3 ± 7.71 | 24.03 ± 4.61 | 23.63 ± 7.02 | 43.53 ± 4.51 |
| People rescued | 62.46 ± 5.96 | 62.37 ± 0.51 | 61.97 ± 5.77 | 66.06 ± 2.64 |
| Unmet requests at end | 24.33 ± 7.72 | 25 ± 3.74 | 25.33 ± 7.59 | 17.33 ± 5.79 |
| Requests past deadline | 4.67 ± 3.86 | 3 ± 1.63 | 4.33 ± 2.05 | 9 ± 0 |
| Idle while demand open | 14.83 ± 8.65 | 23.1 ± 2.22 | 23.97 ± 2.32 | 22.6 ± 4.64 |
| Resource idle time | 44.9 ± 3.02 | 45.17 ± 2.52 | 46.17 ± 0.97 | 42.7 ± 6.18 |
| Route violations | 7.67 ± 3.09 | 7 ± 4.32 | 0 ± 0 | 6.67 ± 1.25 |
| Fairness (Jain, nbhd waits) | 0.89 ± 0.11 | 0.84 ± 0.06 | 0.83 ± 0.09 | 0.93 ± 0.02 |
| Fairness (Gini, nbhd waits) | 0.16 ± 0.11 | 0.21 ± 0.05 | 0.22 ± 0.08 | 0.14 ± 0.02 |
| Worst-neighbourhood P90 | 147.67 ± 13.47 | 136.33 ± 20.27 | 151.67 ± 19.57 | 119 ± 19.51 |
| Decommits per task | 2.34 ± 0.37 | 1.98 ± 0.12 | 1.7 ± 0.08 | 0.25 ± 0.09 |
| Contradiction resolution | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Plan stabilisation after contradiction | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
| Cascade recovery (re-assign all) | 3.67 ± 5.19 | 28.67 ± 29.41 | 3.33 ± 2.87 | 53 ± 0 |
| Invariant violations | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 |
