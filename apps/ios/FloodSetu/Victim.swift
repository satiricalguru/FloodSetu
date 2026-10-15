import CoreLocation
import SwiftUI

// MARK: - Model

/// Victim state: SOS outbox (survives no-network + app restarts), my requests, location.
@MainActor @Observable
final class VictimModel: NSObject, CLLocationManagerDelegate {
    var requests: [SosRequest] = []
    var queued: [SosBody] = []
    var online = true
    var location: CLLocation?
    /// last SOS this phone sent — the form asks before sending another within 60 s (never blocks)
    var lastSentAt: Date? = UserDefaults.standard.object(forKey: "lastSentAt") as? Date
    var sharingLocation = false

    private let lm = CLLocationManager()
    private var lastFix: (CLLocation, Date)?
    private var lastStatus: [String: String] = [:]
    private var loop: Task<Void, Never>?

    override init() {
        super.init()
        if let d = UserDefaults.standard.data(forKey: "outbox"), let q = try? JSONDecoder().decode([SosBody].self, from: d) { queued = q }
        lm.delegate = self
        lm.desiredAccuracy = kCLLocationAccuracyBest
    }

    func start() {
        lm.requestWhenInUseAuthorization()
        lm.startUpdatingLocation()
        loop?.cancel()
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.tick()
                try? await Task.sleep(for: .seconds(3))
            }
        }
    }

    func stop() { loop?.cancel(); lm.stopUpdatingLocation() }

    /// Retry the outbox, then refresh my requests (each status read is also the phone's heartbeat).
    private func tick() async {
        for b in queued {
            if let r = try? await API.shared.sendSos(b) {
                queued.removeAll { $0.clientId == b.clientId }
                persist()
                merge(r)
            }
        }
        do {
            let mine = try await API.shared.myRequests()
            requests = mine.sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
            online = true
            notifyStatusChanges()
        } catch { online = false }
        await shareLocation()
    }

    /// Live GPS: while any request is open, send a fix every ≥ 20 s or ≥ 30 m moved, so the team follows the person.
    private func shareLocation() async {
        let active = requests.filter { $0.status != "resolved" }
        guard !active.isEmpty, let loc = location else { sharingLocation = false; return }
        if let (prev, at) = lastFix, Date().timeIntervalSince(at) < 20, loc.distance(from: prev) < 30 { return }
        var ok = false
        for r in active { if (try? await API.shared.sendLocation(r.id, lat: loc.coordinate.latitude, lng: loc.coordinate.longitude, accuracy: loc.horizontalAccuracy)) != nil { ok = true } }
        if ok { lastFix = (loc, Date()) }
        sharingLocation = ok
    }

    /// A notification when the rescue moves forward (team assigned, rescue in progress, safe).
    private func notifyStatusChanges() {
        for r in requests {
            defer { lastStatus[r.id] = r.status }
            guard let prev = lastStatus[r.id], prev != r.status else { continue }
            switch r.status {
            case "assigned": Notifier.shared.post(id: "\(r.id)-assigned", title: "Rescue team assigned", body: "\(r.team.map { "Team \($0.callsign)" } ?? "A team") is coming for \(r.id). Stay where you are if it is safe.")
            case "rescue_in_progress": Notifier.shared.post(id: "\(r.id)-progress", title: "Rescue in progress", body: "The team is at your location for \(r.id).")
            case "resolved": Notifier.shared.post(id: "\(r.id)-safe", title: "You are marked safe", body: "\(r.id) is resolved. If you still need help, send a new SOS.")
            default: break
            }
        }
    }

    /// Never fails from the user's point of view: if the network is down it is queued and sent later.
    /// Returns the request id, or the client id while queued.
    func send(people: Int, urgency: String, needs: [String], text: String? = nil, altPhone: String? = nil) async -> String {
        var b = SosBody(clientId: "ios-" + UUID().uuidString.lowercased(), people: people, urgency: urgency, needs: needs, text: text,
                        nbhd: "GHT", deviceId: Device.id, lang: "en", createdAt: API.shared.now, altPhone: altPhone)
        lastSentAt = Date()
        UserDefaults.standard.set(lastSentAt, forKey: "lastSentAt")
        if let l = location {
            b.lat = l.coordinate.latitude
            b.lng = l.coordinate.longitude
            b.accuracy = l.horizontalAccuracy
        }
        do {
            let r = try await API.shared.sendSos(b)
            merge(r)
            online = true
            return r.id
        } catch {
            queued.append(b)
            persist()
            online = false
            return b.clientId
        }
    }

    private func merge(_ r: SosRequest) {
        requests.removeAll { $0.id == r.id }
        requests.insert(r, at: 0)
    }

    private func persist() { UserDefaults.standard.set(try? JSONEncoder().encode(queued), forKey: "outbox") }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let l = locations.last
        Task { @MainActor in self.location = l }
    }
}

