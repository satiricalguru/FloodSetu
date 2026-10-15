import SwiftUI

// MARK: - Model

@MainActor @Observable
final class RescuerModel {
    var unitId: String? = UserDefaults.standard.string(forKey: "unit")
    var feed: RescuerFeed?
    var online = true
    var lastSent: String?
    private var loop: Task<Void, Never>?
    private var lamport = UserDefaults.standard.integer(forKey: "lamport")

    func signIn(_ unit: String) async -> Bool {
        do {
            try await API.shared.demoSignIn(unit: unit)
            unitId = unit
            UserDefaults.standard.set(unit, forKey: "unit")
            start()
            return true
        } catch { online = false; return false }
    }

    func signOut() async {
        loop?.cancel()
        await API.shared.signOut()
        unitId = nil
        feed = nil
        UserDefaults.standard.removeObject(forKey: "unit")
    }

    func start() {
        loop?.cancel()
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.pull()
                try? await Task.sleep(for: .seconds(2.5))
            }
        }
    }
    func stop() { loop?.cancel() }

    private func pull() async {
        do {
            feed = try await API.shared.feed()
            online = true
        } catch APIError.http(401) {
            // short-lived session expired: demo mode simply signs the same unit in again
            if let u = unitId { _ = try? await API.shared.demoSignIn(unit: u) }
        } catch { online = false }
    }

    /// Field events are idempotent by (deviceId, lamport), so a retry can never double-count.
    func send(_ kind: String, note: String? = nil, reason: String? = nil, count: Int? = nil, label: String) {
        lamport += 1
        UserDefaults.standard.set(lamport, forKey: "lamport")
        let t = feed?.unit?.task
        let body = FieldBody(kind: kind, taskId: t?.id, incident: t?.incident, reason: reason, note: note, count: count,
                             lamport: lamport, deviceId: Device.id, clientAt: API.shared.now)
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        Task {
            for attempt in 0..<5 {
                do { try await API.shared.field(body); lastSent = "✓ \(label) sent"; return }
                catch { lastSent = "Queued: \(label) — retrying"; try? await Task.sleep(for: .seconds(Double(2 << attempt))) }
            }
        }
    }
}

// MARK: - Root

struct RescuerRoot: View {
    let onSwitch: () -> Void
    @State private var model = RescuerModel()

    var body: some View {
        Group {
            if model.unitId == nil { UnitPicker(model: model, onSwitch: onSwitch) } else { TaskScreen(model: model) }
        }
        .onAppear { if model.unitId != nil { model.start() } }
        .onDisappear { model.stop() }
    }
}

struct UnitPicker: View {
    let model: RescuerModel
    let onSwitch: () -> Void
    @State private var busy: String?
    @State private var failed = false

    private let boats = (1...8).map { "B-\($0)" }
    private let ground = (1...15).map { String(format: "G-%02d", $0) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Logo()
                    Spacer()
                    Button(action: onSwitch) { Text("Switch").font(.subheadline).foregroundStyle(Theme.mute).padding(.horizontal, 12).frame(minHeight: 44).contentShape(Rectangle()) }
                }
                Text("Which unit are you?").font(.system(size: 28, weight: .bold)).foregroundStyle(Theme.text)
                Text("Demo sign-in. In the field each phone is pre-registered to its unit with OTP.")
                    .font(.subheadline).foregroundStyle(Theme.mute)
                if failed { Banner(icon: "wifi.slash", text: "Can't reach the control room. Check the server in Settings.", color: Theme.warn) }
                group("BOATS", boats, icon: "ferry.fill")
                group("GROUND TEAMS", ground, icon: "figure.run")
            }
            .padding(20)
        }
        .background(Theme.bg)
    }

    private func group(_ title: String, _ ids: [String], icon: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.caption.weight(.semibold)).foregroundStyle(Theme.mute)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 4), spacing: 10) {
                ForEach(ids, id: \.self) { id in
                    Button {
                        busy = id
                        Task { failed = !(await model.signIn(id)); busy = nil }
                    } label: {
                        VStack(spacing: 4) {
                            if busy == id { ProgressView() } else { Image(systemName: icon).font(.callout) }
                            Text(id).font(.callout.monospaced().weight(.semibold))
                        }
                        .frame(maxWidth: .infinity, minHeight: 64)
                        .foregroundStyle(Theme.text)
                        .background(Theme.panel, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line))
                    }
                    .buttonStyle(Pressable())
                }
            }
        }
    }
}

