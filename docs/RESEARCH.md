# FloodSetu — Phase 0 Research

> PS 27 · Flood Rescue Dispatch · Code-E-Manipal 2.0
> Each section: what the literature/practice says → what we chose → why. Links at the end of each section.

---

## 4.1 Multi-agent coordination and allocation

### Findings
- **Contract Net Protocol (CNP)** (R. G. Smith, 1980, *IEEE Trans. Computers*): a *manager* announces a task, *contractors* reply with bids, the manager awards, and the winner commits. It is simple, fully explainable (every award has a bid table), and works with partial information, since each contractor bids from its own beliefs.
- **Leveled-commitment contracting** (Sandholm & Lesser, AAAI-96; *AI Magazine* 2002): contracts can be broken by paying a *decommitment penalty*. This lets agents back out when the world changes (a route closes, a boat fails), which full commitment cannot do. Strategic decommitting is a risk among *self-interested* agents. Our agents are cooperative, so we keep the penalty to block thrash: an agent drops a commitment voluntarily only when the gain beats a fixed penalty. A forced decommit (failure, blocked route) always carries a **reason code**.
- **CBBA** (Choi, Brunet & How, *IEEE T-RO* 2009): each agent builds a bundle and bids per task on the marginal gain; a local *consensus* phase resolves conflicts. It provably converges to a conflict-free assignment that is at least 50% of optimal and stays robust to inconsistent situational awareness. **CBBA-PR** (Buckman, How & Choi) adds partial replanning when new tasks appear.
- **Gerkey & Matarić taxonomy** (IJRR 2004): MRTA problems are classified as ST/MT (single- vs multi-task robots), SR/MR (single- vs multi-robot tasks), and IA/TA (instantaneous vs time-extended assignment). Our problem is **ST-SR-TA with some MR**: large incidents need several boats. Their analysis shows greedy auctions are a 2-competitive approximation of the optimal assignment for IA.
- **Dias, Zlot, Kalra & Stentz** (Proc. IEEE 2006), a survey of market-based coordination: markets give robustness, run with partial information, and degrade gracefully under communication loss. Centralised planners are better when the information is global and the problem is small.

### Chosen approach
**CNP with urgency-weighted, priority-ordered sequential auctions, bundles of up to 2 commitments per agent, leveled commitment, and same-tick re-auction on disruption.**
- Bids are *time-to-service in minutes*. Each agent computes its bid **from its own belief graph**: queue completion time + route ETA + penalties for queue length, fuel reserve, and capacity mismatch.
- Tasks are auctioned in descending priority (urgency × vulnerability × aging, plus a fairness boost). This is a sequential single-item auction, which is the special case of CBBA where every bundle grows one task at a time with a fixed task order. We take CBBA's bundle idea (agents bid while busy, and the bid includes their queue) without its consensus rounds. Our announcer is a single IncidentAgent per task, so a bid conflict cannot arise.
- **Why not full CBBA?** Its convergence rounds per tick make the explanation ("why did B-1 win?") much harder for an operator to read. The 36-hour budget is also better spent on failure testing. We record CBBA as the next step in `LIMITATIONS.md`.

