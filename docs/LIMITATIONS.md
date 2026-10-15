# Limitations & what real deployment would need

## Data & world
- **Synthetic everything.** Jalnagar is a fictional 10 × 7 km grid town: 279 nodes and 496 edges. Elevations, populations, fleet and shelters are invented. The SOS stream is a seeded generator.
- **Flood model is scripted.** Per-neighbourhood water-level keyframes plus rain surges, mapped to depth by node elevation. There is no hydrodynamics (no flow direction, velocity or breach propagation). A real system would ingest CWC gauges, IMD rainfall and a hydraulic model (e.g. HEC-RAS or LISFLOOD outputs).
- **Passability thresholds** (ground ≤ 0.5 m, boats ≥ 0.4 m) are simplifications. Current speed, debris and night operations are not modelled.

## Agents & negotiation
- **CNP, not full CBBA.** Awards are settled one (task, bid) pair at a time, a greedy approximation. The bench shows a centralised Hungarian solver beating it on critical response by about 3% and in 2 of 6 scenarios. Next steps: CBBA consensus rounds, and multi-pickup trips (a boat collecting from 2–3 nearby sites).
- **IncidentAgents are hosted by the control room**, so CNP is "decentralised decision, centralised hosting". Peer-to-peer announcements over mesh radio are not modelled, which limits the blackout advantage we can show.
- **Messages are synchronous within a tick** (with deterministic loss). There is no multi-tick negotiation latency.
- **Ground transfer from boat landings to shelters is abstracted** as a shuttle. Ground teams are not explicitly dispatched for it.

## Uncertainty
- Source reliabilities are fixed constants. A learned trust model (Venanzi et al.) would adapt them per source.
- The contradiction rule is a threshold heuristic over log-odds, and Dempster–Shafer was not implemented. Verification tasks resolve conflicts; in some runs a contested edge stays unresolved if no verifier can reach it.

## Product / security
- **File-backed JSON stores** with in-process state. Production needs Postgres/PostGIS, a queue, and horizontal scaling. The live bridge uses 2-second polling; production would use WebSockets or a broker.
- **OTP SMS adapters are stubs** (mock provider only). Rate limits are in-memory.
- **Fraud detection is rule-based** and explainable, but untested against adversaries. The risk score only routes to review; it never blocks.
- **Payments are simulated.** The ledger is tamper-*evident*, not tamper-*proof*: there is a single writer and no external anchoring. Anchoring the head hash to a public timestamping service would fix that.
- **Map:** a Canvas2D renderer over synthetic geometry. A real deployment needs real basemaps (MapLibre and OSM) and geocoding.
- **Accessibility:** colour is never the only signal, focus states are visible, there are large touch targets, and reduced motion is respected. A full WCAG audit with screen readers has not been done.
- **i18n:** English (default) and Hindi are complete on the citizen, rescuer and awareness surfaces. The 11 regional languages (বাংলা, मराठी, తెలుగు, தமிழ், ગુજરાતી, ಕನ್ನಡ, മലയാളം, ਪੰਜਾਬੀ, ଓଡ଼ିଆ, অসমীয়া, اردو) cover the SOS and status path and short safety tips; anything else falls back to English. The regional strings are machine-quality first drafts and **need native-speaker review** before real use. State detection uses nearest state centroid, so border districts can get the neighbouring state's language (it is only a suggestion). Rescuer and awareness pages fall back to English for regional languages. The Control Room is English only. No voice/IVR in regional languages.

## Ethics
- No "expectant" triage category: a dispatch tool should not encode abandonment.
- Fairness is measured across neighbourhoods. Intersectional fairness (caste, gender, disability at the individual level) is out of scope, and would need community input before it could be in scope.

## Earth observation & dams (added)
- **Satellite products are simulated** from ground truth plus noise, with modelled latencies. Nothing is ingested from NRSC, Bhoonidhi, MOSDAC or ASF. A real system needs those APIs, SAR water-classification (e.g. thresholding or CNN on calibrated backscatter), and DEM-based depth estimation (CartoDEM).
- **Pass times are compressed** into a 6-hour scenario. EOS-04's real 17-day repeat means about one pass per event, and constellation tasking would be needed.
- **Dams are fictional.** The risk score is a transparent heuristic, not a structural safety assessment. Real use needs the NRLD export, DSARS inspection records, reservoir telemetry from CWC/state WRDs, and official dam-break inundation maps.
- **Device-lost detection relies on app heartbeats.** If the citizen closes the app, it looks the same as a dead phone. A real deployment would add carrier/ERSS location and a call-back before escalating.
- **Vercel hosting (floodsetu.vercel.app):** the demo runs with `JALSETU_DEMO=1` and stores data under `/tmp`, the only writable folder on Vercel. That storage is per serverless instance and is wiped when an instance recycles. SOS, field reports and the ledger can reset, and a phone and the Control Room may land on different instances, so the live phone ↔ control-room link is best-effort there. For the judged demo, run `pnpm dev` on a laptop (one process, one data store). A real deployment needs a shared database such as Postgres or Redis.
- **River gauges** are fictional stations with plausible CWC-style thresholds and rating curves. Real deployment would read CWC flood-forecasting stations (or state gauges) and calibrate each rating curve against discharge measurements.
- **Notifications** are *local*: the iPhone app polls the API and raises the notification itself. That works while the app is running or recently backgrounded. True background push needs APNs (iOS) or Web Push keys plus a server sender, and cell broadcast (SACHET) for phones without the app.
- **Family SMS** go through the mock gateway (`/dev/inbox`). A real SMS provider (MSG91 or Twilio adapter) and DLT-registered templates are needed for India.
- **Live GPS** updates the location the team sees and the request's track. The simulation keeps the incident at its original grid position, so it doesn't re-route a team mid-trip on a GPS move.