// MARK: - Home

struct VictimHome: View {
    let onSwitch: () -> Void
    @State private var model = VictimModel()
    @State private var path: [Route] = []
    @State private var sendingWater = false
    @State private var live = LiveInfo()

    enum Route: Hashable { case form, status(String) }

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 22) {
                    header
                    if let a = live.current { AlertBannerView(alert: a) { live.dismiss(a.id) } }
                    sosButton
                    waterButton
                    Call112()
                    if !live.river.isEmpty { RiverCardView(stations: live.river) }
                    if !model.queued.isEmpty || !model.requests.isEmpty { myRequests }
                    Label("Your exact location is shared only with the rescue team and deleted after rescue.", systemImage: "lock.fill")
                        .font(.footnote).foregroundStyle(Theme.mute)
                }
                .padding(20)
            }
            .background(Theme.bg)
            .navigationDestination(for: Route.self) { r in
                switch r {
                case .form: SosForm(model: model) { id in path = [.status(id)] }
                case .status(let id): StatusView(model: model, id: id)
                }
            }
        }
        .onAppear { model.start(); live.start(); Notifier.shared.setUp() }
        .onDisappear { model.stop(); live.stop() }
    }

    private var header: some View {
        HStack {
            Logo()
            Spacer()
            Label(model.online ? "Online" : "Offline", systemImage: model.online ? "wifi" : "wifi.slash")
                .font(.caption.weight(.medium))
                .foregroundStyle(model.online ? Theme.safe : Theme.warn)
            Button(action: onSwitch) { Text("Switch").font(.subheadline).foregroundStyle(Theme.mute).padding(.horizontal, 12).frame(minHeight: 44).contentShape(Rectangle()) }
        }
    }

    private var sosButton: some View {
        Button { path.append(.form) } label: {
            ZStack {
                Circle().fill(Theme.sos.opacity(0.12)).frame(width: 270, height: 270)
                Circle().fill(Theme.sos.opacity(0.22)).frame(width: 236, height: 236)
                Circle().fill(Theme.sos).frame(width: 200, height: 200).shadow(color: Theme.sos.opacity(0.5), radius: 24)
                VStack(spacing: 6) {
                    Text("SOS").font(.system(size: 58, weight: .heavy)).foregroundStyle(.white)
                    Text("Tap for emergency help").font(.subheadline.weight(.medium)).foregroundStyle(.white.opacity(0.92))
                }
            }
        }
        .buttonStyle(Pressable())
        .accessibilityLabel("SOS. Tap for emergency help")
        .padding(.top, 8)
    }

    /// One tap, no form: critical, 1 person, in the water, with GPS.
    private var waterButton: some View {
        VStack(spacing: 8) {
            Button {
                guard !sendingWater else { return }
                sendingWater = true
                UINotificationFeedbackGenerator().notificationOccurred(.warning)
                Task {
                    let id = await model.send(people: 1, urgency: "critical", needs: ["in_water"], text: "I am in the water — need help NOW")
                    sendingWater = false
                    path.append(.status(id))
                }
            } label: {
                HStack(spacing: 10) {
                    if sendingWater { ProgressView().tint(.white) } else { Image(systemName: "water.waves") }
                    Text("I'm in the water — send now")
                }
                .font(.title3.weight(.bold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 64)
                .background(Theme.water, in: Capsule())
            }
            .buttonStyle(Pressable())
            .accessibilityLabel("Emergency: I am in the water. Sends a critical SOS immediately with one tap")
            Text("One tap. No form. Sends your location as CRITICAL.")
                .font(.footnote).foregroundStyle(Theme.mute)
        }
    }

    private var myRequests: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("MY REQUESTS").font(.caption.weight(.semibold)).foregroundStyle(Theme.mute)
            ForEach(model.queued, id: \.clientId) { q in
                RequestRow(title: "Waiting for network", subtitle: "\(q.people) people · \(q.urgency.capitalized)", status: "Queued", color: Theme.warn)
            }
            ForEach(model.requests) { r in
                Button { path.append(.status(r.id)) } label: {
                    RequestRow(title: r.id, subtitle: "\(r.people ?? 1) people · \((r.urgency ?? "").capitalized)", status: Steps.label(r.status), color: Steps.color(r.status))
                }
            }
        }
    }
}

