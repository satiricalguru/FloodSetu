# FloodSetu for iPhone

A native SwiftUI app with two simple modes, picked on first launch:

| I need help (victim) | I'm a rescuer |
|---|---|
| Giant **SOS** button, then three big questions: how urgent, how many people, special care. | Tap your unit to sign in (demo). |
| **I'm in the water — send now**: one tap, no form, critical + GPS. | One task card: incident, people, ETA, shelter, and **Why you?** |
| Live status steps (Received → Verifying → Team assigned → Rescue in progress → Safe), the team's callsign and ETA, and safety tips. | Big buttons: Accept · On my way · On site · Picked up (count) · Dropped off · Can't do it (reason). |
| **Offline outbox**: no signal? The SOS is saved and sends itself when the network returns. | Report what you see: road blocked, water rising, bridge damaged. |
| Every status poll is the phone's heartbeat (the 90 s "phone drowned" watchdog). | Retries are safe: events are idempotent by (device, lamport). |
| **Flood alerts**: banner plus local notifications for automatic river and dam alerts, and notifications when a team is assigned, rescue starts, and you're safe. | **Navigate to victim**: the victim's live GPS on a map, with turn-by-turn in Apple Maps. |
| **River now**: stage, trend and status for each gauge. **Live GPS** while a request is open. | **Rescue engineers** (G-16, G-17) for people trapped in damaged buildings. |
| **Cooldown**: a second SOS within 60 s asks first, and "Send anyway" updates the open request. Optional **family number** gets SMS updates. | |

**No new backend.** The app calls the same Next.js API as the web apps: `/api/dispatch/sos`, `/api/dispatch/sos/:id`, `/api/auth/demo` and `/api/dispatch/rescuer`. It uses the same cookies and the same CSRF header, so the Control Room sees iPhone SOS and acknowledgements exactly like the web ones.

## Run

1. Start the web app from the repo root, then open `/control` in a browser so the simulation is live:
   ```bash
   pnpm dev
   ```
2. Open `apps/ios/FloodSetu.xcodeproj` in Xcode, pick an iPhone simulator, and press **Run**. Or from the terminal:
   ```bash
   xcodebuild -project apps/ios/FloodSetu.xcodeproj -scheme FloodSetu -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath apps/ios/build CODE_SIGNING_ALLOWED=NO build
   ```

The simulator reaches the laptop at `http://localhost:3000`. On a **real iPhone**, tap ⚙︎ on the first screen and enter the laptop's *Network* address that `pnpm dev` prints, for example `http://192.168.1.10:3000`.

## Notes

- iOS 17+, SwiftUI, no third-party packages. Plain HTTP is allowed only because the demo server runs on a laptop or LAN (`FloodSetu-Info.plist`).
- Demo sign-in for rescuers mirrors the web `/rescuer` page. Real deployments would use the OTP flow, which the API already supports.
- English only for now. The web SOS page has 13 languages.