// MARK: - Task screen: one card, big buttons

struct TaskScreen: View {
    let model: RescuerModel
    @State private var pickCount = 0
    @State private var askUnable = false

    var body: some View {
        let u = model.feed?.unit
        let task = u?.task
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header(u)
                if model.feed?.stale == true {
                    Banner(icon: "clock.badge.exclamationmark", text: "Last known — control room link is stale.", color: Theme.warn)
                }
                if let task, let u {
                    taskCard(task, u)
                    actions(task, u)
                } else {
                    VStack(spacing: 12) {
                        Image(systemName: "checkmark.seal.fill").font(.system(size: 44)).foregroundStyle(Theme.safe)
                        Text("No task right now").font(.title3.weight(.semibold)).foregroundStyle(Theme.text)
                        Text(u == nil ? "Waiting for the control room to come online…" : "Stand by. New work appears here automatically.")
                            .font(.subheadline).foregroundStyle(Theme.mute).multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 40)
                    .background(Theme.panel, in: RoundedRectangle(cornerRadius: 22))
                }
                reports
                if let u { stats(u) }
                if let s = model.lastSent { Text(s).font(.footnote).foregroundStyle(s.hasPrefix("✓") ? Theme.safe : Theme.warn) }
            }
            .padding(20)
        }
        .background(Theme.bg)
        .confirmationDialog("Why can't you do it?", isPresented: $askUnable, titleVisibility: .visible) {
            ForEach(["Engine failure", "Route blocked", "Crew injured", "Out of fuel"], id: \.self) { r in
                Button(r, role: .destructive) { model.send("unable", reason: r, label: "Unable (\(r))") }
            }
        }
    }

    private func header(_ u: RescuerFeed.Unit?) -> some View {
        HStack {
            Image(systemName: u?.type == "boat" ? "ferry.fill" : "figure.run").foregroundStyle(Theme.info)
            Text(model.unitId ?? "").font(.title3.monospaced().weight(.bold)).foregroundStyle(Theme.text)
            if let s = u?.status {
                Text(s.replacingOccurrences(of: "_", with: " ")).font(.caption.weight(.medium))
                    .padding(.horizontal, 8).padding(.vertical, 4).background(Theme.raised, in: Capsule()).foregroundStyle(Theme.mute)
            }
            Spacer()
            Image(systemName: model.online ? "wifi" : "wifi.slash").foregroundStyle(model.online ? Theme.safe : Theme.warn)
            Button { Task { await model.signOut() } } label: { Text("Sign out").font(.subheadline).foregroundStyle(Theme.mute).padding(.horizontal, 10).frame(minHeight: 44).contentShape(Rectangle()) }
        }
    }

    private func taskCard(_ t: RescuerFeed.Task, _ u: RescuerFeed.Unit) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(t.urgency.replacingOccurrences(of: "_", with: " ").uppercased())
                    .font(.caption.weight(.bold)).padding(.horizontal, 10).padding(.vertical, 5)
                    .background(Theme.urgency(t.urgency), in: Capsule()).foregroundStyle(.white)
                Text(t.kind).font(.caption.monospaced()).foregroundStyle(Theme.mute)
                Spacer()
                Text(t.phase.replacingOccurrences(of: "_", with: " ")).font(.caption).foregroundStyle(Theme.mute)
            }
            HStack(alignment: .lastTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(t.incident ?? t.id).font(.system(size: 34, weight: .bold, design: .monospaced)).foregroundStyle(Theme.text)
                    Text("\(t.people) people" + (t.needs.isEmpty ? "" : " · " + t.needs.joined(separator: ", ").replacingOccurrences(of: "_", with: " ")))
                        .font(.body).foregroundStyle(Theme.text)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 0) {
                    Text("\(Int((t.eta ?? 0).rounded()))").font(.system(size: 40, weight: .bold, design: .rounded)).foregroundStyle(Theme.text)
                    Text("min").font(.caption).foregroundStyle(Theme.mute)
                }
            }
            if let s = t.shelter { Label("Drop at \(s.name)", systemImage: "house.fill").font(.subheadline).foregroundStyle(Theme.safe) }
            if let why = t.why {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "info.circle.fill").foregroundStyle(Theme.info)
                    (Text("Why you? ").bold() + Text(why)).font(.subheadline).foregroundStyle(Theme.text)
                }
            }
            ForEach(model.feed?.liveSos ?? []) { s in
                Text("\(s.id) · \(s.people) · \(s.text ?? "")").font(.caption).foregroundStyle(Theme.mute)
                    .padding(8).frame(maxWidth: .infinity, alignment: .leading).background(Theme.raised, in: RoundedRectangle(cornerRadius: 10))
            }
        }
        .padding(18)
        .background(Theme.panel, in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(Theme.urgency(t.urgency).opacity(0.5)))
    }

    private func actions(_ t: RescuerFeed.Task, _ u: RescuerFeed.Unit) -> some View {
        VStack(spacing: 10) {
            ActionButton(title: "Accept task", icon: "checkmark", style: .primary) { model.send("ack", label: "Accept") }
            HStack(spacing: 10) {
                ActionButton(title: "On my way", icon: "location.north.fill") { model.send("status", note: "en route", label: "On my way") }
                ActionButton(title: "On site", icon: "mappin.circle.fill") { model.send("status", note: "on site", label: "On site") }
            }
            HStack(spacing: 10) {
                HStack(spacing: 6) {
                    Button { pickCount = max(0, pickCount - 1) } label: { Image(systemName: "minus").frame(width: 40, height: 44) }
                    Text("\(pickCount)").font(.title3.monospaced().weight(.bold)).frame(minWidth: 28)
                    Button { pickCount = min(u.capacity, pickCount + 1) } label: { Image(systemName: "plus").frame(width: 40, height: 44) }
                    Button("Picked up") { model.send("picked_up", count: pickCount, label: "Picked up \(pickCount)") }
                        .font(.subheadline.weight(.semibold)).padding(.horizontal, 10).frame(height: 44)
                        .background(Theme.lime, in: RoundedRectangle(cornerRadius: 12)).foregroundStyle(Theme.bg)
                }
                .foregroundStyle(Theme.text)
                .padding(6).frame(maxWidth: .infinity)
                .background(Theme.panel, in: RoundedRectangle(cornerRadius: 16))
            }
            HStack(spacing: 10) {
                ActionButton(title: "Dropped off", icon: "house.fill") { model.send("dropped", count: u.onboard, label: "Dropped") }
                ActionButton(title: "Can't do it", icon: "xmark", style: .danger) { askUnable = true }
            }
        }
    }

    private var reports: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("REPORT WHAT YOU SEE").font(.caption.weight(.semibold)).foregroundStyle(Theme.mute)
            HStack(spacing: 10) {
                ActionButton(title: "Road blocked", icon: "road.lanes", compact: true) { model.send("road_blocked", label: "Road blocked") }
                ActionButton(title: "Water rising", icon: "water.waves", compact: true) { model.send("water_level", note: "water rising here", label: "Water rising") }
                ActionButton(title: "Bridge damaged", icon: "exclamationmark.triangle", compact: true) { model.send("bridge_damaged", label: "Bridge damaged") }
            }
        }
    }

    private func stats(_ u: RescuerFeed.Unit) -> some View {
        HStack {
            stat("Free seats", "\(u.capacity - u.onboard)/\(u.capacity)")
            Spacer()
            stat("Fuel", u.fuel.map { "\(Int($0)) min" } ?? "—", warn: (u.fuel ?? 999) < 60)
            Spacer()
            stat("On board", "\(u.onboard)")
        }
        .padding(16)
        .background(Theme.panel, in: RoundedRectangle(cornerRadius: 18))
    }

    private func stat(_ k: String, _ v: String, warn: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(k.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(Theme.mute)
            Text(v).font(.title3.monospaced().weight(.semibold)).foregroundStyle(warn ? Theme.warn : Theme.text)
        }
    }
}

struct ActionButton: View {
    enum Style { case normal, primary, danger }
    let title: String, icon: String
    var style: Style = .normal
    var compact = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if compact {
                    VStack(spacing: 6) { Image(systemName: icon).font(.title3); Text(title).font(.caption.weight(.medium)).multilineTextAlignment(.center) }
                } else {
                    HStack(spacing: 8) { Image(systemName: icon); Text(title) }.font(.headline)
                }
            }
            .frame(maxWidth: .infinity, minHeight: compact ? 76 : 58)
            .foregroundStyle(style == .primary ? Theme.bg : style == .danger ? Theme.sos : Theme.text)
            .background(style == .primary ? Theme.lime : style == .danger ? Theme.sos.opacity(0.15) : Theme.panel, in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(Pressable())
    }
}