struct RequestRow: View {
    let title: String, subtitle: String, status: String, color: Color
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.monospaced().weight(.semibold)).foregroundStyle(Theme.text)
                Text(subtitle).font(.caption).foregroundStyle(Theme.mute)
            }
            Spacer()
            Text(status).font(.caption.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 5)
                .background(color.opacity(0.18), in: Capsule()).foregroundStyle(color)
        }
        .padding(14)
        .background(Theme.panel, in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Form: three questions, big targets

struct SosForm: View {
    let model: VictimModel
    let onSent: (String) -> Void
    @State private var urgency = "critical"
    @State private var people = 1
    @State private var needs: Set<String> = []
    @State private var sending = false
    @State private var familyPhone = ""
    @State private var askCooldown = false

    private let urgencies: [(String, String, String, String)] = [
        ("critical", "Critical", "Life in danger now", "exclamationmark.triangle.fill"),
        ("urgent", "Urgent", "Water rising, need evacuation", "arrow.up.to.line"),
        ("needs_help", "Need help", "Safe for now, need supplies", "hand.raised.fill"),
    ]
    private let needList: [(String, String, String)] = [
        ("elderly", "Elderly", "figure.walk.motion"), ("child", "Child", "figure.and.child.holdinghands"), ("pregnant", "Pregnant", "figure.stand"),
        ("disabled", "Disabled", "figure.roll"), ("medical", "Medical", "cross.case.fill"), ("injured", "Injured", "bandage.fill"), ("pets", "Pets", "pawprint.fill"), ("trapped", "Trapped", "building.2.crop.circle"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("1 · How urgent?").sectionTitle()
                ForEach(urgencies, id: \.0) { u in
                    Button { urgency = u.0 } label: {
                        HStack(spacing: 14) {
                            Image(systemName: u.3).font(.title2).foregroundStyle(Theme.urgency(u.0)).frame(width: 34)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(u.1).font(.headline).foregroundStyle(Theme.text)
                                Text(u.2).font(.subheadline).foregroundStyle(Theme.mute)
                            }
                            Spacer()
                            Image(systemName: urgency == u.0 ? "checkmark.circle.fill" : "circle")
                                .font(.title2).foregroundStyle(urgency == u.0 ? Theme.urgency(u.0) : Theme.mute)
                        }
                        .padding(16)
                        .background(Theme.panel, in: RoundedRectangle(cornerRadius: 18))
                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(urgency == u.0 ? Theme.urgency(u.0) : Theme.line, lineWidth: urgency == u.0 ? 2 : 1))
                    }
                    .buttonStyle(Pressable())
                }

                Text("2 · How many people?").sectionTitle()
                HStack {
                    StepButton(icon: "minus") { people = max(1, people - 1) }
                    Spacer()
                    Text("\(people)").font(.system(size: 44, weight: .bold, design: .rounded)).foregroundStyle(Theme.text).contentTransition(.numericText())
                    Spacer()
                    StepButton(icon: "plus") { people = min(50, people + 1) }
                }
                .padding(12)
                .background(Theme.panel, in: RoundedRectangle(cornerRadius: 18))

                Text("3 · Anyone needing special care?").sectionTitle()
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 4), spacing: 10) {
                    ForEach(needList, id: \.0) { n in
                        let on = needs.contains(n.0)
                        Button { if on { needs.remove(n.0) } else { needs.insert(n.0) } } label: {
                            VStack(spacing: 6) {
                                Image(systemName: n.2).font(.title3)
                                Text(n.1).font(.caption2.weight(.medium))
                            }
                            .frame(maxWidth: .infinity, minHeight: 72)
                            .foregroundStyle(on ? Theme.bg : Theme.text)
                            .background(on ? Theme.lime : Theme.panel, in: RoundedRectangle(cornerRadius: 14))
                        }
                        .accessibilityAddTraits(on ? .isSelected : [])
                    }
                }

                Text("4 · Family number (optional)").sectionTitle()
                TextField("We text them when help is sent and when you're safe", text: $familyPhone)
                    .keyboardType(.phonePad).textContentType(.telephoneNumber)
                    .padding(14).background(Theme.panel, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(Theme.text)

                Label(model.location != nil ? "Location attached" : "Finding your location… (we'll send your area anyway)",
                      systemImage: model.location != nil ? "location.fill" : "location")
                    .font(.footnote).foregroundStyle(model.location != nil ? Theme.safe : Theme.mute)
            }
            .padding(20)
            .padding(.bottom, 100)
        }
        .background(Theme.bg)
        .navigationTitle("Send SOS")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            Button {
                // cooldown: a second SOS within 60 s asks first — help is already coming — but "Send anyway" always goes through
                if let t = model.lastSentAt, Date().timeIntervalSince(t) < 60 { askCooldown = true } else { sendNow() }
            } label: {
                HStack { if sending { ProgressView().tint(.white) } else { Image(systemName: "paperplane.fill") }; Text(sending ? "Sending…" : "Send SOS") }
                    .font(.title3.weight(.bold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 60)
                    .background(Theme.sos, in: Capsule())
            }
            .buttonStyle(Pressable())
            .disabled(sending)
            .padding(.horizontal, 20).padding(.bottom, 8)
            .background(LinearGradient(colors: [Theme.bg.opacity(0), Theme.bg], startPoint: .top, endPoint: .center))
        }
        .confirmationDialog("You sent an SOS a moment ago", isPresented: $askCooldown, titleVisibility: .visible) {
            Button("Send anyway", role: .destructive) { sendNow() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Help is already on the way. Send another only if things got worse — it will update your open request.")
        }
    }

    private func sendNow() {
        sending = true
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        let digits = familyPhone.filter(\.isNumber)
        Task {
            let id = await model.send(people: people, urgency: urgency, needs: Array(needs), altPhone: digits.count >= 10 ? String(digits.suffix(12)) : nil)
            sending = false
            onSent(id)
        }
    }
}

