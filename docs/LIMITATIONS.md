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
- **i18n:** English and Hindi for the citizen, rescuer and awareness surfaces. The Control Room is English only.

## Ethics
- No "expectant" triage category: a dispatch tool should not encode abandonment.
- Fairness is measured across neighbourhoods. Intersectional fairness (caste, gender, disability at the individual level) is out of scope, and would need community input before it could be in scope.
