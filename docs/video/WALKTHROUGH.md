# FloodSetu — Video Walkthrough & Judge Talk Track

A complete 5-minute 46-second walkthrough of FloodSetu with **real screen recordings of the running application**, timed captions, and an **Indian-English voiceover powered by Sarvam AI's Bulbul v3 text-to-speech model**.

> **Watch the video:** [`docs/video/walkthrough.mp4`](walkthrough.mp4)  
> **Poster preview:** [`docs/video/poster.jpg`](poster.jpg)  
> **Raw scenes metadata:** [`docs/video/scenes.json`](scenes.json)

---

## Technical Specifications

| Parameter | Specification |
|---|---|
| **Runtime** | 5 minutes 46 seconds (346.8 s) |
| **Resolution** | 1600 × 900 (16:9 widescreen, native WebGL & UI canvas) |
| **Codec** | H.264 (High Profile, level 4.0, yuv420p) · faststart enabled for instant web playback |
| **Audio** | AAC mono 144 kbps @ 24,000 Hz |
| **Voiceover Engine** | **Sarvam AI** (`bulbul:v3`, Indian-English voice) |
| **Visual Elements** | Real browser captures, framed mobile phone overlays, timed subtitle cards with JetBrains Mono tags |
| **Data Scope** | 100% synthetic simulation in the fictional town of Jalnagar |

---

## Video Chapter Index & Judge Talk Track

### 0:00 · Title Card
* **Screen:** Dark radial background with the FloodSetu beacon emblem, track details (`Code-E-Manipal 2.0 · Track 06 Multi-Agent Systems · PS 27`), and project slogan.
* **Duration:** 2.5 s

---

### 0:02 · 01 — FloodSetu (Intro)
* **Screen:** Landing page aerial river flyover, hero slogan, live engine readouts in Web Worker.
* **Narration / Spoken Talk Track:**
  > *"This is FloodSetu. A signal in the flood, a lifeline in motion. It is our answer to problem statement twenty-seven: flood rescue dispatch, where boats, shelters and roads negotiate in real time. Everything you will see runs on one shared engine, in a fictional town called Jalnagar, with fully synthetic data."*
* **Judge Verification:** Notice that the hero readouts ("10/10 held", "SAR data age") reflect live engine state running inside a browser Web Worker.

---

### 0:23 · 02 — The Problem
* **Screen:** Landing page smooth scroll through *"The problem"* and *"Agents negotiate"*.
* **Narration / Spoken Talk Track:**
  > *"In a real flood, plans go stale in minutes. Roads close, a bridge gives way, a shelter fills up, and two people report the same bridge differently. So we model every boat, ground team, shelter, bridge and SOS cluster as an autonomous agent, with only partial information. Each agent keeps re-planning, and every single decision carries a reason."*
* **Judge Verification:** Highlights the fundamental limit of static dispatch trees in disaster logistics and introduces the distributed agent philosophy.

---

### 0:48 · 03 — Citizen SOS
* **Screen:** Smartphone backdrop: SOS home with live river gauge card, one-tap *"I'm in the water"*, and status tracking.
* **Narration / Spoken Talk Track:**
  > *"It starts with a citizen. No login is needed. One big SOS button, or a single tap on 'I am in the water', which sends a critical request with GPS in about two hundred bytes. With no network, it waits in an offline outbox and sends itself later. The app shows live flood alerts, river levels, and every step of the rescue, in thirteen Indian languages."*
* **Judge Verification:** Demonstrates friction-free emergency access: zero login, 200-byte lightweight payload, offline IndexedDB outbox, 13 Indian languages, and battery/network resilience.

---

### 1:16 · 04 — The Control Room
* **Screen:** Live Control Room: canvas map of Jalnagar (279 nodes, 3 bridges, 6 shelters, 8 boats, 17 ground teams), KPI counters, invariant health badge, live negotiation feed.
* **Narration / Spoken Talk Track:**
  > *"This is the heart of the system, the Control Room. The map shows Jalnagar: two hundred and seventy nine road and water nodes, three bridges and six shelters. Eight boats and seventeen ground teams move live. Along the top are the key numbers: open SOS, critical requests waiting, idle time, fairness, and the safety badge. Ten safety invariants are checked every simulated minute, and here they all hold. On the right, the negotiation feed shows every announce, bid and award as it happens."*
* **Judge Verification:** Real-time multi-agent situational awareness. Invariants badge continuously proves zero violations across all 10 core constraints.

---

### 1:52 · 05 — Negotiation, Explained
* **Screen:** Incidents drawer opening, inspectable *"Why"* breakdown with full bid table, constraint exclusions, and priority formula.
* **Narration / Spoken Talk Track:**
  > *"Here is how dispatch works. Each incident is announced, nearby units bid their time to reach it from their own map, and the best offer wins. This is the Contract Net protocol, with leveled commitment, so a unit only switches jobs when the gain beats a penalty. Click Why on any incident and you get the full bid table, the priority formula, urgency times vulnerability times people times waiting time, verification, escalation and fairness, and the constraints that ruled other units out. Money is not an input, and a test proves it."*
* **Judge Verification:** Full explainability: inspectable `U × V × N × A × C × E × F` breakdown. No black box ML; strict Section 3 firewall against financial bias.

---

