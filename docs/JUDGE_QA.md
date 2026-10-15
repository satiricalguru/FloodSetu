# Judge Q&A — "What if the phone drowns?"

Each answer is marked **Built** (working in FloodSetu today), **Mocked** (the flow exists, but the external service is simulated), or **Proposed** (needs real-world integration).

## A. The phone dies after the SOS was sent

**Q1. The phone drowns after sending an SOS. Is the request lost?**
No. **Built.** The request lives on the server and in the simulation, not on the phone. It keeps its last-known GPS location and building, and the assigned team still goes there.

**Q2. How do you know the phone died?**
**Built.** While help is on the way, the open app checks in every few seconds. After 90 seconds of silence on an active request, the server marks the device lost.

**Q3. What happens then?**
**Built.** In the same tick, the request is upgraded to **critical**, escalated to the control room, and given a priority boost. The map shows a "PHONE LOST · LAST KNOWN" ring. Safety rule 10 checks this every tick.

**Q4. How does the team find the person without the phone?**
**Built.** The team searches the last-known position and building cluster. Other SOS from the same building (neighbours) are already merged into the same incident, and they keep reporting.

**Q5. Can you contact the person some other way?**
**Mocked.** The SOS form has an optional alternate number (a family member's). When the phone goes silent, that number is called and an IVR/SMS callback goes out.

**Q6. What if the phone is only switched off, not dead?**
**Built.** When it reconnects, the timeline shows "Phone reconnected — tracking resumed". The request is never cancelled in either case.

## B. The phone is about to die

**Q7. Do you act before the phone dies?**
**Built.** The app reads battery level where the browser allows it. At 10% or below, the last location is saved and the control room is warned.

**Q8. What if the person is already in the water and can't type?**
**Built.** One tap on **"I'm in the water — send now"** sends a critical SOS with GPS. There is no form, the payload is about 200 bytes, and it retries automatically.

## C. The phone never worked, or the network is down

**Q9. No internet, but the phone works?**
**Built.** The SOS is saved on the phone in an outbox and sends itself when any signal returns. Status shows Queued, then Sent, then Received.

**Q10. Only basic SMS or a feature phone?**
**Built (mock gateway).** Texting `SOS 4 C near ghat 2` creates a normal request, and the system replies with a request ID. The SMS gateway itself is simulated.

**Q11. The phone is completely dead before any SOS. How does this person get reported?**
Through other people and other sensors:
- **Built:** neighbours, relatives or anyone nearby can send an SOS for them; it needs no login.
- **Built:** rescue teams file field reports from their own phones.
- **Built:** satellite radar shows which areas are flooded even where nobody reports.
- **Proposed:** calls to 112 (ERSS) fed in directly, and boat crews doing door-to-door sweeps of the high-risk zones.

**Q12. The whole area's mobile network is down?**
**Built.** The area is marked "verifying" and shows last-known information. Satellite images still arrive because they don't depend on local towers, and rescuer phones hold their reports until the network returns.

## D. Trust and edge cases

**Q13. Can a silent phone be mistaken for a dead phone?**
Yes. If someone closes the app, it looks the same as a dead phone. We escalate anyway, because a false alarm costs far less than a missed drowning. **Proposed:** carrier location and a call-back before escalating.

**Q14. Can someone abuse this with a fake SOS?**
Suspicious requests are flagged for review, never rejected. Critical ones are sent help regardless. Large unverified claims get a first wave of help until someone on site verifies them.

**Q15. What does the person see while waiting?**
**Built.** The app shows "If your phone gets wet or switches off, your request stays active at your last location", plus safety tips such as "move to the highest floor".

**Q16. What would real deployment need?**
**Proposed:** integration with 112/ERSS, cell-broadcast alerts (NDMA SACHET), carrier location lookup, a real IVR/SMS provider, and waterproof-pouch advice in public awareness campaigns.

## Demo
Phone: tap **I'm in the water**, then close the app. After about 90 seconds the control room shows "phone went silent", and the incident becomes critical with a "PHONE LOST" ring. Without a phone, use the Control Room dock: **Phone lost**.

## E. Language

**Q17. The person doesn't read English. Can they still send an SOS?**
**Built.** English is the default, Hindi is one tap away, and once the phone's GPS (or browser language) shows the state, the app offers that state's language, for example "Near West Bengal · বাংলা". There are 13 languages in all. The one-tap "I'm in the water" button and all status messages are translated. If the app ever sends a language it doesn't know, the SOS still goes through in English.
