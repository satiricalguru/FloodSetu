# 3-minute demo script

**Setup (before judges arrive):** `pnpm dev`. Open `/control` on the laptop, `/sos` on phone A, and `/rescuer` on phone B. The phones join over the LAN: use the "Network" URL printed by `next dev`. On phone B, tap unit **B-1**.

| Time | Do | Say |
|---|---|---|
| 0:00–0:30 | `/` and scroll the landing. The water rises, SOS beacons light up, and bid arcs fly. Section 3 triggers a *real* triple failure | "This isn't an animation. A real engine instance runs in a Web Worker behind the page." |
| 0:30–1:00 | **Open Control Room**. The baseline monsoon runs at 5×. Point at the KPIs, the feed (ANNOUNCE / BID / AWARD), and the invariant badge **9/9 held**. Open Incidents (2), then the ⓘ on a row for **Why?** | "Every award shows the bid table, the priority formula U×V×N×A×C×E×F and the constraints. Note there is no money in the formula." |
| 1:00–1:30 | Phone A: **SOS → Critical → Send**. A toast "Live SOS JS-XXXX injected" appears in the control room. Phone A's stepper advances to **Team assigned** with an ETA and the team on the mini-map. Phone B shows the task and **Why you?**, then taps **Accept**. The control room toasts "crew acknowledged" | "No login needed. If this phone were offline, the SOS would sit in an IndexedDB outbox and send itself later." |
| 1:30–2:00 | Dock: **Conflict** on B2 (citizen says open, rescuer says collapsed). Open Verification (5): B2 is contested and a VERIFY task is auctioned. The map shows a violet dashed edge | "Ground units avoid contested edges and boats pay ×3. A verification team settles it, and we measure resolution time, stabilisation and wasted trips." |
| 2:00–2:30 | **Triple failure** (or press **T**). The cascade panel opens | "Bridge, boat and shelter fail in the same tick. These commitments were cancelled with these reason codes, here is who won the re-auction and the bids, and here is when everything was re-assigned. The people who were on the dead boat became a new critical incident." |
| 2:30–2:45 | Compare (7) → Benchmark | "120 seeded runs. CNP and central are within a minute on mean TTS. Central is 3% faster on critical cases, greedy is fastest on average but 60% slower on critical ones. We show where we lose." |
| 2:45–3:00 | Replay (8), then drag the scrubber. Then `/relief` → **Verify ledger** → **Simulate tampering** | "After-action replay of every tick. Donations flow through a hash-chained ledger anyone can verify, and donations can never buy priority: there's an automated test for that." |

**Fallbacks:** if phones can't reach the laptop, use `curl` (`docs/ARCHITECTURE.md` → live bridge) or the in-dock **SOS burst**. If WebGL is off, the landing shows a static backdrop with all content.