### 2:29 · 06 — Conflicting Reports
* **Screen:** Injecting *"Conflict"* on Bridge 2, followed by the Verification view showing contested edge handling and scout dispatch.
* **Narration / Spoken Talk Track:**
  > *"Now we inject conflicting reports. A citizen says the bridge is open. A rescuer says it has collapsed. Reports are fused by source reliability and confidence, so the bridge becomes contested. Ground teams avoid it, boats pay extra to use it, and a verification task is auctioned to a team with that skill. We measure how fast the conflict is resolved, and how fast the plan stops churning."*
* **Judge Verification:** Demonstrates Bayesian trust fusion. Resolves contradictory ground reports safely without halting overall city-wide evacuation.

---

### 2:55 · 07 — Stretch Goal: Triple Failure
* **Screen:** Triggering the catastrophic *"Triple failure"*: simultaneous bridge collapse, boat motor failure with victims aboard, and shelter overflow. Cascade panel updates live.
* **Narration / Spoken Talk Track:**
  > *"This is the stretch goal. In one single minute, the busiest bridge collapses, a boat fails with people on board, and a shelter overflows. The cascade panel answers the three questions from the brief. Which commitments were cancelled, each with a reason code. Who was re-assigned, with the full bid table from the same-minute re-auction. And why, in plain language, built only from the logged facts. The people stranded on the failed boat instantly become a new critical incident, and all ten invariants still hold."*
* **Judge Verification:** Directly satisfies PS 27 Stretch Goal. Leveled decommitment penalties trigger re-auctions; cancelled commitments are logged with reason codes; stranded victims automatically spawn immediate SOS tasks.

---

### 3:29 · 08 — River Monitoring and Alerts
* **Screen:** Dam release scenario; *River & sat* panel with live gauge sparklines (level, flow, trend), and automatic push alert reaching citizen phone.
* **Narration / Spoken Talk Track:**
  > *"Next, river monitoring. Three river gauges report the water level every ten minutes, with flow from a rating curve, the trend in centimetres per hour, and warning and danger levels. Indian satellites, like EOS-04 radar, add flood maps that see through monsoon cloud, always shown with their data age. When a gauge crosses a threshold, or an old dam starts releasing water, an automatic public alert goes out, and it reaches the citizen app straight away."*
* **Judge Verification:** Real hydrological parameters: rating curves, trend (cm/hr), warning/danger stages, ISRO EOS-04 radar SAR latency modeling, and Common Alerting Protocol (CAP) broadcasting.

---

### 4:04 · 09 — Replay and Honest Results
* **Screen:** Scrubbing the timeline scrubber backwards for after-action audit, then switching to the *Compare* benchmarking matrix.
* **Narration / Spoken Talk Track:**
  > *"Every minute is recorded, so you can drag the timeline back for a full after-action replay. And we compare four strategies on the same seeded floods: decentralised negotiation, a central optimiser with the same information, an all-knowing upper bound, and a simple greedy floor. Across one hundred and forty runs, there were zero safety violations. Negotiation and central planning are within a minute on average service time. Central is about one percent faster on critical cases, but negotiation re-assigns everything after a cascade in about three minutes, against fourteen. We publish where we lose, too."*
* **Judge Verification:** Rigorous benchmarking: 140 seeded runs comparing Contract Net against Centralised Hungarian, Omniscient bound, and Greedy heuristics. Highlights negotiation's 4.6× faster re-planning during cascades.

---

### 4:44 · 10 — Rescuer App & Public Ledger
* **Screen:** Smartphone rescuer view with *"Why you?"* explanation and big tactical action buttons; followed by the relief portal ledger verification.
* **Narration / Spoken Talk Track:**
  > *"The rescue team sees one simple task card on their phone: who, how many, the ETA, why they were chosen, and big buttons to accept, report and update. The Control Room hears every tap within seconds. Relief and donations live behind a firewall, on a public, hash-chained ledger that anyone can verify. Donations can never buy rescue priority, and that is enforced by code, tests and a lint rule."*
* **Judge Verification:** Shows the field responder workflow and the cryptographic SHA-256 hash-chained public audit ledger. Proves ethical dispatch firewalls.

---

### 5:13 · 11 — Build the Proof (Closing)
* **Screen:** Landing page evidence summary and final architectural proof badges.
* **Narration / Spoken Talk Track:**
  > *"So, to sum up. A time-stepped simulation, injected events, a reason-coded assignment log, reroute explanations and after-action replay, all on synthetic data. Ten safety invariants, a hundred and nine unit tests, eleven end-to-end tests, and an honest benchmark. Plus a citizen app, a rescuer app and a native iPhone app. FloodSetu. Build the proof, test the failure cases, show your evidence. Thank you."*
* **Judge Verification:** Recaps all deliverables: 109 passing unit tests, 11 Playwright e2e tests, 10/10 invariants, native iOS Swift client, and open-source benchmark logs.

---

### 5:43 · End Card
* **Screen:** Closing card with live links (`floodsetu.vercel.app · github.com/satiricalguru/FloodSetu`), Sarvam AI voiceover credit, and synthetic data disclaimer.
* **Duration:** 3.5 s

---

## How to Present This Video to Judges

1. **Option A (Play the MP4 directly):**
   * Open [`docs/video/walkthrough.mp4`](walkthrough.mp4) in any media player or browser.
   * Let the Sarvam voiceover speak for itself—the pacing is calibrated to provide breathing room between complex technical concepts.

2. **Option B (Mute & Live Pitch):**
   * Play the video on mute and read the *Narration / Spoken Talk Track* blocks aloud. Each paragraph matches the screen action within 0.5 seconds.
   * If judges ask to pause at any point (e.g., at 2:55 for the Triple Failure), pause the video and use the *Judge Verification* bullet points to drill into the code and invariants.