**Sources:** [Choi, Brunet, How — CBBA (MIT DSpace)](https://dspace.mit.edu/handle/1721.1/52330) · [CBBA-PR (Buckman thesis)](https://people.csail.mit.edu/nbuckman/pdfs/MastersThesis.pdf) · [Sandholm & Lesser — Leveled commitment (AAAI-96)](https://mlanthology.org/aaai/1996/sandholm1996aaai-advantages) · [Leveled-commitment contracting, AI Magazine](https://unpaywall.org/10.1609%2FAIMAG.V23I3.1659) · [Gerkey & Matarić — Formal analysis and taxonomy of MRTA](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/gerkey04formal.pdf) · [Dias et al. — Market-based multirobot coordination survey](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/dias06market.pdf) · [CMU — centralised vs market vs behavioural comparison](https://www.ri.cmu.edu/publications/a-comparative-study-between-centralized-market-based-and-behavioral-multirobot-coordination-approaches)

---

## 4.2 Centralised baseline

### Findings
- **Hungarian algorithm** (Kuhn–Munkres): optimal one-to-one assignment in O(n³). It is exact, deterministic and dependency-free in TS.
- **CVRPTW** (OR-Tools): better for multi-stop routes, but it needs a Python sidecar and gives non-deterministic runtimes under time limits. That is a risk for a reliable, seeded benchmark.
- **Greedy nearest-available** is the common operational floor (the "closest unit" dispatch rule).

### Chosen approach
Three baselines, all running through the **same tick loop, execution model, invariants, metrics and seed**:
1. **Central (same-info):** every tick, Hungarian over (free agents + agents not yet on-site) × (top-K open task slots). The cost is `priority-weighted ETA`, computed on the **control room's fused belief (COP)** and **last-known agent positions**. Commands to agents in a blackout are lost, just as CNP messages are. Incumbent assignments get a switching discount to limit churn; each switch is logged as `CENTRAL_REPLAN`.
2. **Central (omniscient):** the same solver, but every belief store is replaced by ground truth and comms are perfect. **This is an upper-bound reference, not a fair competitor.**
3. **Greedy floor:** each free agent takes the nearest feasible open task. It ignores urgency, fairness and preemption.

**Honesty note:** CNP agents act on *partial* information, whereas the omniscient planner sees everything. Comparing CNP only against omniscient would be unfair. Comparing only against same-info would hide the *price of partial information*. We report both. OR-Tools VRP is noted as future work; the pure-TS Hungarian solver keeps `pnpm bench` fully offline and deterministic.

**Sources:** [Kuhn–Munkres / Hungarian algorithm overview](https://en.wikipedia.org/wiki/Hungarian_algorithm) · [Google OR-Tools VRP with time windows](https://developers.google.com/optimization/routing/vrptw)

---

## 4.3 Fairness

### Findings
- **Jain's index** `J = (Σx)² / (n·Σx²)` ∈ [1/n, 1] (Jain, Chiu & Hawe, DEC-TR-301, 1984). It is scale-independent and reads directly: J = 0.9 means "fair to 90%".
- **Gini coefficient** is used in EMS equity studies on response times (e.g. arrival-time Gini 0.31 in Rasht; transfer-delay Gini 0.35 in Shenzhen). Papers warn that Gini definitions vary, so **state the formula**.
- **Rawlsian max-min** (serve the worst-off area) and **P90 per area** expose tail unfairness that the mean hides.
- **Priority aging** is the classic starvation fix from OS schedulers: priority grows with wait time.

### Chosen approach
- Per neighbourhood we compute mean wait and P90 wait. Censored waits (still unserved at the end) count as `end − reportedAt`, so an area is never rewarded for being ignored.
- **Jain's index over per-neighbourhood mean waits** measures *equality of treatment*. Equal waits give 1.0, and it says nothing about level. That is why we pair it with **worst-neighbourhood P90** (the Rawlsian lens).
- **Gini** uses the mean-absolute-difference definition `G = Σᵢ Σⱼ |xᵢ − xⱼ| / (2n²·mean)` on the same vector.
- **Aging:** `priority = U × V × (1 + wait/τ)` with τ = 30 min. A request past `MAX_WAIT[class]` is **escalated** (invariant 6).
- **Fairness tie-break:** tasks whose priorities are within 5% are ordered so that the neighbourhood with the worse current P90 goes first.

### Ethical triage
- **START** categories map to our urgency classes: Immediate/red → `critical`, Delayed/yellow → `urgent`, Minor/green → `needs_help`. *Expectant* is deliberately **not modelled**: a dispatch tool must not encode a decision to abandon people.
- Vulnerability multiplier: +0.15 per declared need (elderly, child, pregnant, disabled, medical, injured), +0.3 × the neighbourhood vulnerability index (slum density, elderly share). This is a *documented, inspectable formula*, not a learned score.

**Sources:** [Jain — fairness index papers](https://classes.engineering.wustl.edu/~jain/papers/fairness.htm) · [Jain et al. 1984 (arXiv cs/9809099)](https://arxiv.org/abs/cs/9809099) · [Revisiting Gini for equitable humanitarian logistics](https://ar5iv.labs.arxiv.org/html/2106.12686) · [Fairness vs efficiency in EMS location planning (TU Dresden)](https://fis.tu-dresden.de/portal/en/publications/fairness-or-efficiencymanaging-this-conflict-in-emergency-medical-services-location-planning(c1a3be41-27d4-483e-b315-1b0b543007f6).html) · [Trauma arrival-time Gini study](https://beat.sums.ac.ir/article_50347.html) · [START triage](https://en.wikipedia.org/wiki/Simple_triage_and_rapid_treatment) · [CHEMM START algorithm](https://chemm.hhs.gov/startalgotext.htm)

---

## 4.4 Uncertain and contradictory reports

### Findings
- **Dempster–Shafer** combines evidence from partially reliable sources and models ignorance explicitly (Haenni & Hartmann). Dempster's normalisation behaves badly under high conflict, which is exactly our case.
- **Trust-weighted Bayesian/ML fusion** (Venanzi, Rogers & Jennings) learns source trustworthiness. Crowd reports are noisy: 66% of the winning Red Balloon team's sightings were wrong.
- A recent preprint on Zhengzhou-2021 flood road reports shows that non-robust fusion can **flip a blocked-road assessment** and spread the error. This argues for *conservative* routing under conflict.

### Chosen approach — **reliability-weighted log-odds with decay** (explainable by hand)
- Every report has `claim (open|closed)`, `confidence c ∈ [0,1]`, `source`, and `tick`. Source reliability r: sensor 0.95, rescuer 0.90, control room 0.85, citizen 0.65.
- Update: `L ← L ± logit(0.5 + r·c/2)` (+ for open, − for closed). Decay toward the prior: `L ← L·e^(−Δt/τ)`, τ = 90 min. Status: P(open) > 0.7 → open, < 0.3 → closed, otherwise **unknown**.
- **Contradiction:** an opposing report of strength ≥ 0.3 arriving within 60 min of a belief with |L| ≥ 1 marks the edge **contested**. Both sources are kept for the UI, and the planner treats a contested edge as **closed for ground agents and ×3 cost for boats** (safe routing). A `VERIFY` task is auctioned to a ground agent with the verification skill. Its direct observation (r = 0.9, c = 1) resolves the conflict.
- **Recovery metric** (per contradiction): ① *belief-resolution time* (contested → verified), ② *plan-stabilisation time* (until the last reroute or decommit caused by that edge, within a 60-tick window), ③ *wasted trips* (agents that physically reached the edge and turned back), ④ *churn* (reassignments caused).

**Sources:** [Haenni & Hartmann — partially reliable sources (D–S)](https://dc2.philarchive.org/rec/HARMPR) · [Venanzi et al. — trust-based fusion in crowdsourcing](https://eprints.soton.ac.uk/346520/1/main.pdf) · [Robust flood road-report fusion preprint](https://www.researchsquare.com/article/rs-10104632) · [Bayesian fusion of crowdsourced Waze incidents](https://arxiv.org/pdf/2011.05440)

---

## 4.5 Dynamic graph routing

### Findings
- **D\* Lite** (Koenig & Likhachev, AAAI-02) reuses earlier search effort when edge costs change, which suits a single robot in unknown terrain.
- Our graph is about 220 nodes and 420 edges with about 23 agents. One Dijkstra over it takes well under 1 ms in V8.

### Chosen approach
**Re-run Dijkstra/A\* from scratch** on each agent's *own belief graph* whenever it needs a route: on a new commitment, a belief change on its path, or arrival at an unexpectedly blocked edge. One-to-all Dijkstra trees are cached per agent per tick for bidding. D\* Lite would add complexity for no measurable gain at this size; we note this in DECISIONS.
- **Multi-modal passability:** a ground agent needs depth ≤ 0.5 m (speed drops above 0.2 m); a boat needs depth ≥ 0.4 m on roads (slower below 0.8 m). River edges are boat-only and bridges are ground-only. The 0.4–0.5 m overlap is passable by both. Closed or collapsed edges are impassable for all.

**Sources:** [D\* Lite (CMU RI)](https://www.ri.cmu.edu/publications/d-lite) · [D\* Lite paper PDF](https://cse-robotics.engr.tamu.edu/dshell/cs625/aaai02b.pdf)

---

## 4.6 Indian disaster-response context

### Findings
- **DM Act 2005** → NDMA (national), SDMA (state), DDMA (district); NDRF and SDRF are the specialist response forces.
- **NDRF flood teams:** about 45 personnel per team, equipped with inflatable rubber boats (IRBs). Example deployment: 9 teams, 309 rescuers, 32 IRBs (AP/Telangana). That is roughly 3–4 boats per team, which gives our fleet scale: 8 boats of capacity 4–12.
- **Incident Response System (NDMA, July 2010):** the Responsible Officer (RO) at state or district level activates Incident Response Teams (IRTs) led by an Incident Commander (IC). Sections are Operations, Planning, and Logistics. Our **Control Room operator = IC / Operations Section Chief**. Assignments and overrides follow the IRS idea of one accountable commander, with every action logged.
- **SACHET / CAP:** NDMA's Integrated Alert System, built by C-DOT. It uses the ITU Common Alerting Protocol (CAP 1.2, XML), is geo-targeted, multilingual, and covers all 36 states and UTs. IMD, CWC and INCOIS are alert sources. NDMA has been testing cell-broadcast alerts in 2026. Our control-room broadcast uses a **CAP-shaped JSON** (`identifier, sender, sent, status, msgType, scope, info{category, event, urgency, severity, certainty, area}`), so it could be exported to SACHET later.
- **112** is India's single emergency number (ERSS). Other helplines: 1078 (NDMA disaster helpline), 1070 (state EOC), 108 (ambulance).

**Sources:** [NDMA flood guidelines 2008 (India Water Portal)](https://www.indiawaterportal.org/governance-and-policy/governance/national-disaster-management-guidelines-management-floods-2008) · [NDMA IRS guidelines (Goa SDMA copy)](https://sdma.goa.gov.in/sites/default/files/2022-05/IRS%20Guidelines_1.pdf) · [NDRF flood readiness](https://ndrf.gov.in/en/node/89041) · [NDRF teams and IRBs — Tribune](https://www.tribuneindia.com/news/archive/nation/floods-ndrf-teams-reach-ap-telangana-300775) · [CAP in the Indian context](https://thejeshgn.com/2025/05/28/common-alerting-protocol-cap-in-the-indian-context/) · [National Disaster Alert Portal (Vikaspedia)](https://en.vikaspedia.in/social-welfare/disaster-management-1/national-disaster-alert-portal) · [NDMA cell broadcast test 2026](https://www.etvbharat.com/en/bharat/ndma-tests-cell-broadcast-message-to-alert-citizens-on-severe-disaster-enn26050201915)

### Flood safety (awareness module content, NDMA-aligned)
- **Before:** follow IMD/SDMA advisories only (not forwarded rumours); prepare a kit (water, dry food, medicines, torch, power bank, whistle, documents in waterproof pouches, cash); know the route to the nearest shelter or raised pucca house; untie cattle; evacuate when officials direct you.
- **During:** never walk or drive through moving water (60 cm can carry a car); if you must wade, test the ground with a stick; stay away from electric poles and wires; switch off the mains if safe; avoid drains and manholes; drink boiled or chlorinated water.
- **After:** keep children out of floodwater; don't use wet electrical goods; watch for snakes and debris; discard food that touched floodwater; drink tap water only after the health department's all-clear.

**Sources:** [Sphere India flood do's and don'ts (NDMA-based)](https://sphereindia.org.in/sites/default/files/2022-07/Flood%20Do%27s%20and%20Don%27ts%20%28210%20%C3%97%20297%20mm%29.pdf) · [IMD Nagpur floods do's and don'ts](https://www.imdnagpur.gov.in/docs_general/Floods_Dos_and_Donts.pdf) · [Manipur SDMA floods](https://msdma.mn.gov.in/uploads/site1/docs/Floods.pdf)

---

## 4.7 Aarogya Setu — what we borrow vs what we fix

### Documented mechanisms
- Mobile-number registration with OTP verification, as described in the app onboarding.
- At registration it collected name, phone, age, sex, profession and recent travel. This was stored server-side and **hashed against a unique Digital ID (DiD)**, which identified the user in all later transactions. Names were not stored on the server unless contact was needed. Data was encrypted before upload. Purge windows were 45 days (negative) and 60 days after recovery (positive).
- A colour-coded status UI, and an Open API with user consent.

### Documented criticisms
- **Static DiD.** Unlike Singapore's TraceTogether, which rotates IDs, the static DiD could be traced back to the user (SFLC.in; 2023 explainer: "static anonymisation ID is a weaker model than dynamic IDs").
- **Deletion.** At first users could not delete their response data. An account-deletion option came later, but it was unclear whether server data was erased (SFLC.in).
- **Location.** The researcher Robert Baptiste reported issues with how often location was fetched and with user-modifiable lat/lng/radius parameters. Critics also said "anonymised" data was exempt from deletion and that anonymisation was never defined.
- **Self-reported data could be falsified.** Self-assessment answers were taken on trust.
- **Governance.** There was no statutory backing (IFF), and the published source code was reportedly not the version in production.

### Borrow vs fix

| Aarogya Setu | FloodSetu |
|---|---|
| OTP login on a mobile number | ✅ Borrowed. 6-digit OTP, 5-min expiry, WebOTP autofill; dev mode prints it to the console and `/dev/inbox` |
| Static DiD for all transactions | 🔧 **Fixed.** Stable internal `uid` = HMAC(phone, server pepper), never shown. Shared views use a **rotating per-request handle** (`h_<8 chars>` = HMAC(uid, requestId)), so two requests can't be linked across roles |
| No deletion at launch | 🔧 **Fixed.** `DELETE /api/me` erases the account, its phone hash and its precise location; the audit log keeps only a tombstone. `GET /api/me/export` gives a data export |
| Location fetched frequently, retained | 🔧 **Fixed.** Precise location only goes to the assigned team and the control room, only while a request is active. Every other view gets a coarse 500 m grid cell. Precise coords are purged at resolution + 24 h |
| Self-reported data trusted | 🔧 **Fixed.** We *flag, never reject*: an explainable risk score routes requests to a review queue, and critical SOS are dispatched regardless (invariant 7) |
| Registration required | 🔧 **Changed.** SOS **never** needs login. Guest SOS carries a device fingerprint and an optional phone number, and can be linked to an account later |
| Colour-coded status | ✅ Borrowed, but every colour also has an **icon and a text label** (colour-blind safe) |

> We do **not** claim Aarogya Setu prevented every fake account. Its weak spots are the reason our anti-fraud layer exists.

**Sources:** [SFLC.in — updated privacy policy analysis](https://sflc.in/our-analysis-aarogya-setus-updatedprivacy-policy/) · [SFLC.in — updated policy and ToS](https://sflc.in/our-analysis-aarogya-setus-updated-privacy-policy-and-terms-service/) · [IFF — outcomes from Aarogya Setu](https://internetfreedom.in/the-past-and-future-of-aarogya-setu/) · [Inc42 — updated privacy policies](https://inc42.com/?p=205549) · [ORF — Aarogya Setu's many conflicts](https://www.orfonline.org/expert-speak/aarogya-setu-app-many-conflicts-67442) · [CFR — a bridge too far](https://www.cfr.org/blog/indias-contact-tracing-app-bridge-too-far) · [NextIAS — data on Aarogya Setu (2023)](https://www.nextias.com/ca/current-affairs/11-02-2023/data-on-aarogya-setu) · [IISc case study](https://eecs.iisc.ac.in/?p=12468)

---

## 4.8 Duplicate SOS detection

### Findings
- **ST-DBSCAN** applied to 112 call data (GLONASS+112); DBSCAN on location and time for Waze incident clusters (best ε about 0.8 normalised); two-stage spatial-then-temporal aggregation for duplicate alerts.
- Patents on 911 call management note that large incidents *normally* produce many calls about the same event.

### Chosen approach
- **ST-clustering (DBSCAN-style, minPts = 1, i.e. single-linkage):** two reports link if they are within 120 m and 30 min, **or** share a building ID, **or** come from the same phone hash within 60 min. Text similarity (character-trigram Jaccard on transliteration-normalised text, Hindi plus English) adds linkage confidence, but **never** creates a link on its own.
- **People estimate:** group by phone; per-phone max count; `estimate = Σ per-phone max` (distinct households), with range `[max single report, Σ all reports]` shown to the operator.
- **Rule: a cluster is never rejected.** Forty SOS from one building is a genuine 40-person incident. A merge is reversible: the operator can *unmerge*, and every original report stays visible.

**Sources:** [Waze incident detection via Bayesian fusion + DBSCAN](https://arxiv.org/pdf/2011.05440) · [ST-DBSCAN for 112 calls](https://moit.vivt.ru/journal/article?id=1307) · [Duplicate alert aggregation (DBS&TCAN)](https://dc-china-simulation.researchcommons.org/journal/vol28/iss6/12) · [Emergency call management patent](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9258419)

---

## 4.9 Offline-first and degraded connectivity

### Chosen approach
- **Hand-written service worker** (`public/sw.js`): app-shell precache, network-first for `/api`, cache-first for static assets, and an offline fallback page.
- **IndexedDB outbox** (via `idb-keyval`). An SOS gets a client-generated ID and a `Queued → Sent → Received` state machine. It flushes on the `online` event, on `visibilitychange`, and on Background Sync where supported (Chromium only; other browsers fall back to the events).
- **Conflict resolution:** SOS submission is idempotent by client UUID (a server upsert). Status is server-authoritative. Rescuer field actions are append-only events with a client timestamp and a per-device Lamport counter, merged by `(lamport, deviceId)`. Since events are only ever appended and never overwritten, nothing needs CRDTs.
- **Stale data:** every live datum carries `asOf`. The UI shows "last updated X min ago" and greys out anything older than 2 minutes. *Stale data is never shown as live.*
- **SMS fallback (mocked):** `SOS <people> <urgency-letter> <pincode/landmark>` parsed by `/api/sms/inbound`, so it works on a feature phone.

**Sources:** [MDN — Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) · [MDN — Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) · [MDN — WebOTP API](https://developer.mozilla.org/en-US/docs/Web/API/WebOTP_API) · [web.dev — offline cookbook](https://web.dev/articles/offline-cookbook)

---

## 4.10 UI/UX references (Refero DESIGN.md extracts)

We used these strictly as inspiration: no logos, names or layouts copied.

| Ref | Key tokens extracted | What FloodSetu takes |
|---|---|---|
| **Mapbox** | Void `#0e1012` → Charcoal `#15171b` → Gunmetal `#1c1f24` → Graphite `#23262d` → Steel `#333943`; body text Fog `#a0aaba`, white only for headings; 4px badges; 100px pill buttons; "avoid button radii between 6 and 12px"; no drop shadows between layers | Neutral ramp (blue-shifted), body = fog, white reserved for headings and values, pill + 4px badge duality |
| **REKKI** | No drop shadows; cards use a **1px inset `rgba(255,255,255,0.12)` border**; surface steps of 3–5% luminance; mono labels at 12–13px with +0.035em tracking | Panel treatment: `box-shadow: inset 0 0 0 1px rgba(255,255,255,.07)`; mono uppercase labels |
| **Flighty** | Each signal colour has **one job**; notification cards with 20px radius, a 3px coloured left border, rotated −3°…+3°, scattered not gridded; 0.02–0.04 opacity shadows | Live status cards (SOS feed, landing orbit cards); signal-light discipline |
| **Incident** | Serif authority (Source Serif substitute), 1px black hairlines between sections instead of bands, severity shown by **tinted borders** not fills, the orange flare rationed | After-action report and assignment-log typography; hairline rules |
| **INVERSA** | Obsidian `#13140e`, bone text `#f4f3e8`, one neon marker; display type at line-height 0.90 with −0.03em tracking; **every label in JetBrains Mono**, uppercase | Landing hero typography; coordinate and tick labels in mono |
| **Active Theory** | UI stays achromatic so the WebGL world carries all colour; translucent pills with `backdrop-filter: blur(4px)`; opacity-led motion at 0.2–0.4 s | Landing chrome: hairline pills over the 3D scene |
| **Lusion** | Tactile pills with a `+`/dash tick before the label; depth from 3D, not from UI elevation; hover = opacity, not colour | CTA micro-interaction feel |
| **Raise** | Navy `#0c2764` as the only saturated colour; Inkwell `#0f172b` text; Frost border `#e2e8f0`; 12px radius; 32px card padding | Public ledger light mode |
| **Co2** | Paper white, rule gray `#d9d9d9`, serif display at weight 300; category data colours: teal `#00b595`, violet `#5077ff`, orange `#ff7b1b`, purple `#a545e0`; **no shadows** | Awareness pages; ledger chart category colours |

**Extra Refero finds:** *Raycast* ("midnight command center"), for its command-palette treatment ⌘K, and *Superhuman* ("editorial dashboard"), for keyboard-first density. Refero's search UI could not be queried programmatically: it has no URL query parameters, so only the homepage listings were checked.

### Synthesised direction (final)
- **Operational: "Monsoon night control room".** Blue-tinted near-black ramp `#080b0f / #0d1117 / #121821 / #18202b / #222c3a`. Body text `#9aa6b8`, headings `#eef2f7`. Signals carry meaning only: **SOS `#ff5a36`**, **water `#2ec5d3`**, **warning `#f2b33d`**, **safe `#3ccf8e`**, **verifying `#a48bff`**. The **primary CTA is achromatic** (a bone-white pill), so colour is never spent on decoration; the one exception is the SOS button, which is red because it *means* SOS.
- **Public: "Sunlit ledger".** White, navy `#0c2764`, frost borders, and the Co2 category colours for charts.
- **Type:** Geist (UI), Geist Mono (all IDs, coordinates, ticks, metrics with tabular numerals), Source Serif 4 (reports and the ledger). Noto Sans Devanagari for Hindi. All fonts are bundled from npm packages, so they work **offline**.

---

## Assumptions carried forward
See `DECISIONS.md` for every deviation and assumption.

---

## 4.11 Indian earth observation & latency (added after judges' review)

| Satellite | Operator | Sensor | Revisit / cadence | Latency in FloodSetu | Basis |
|---|---|---|---|---|---|
| **EOS-04 (RISAT-1A)** | ISRO | C-band SAR (MRS/CRS ScanSAR) | 17-day repeat (official brochure), so about one tasked pass per event | **110 min (modelled)** | NRSC district flood bulletins used EOS-04 MRS scenes. Maps appeared the same day to about 2 days after acquisition. No official end-to-end latency is published |
| **NISAR (S-band)** | ISRO (S-band) · NASA (L-band) | Dual-frequency SAR | 12-day repeat, about 6 days on average with ascending and descending passes | **95 min (modelled)** | Pre-launch JPL material gives about 24 h for standard products and a target under 5 h for disaster response |
| **INSAT-3DS + INSAT-3DR** | ISRO · IMD | Geostationary imager | 15-min imaging when staggered | **30 min** | MOSDAC lists IMSRA rainfall as half-hourly at about 4 km |
| **Resourcesat-2A** | ISRO | LISS-IV optical | about 5-day | 60 min (modelled) | Included to show why SAR matters: monsoon cloud makes optical flood scenes unusable |

**How it is used (real-time awareness of stale data):**
- Every product carries an **acquisition tick and an availability tick**. The UI always shows *data age* (now minus acquisition), never just "latest".
- **Fusion is last-writer-wins by observation time.** A SAR image only updates a neighbourhood if no fresher field or gauge reading exists. The event log shows the comparison per area: "GHT sat 2.15 vs field 1.98 m (field 12 min old, kept)".
- **Downlink is independent of local mobile networks.** Products still arrive during a comms blackout. The blackout scenario was extended so EOS-04 lands while the zone is dark.
- **Only river-front neighbourhoods have CWC-style gauges** (GHT, PRB, MCH). Inland areas rely on field reports and satellites, which is what makes earth observation matter.
- **INSAT rainfall works as a nowcast.** Intense rain (35 mm/h or more) sets an area *at risk* before the water rises.
- **Honesty:** pass times are compressed into the 6-hour scenario; the latencies are the realistic part.

**Sources:** [EOS-04 brochure (NRSC Bhoonidhi)](https://bhoonidhi.nrsc.gov.in/bhoonidhi_resources/help/docs/E04_BROUCHURE.pdf) · [NRSC Bihar flood bulletin (EOS-04 MRS)](https://ndrf.nrsc.gov.in/documents/Disaster_Document/2023/BR/brflood50dsc22082023_1800hrs/brflood50dsc22082023_1800hrs_report.pdf) · [Assam SDMA bulletin](https://asdma.assam.gov.in/sites/default/files/swf_utility_folder/departments/asdma_revenue_uneecopscloud_com_oid_70/this_comm/as_2023_31_08_report.pdf) · [EOS-04 flood mapping, NHESS 2025](https://nhess.copernicus.org/articles/25/2455/2025/) · [NISAR mission overview (JPL)](https://www.jpl.nasa.gov/press-kits/nisar/mission-overview) · [NISAR applications deck](https://wwao.jpl.nasa.gov/documents/123/WWAO-Annual-Meeting-Presentation-2024-WWAO-NISAR-20240501-BDowns.pdf) · [INSAT-3DR products (WMO)](https://www.wmo-sat.info/satellite-user-readiness/insat-3dr-data-products-and-applications/) · [INSAT-3DS operational products (MOSDAC)](https://mosdac.gov.in/docs/INSAT-3DS_Operational_Products_V1.pdf)

## 4.12 Dams, age and downstream risk

- The **National Register of Large Dams (NRLD-2023, CWC and NDSA)** lists 6,138 constructed and 143 under-construction large dams. Of these, **224 are more than 100 years old and 1,065 are 50–100 years old**, so about 1,289 are over 50. A May 2026 PIB note on 6,628 "specified" dams puts about 26% (1,681) at more than 50 years. The bases differ, so the two figures are not combined.
- FloodSetu models three **fictional** dams with NRLD-style fields: year of completion, type, height, capacity, spillway capacity, last inspection, and hazard class.
- **Explainable risk score** = age term (≥100 y: 0.5, ≥50 y: 0.35, ≥25 y: 0.15) + condition (unsatisfactory 0.35, needs attention 0.2) + hazard class (high 0.15, significant 0.08). Risk levels: ≥0.6 very high, ≥0.4 high, ≥0.2 moderate.
- The downstream neighbourhoods form the **risk zone**. It is shown hatched on the map, and requests inside it get V += 0.25 × zone value. A release or breach raises the zone to *very high*, and the reservoir level (% of full reservoir level) is tracked against rain.

**Sources:** [NRLD (CWC)](https://www.cwc.gov.in/sites/default/files/nrld06042018.pdf) · [PIB note, May 2026](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/may/doc2026515870801.pdf) · [196 dams over 100 years (2017)](https://www.governancenow.com/news/regular-story/-196-dams-in-india-are-100years-old)

## 4.13 "What if the phone drowns?"

1. **One tap, no form.** "I'm in the water" sends a CRITICAL SOS tagged `in_water`, with GPS if it can be obtained within 4 s, in about 200 bytes. It goes through the offline outbox.
2. **Heartbeat watchdog.** The citizen app's status polling doubles as a heartbeat. After **90 s of silence** on an active request, the server marks the device lost.
3. **Nothing is cancelled.** The incident keeps its last-known location and building cluster. It is upgraded to critical and escalated **in the same tick (invariant 10)**, and gets a V + 0.3 priority bump.
4. **Search, then call.** The team searches the last-known position, and the alternate number given at SOS time is called (mocked IVR/SMS).
5. **Battery early warning.** The Battery Status API is used where supported: at 10% or below, the last location is saved and the control room is warned.
6. **No smartphone at all.** The SMS fallback (`SOS 4 C landmark`) works, and 112 is one tap away.