struct StepButton: View {
    let icon: String, action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: icon).font(.title2.weight(.bold)).frame(width: 60, height: 60)
                .background(Theme.raised, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(Theme.text)
        }
        .buttonStyle(Pressable())
    }
}

extension Text {
    func sectionTitle() -> some View { self.font(.headline).foregroundStyle(Theme.text) }
}

// MARK: - Status

enum Steps {
    static let all = ["received", "verification_pending", "assigned", "rescue_in_progress", "resolved"]
    static func label(_ s: String) -> String {
        switch s {
        case "received": return "Received"
        case "verification_pending": return "Verifying"
        case "assigned": return "Team assigned"
        case "rescue_in_progress": return "Rescue in progress"
        case "resolved": return "Safe"
        case "needs_attention": return "Needs attention"
        default: return s.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
    static func color(_ s: String) -> Color {
        switch s { case "resolved": return Theme.safe; case "assigned", "rescue_in_progress": return Theme.info; default: return Theme.warn }
    }
}

struct StatusView: View {
    let model: VictimModel
    let id: String
    @State private var req: SosRequest?
    @State private var poll: Task<Void, Never>?
    @State private var lastOk: Date?

    private var isQueued: Bool { model.queued.contains { $0.clientId == id } }
    private var current: SosRequest? { req ?? model.requests.first { $0.id == id } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if isQueued {
                    Banner(icon: "tray.and.arrow.up.fill", text: "Queued — your SOS will send automatically as soon as there is any signal.", color: Theme.warn)
                } else if let r = current {
                    Text(r.id).font(.system(size: 34, weight: .bold, design: .monospaced)).foregroundStyle(Theme.text)
                    LiveChip(last: lastOk, serverStale: r.stale == true)
                    if r.status == "resolved" {
                        Banner(icon: "checkmark.seal.fill", text: "You're marked safe. If you still need help, send a new SOS.", color: Theme.safe)
                    }
                    steps(r)
                    if let t = r.team { teamCard(t, done: r.status == "resolved") }
                    if r.deviceLost != nil {
                        Banner(icon: "iphone.slash", text: "We lost contact with this phone. The team is still coming to your last location.", color: Theme.sos)
                    }
                    if r.status != "resolved", let tips = r.tips, !tips.isEmpty { tipsCard(tips) }
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(40)
                }
                if model.sharingLocation {
                    Label("Sharing live location with the team", systemImage: "location.fill.viewfinder").font(.footnote.weight(.medium)).foregroundStyle(Theme.safe)
                }
                Banner(icon: "drop.fill", text: "If your phone gets wet or switches off, your request stays active at your last location, is upgraded to critical, and the team is told.", color: Theme.info)
                Call112()
            }
            .padding(20)
        }
        .background(Theme.bg)
        .navigationTitle("Your request")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            poll = Task {
                while !Task.isCancelled {
                    if !isQueued, let r = try? await API.shared.status(id) { req = r; lastOk = Date() }
                    try? await Task.sleep(for: .seconds(3))
                }
            }
        }
        .onDisappear { poll?.cancel() }
    }

    private func steps(_ r: SosRequest) -> some View {
        let idx = Steps.all.firstIndex(of: r.status) ?? 0
        return VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(Steps.all.enumerated()), id: \.offset) { i, s in
                HStack(alignment: .top, spacing: 14) {
                    VStack(spacing: 0) {
                        Circle().fill(i <= idx ? Theme.safe : Theme.raised).frame(width: 22, height: 22)
                            .overlay(Image(systemName: "checkmark").font(.caption2.weight(.bold)).foregroundStyle(i <= idx ? Theme.bg : .clear))
                        if i < Steps.all.count - 1 { Rectangle().fill(i < idx ? Theme.safe : Theme.raised).frame(width: 2, height: 26) }
                    }
                    Text(Steps.label(s)).font(i == idx ? .headline : .body).foregroundStyle(i <= idx ? Theme.text : Theme.mute).padding(.top, 1)
                    Spacer()
                }
            }
        }
        .padding(18)
        .background(Theme.panel, in: RoundedRectangle(cornerRadius: 20))
    }

    private func teamCard(_ t: SosRequest.Team, done: Bool) -> some View {
        HStack(spacing: 14) {
            Image(systemName: t.role.lowercased().contains("boat") ? "ferry.fill" : "figure.run")
                .font(.title).foregroundStyle(Theme.info)
                .frame(width: 56, height: 56).background(Theme.info.opacity(0.15), in: RoundedRectangle(cornerRadius: 16))
            VStack(alignment: .leading, spacing: 3) {
                Text("Team \(t.callsign)").font(.headline).foregroundStyle(Theme.text)
                Text(t.role).font(.caption).foregroundStyle(Theme.mute)
            }
            Spacer()
            if done {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 34)).foregroundStyle(Theme.safe)
            } else if let eta = t.eta {
                VStack(alignment: .trailing, spacing: 0) {
                    Text(eta < 1 ? "Here" : "\(Int(eta.rounded()))").font(.system(size: 34, weight: .bold, design: .rounded)).foregroundStyle(Theme.text)
                    Text(eta < 1 ? "team arriving" : "min away").font(.caption).foregroundStyle(Theme.mute)
                }
            }
        }
        .padding(16)
        .background(Theme.panel, in: RoundedRectangle(cornerRadius: 20))
    }

    private func tipsCard(_ tips: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("WHILE YOU WAIT").font(.caption.weight(.semibold)).foregroundStyle(Theme.mute)
            ForEach(tips, id: \.self) { tip in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "checkmark.shield.fill").foregroundStyle(Theme.safe)
                    Text(tip).font(.callout).foregroundStyle(Theme.text)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.panel, in: RoundedRectangle(cornerRadius: 20))
    }
}

/// Shows the data is live: a pulsing dot plus "updated Ns ago" (re-rendered every second).
struct LiveChip: View {
    let last: Date?
    var serverStale = false
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let age = last.map { Int(ctx.date.timeIntervalSince($0)) }
            let fresh = (age ?? 99) < 10 && !serverStale
            HStack(spacing: 8) {
                Circle().fill(fresh ? Theme.safe : Theme.warn).frame(width: 8, height: 8)
                    .opacity(fresh && Int(ctx.date.timeIntervalSince1970) % 2 == 0 ? 0.35 : 1)
                Text(fresh ? "LIVE" : "LAST KNOWN").font(.caption.weight(.bold)).foregroundStyle(fresh ? Theme.safe : Theme.warn)
                Text(age.map { "updated \($0)s ago" } ?? "connecting…").font(.caption.monospacedDigit()).foregroundStyle(Theme.mute)
                if serverStale { Text("· control room offline").font(.caption).foregroundStyle(Theme.warn) }
            }
            .accessibilityElement(children: .combine)
        }
    }
}

struct Banner: View {
    let icon: String, text: String, color: Color
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon).foregroundStyle(color)
            Text(text).font(.callout).foregroundStyle(Theme.text)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
    }
}
