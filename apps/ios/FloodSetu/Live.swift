import SwiftUI
import UserNotifications

/// Local notifications for flood alerts and request status changes. (Real push would use APNs from the server;
/// the demo polls the same API and raises the notification on the phone — works offline-first and needs no Apple keys.)
final class Notifier: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Notifier()

    func setUp() {
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    func post(id: String, title: String, body: String, critical: Bool = false) {
        let c = UNMutableNotificationContent()
        c.title = title
        c.body = body
        c.sound = critical ? .defaultCritical : .default
        c.interruptionLevel = critical ? .timeSensitive : .active
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: c, trigger: nil))
    }

    // show banners even while the app is open — an alert must never be silent
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }
}

/// Polls flood alerts + river gauges; raises a notification for each new alert issued in the last 10 minutes.
@MainActor @Observable
final class LiveInfo {
    var alerts: [FloodAlert] = []
    var river: [RiverStation] = []
    private var seen = Set(UserDefaults.standard.stringArray(forKey: "alertsSeen") ?? [])
    private var notified = Set(UserDefaults.standard.stringArray(forKey: "alertsNotified") ?? [])
    private var loop: Task<Void, Never>?
    private let iso: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()

    var current: FloodAlert? { alerts.first { !seen.contains($0.id) } }

    func start() {
        loop?.cancel()
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.pull()
                try? await Task.sleep(for: .seconds(15))
            }
        }
    }
    func stop() { loop?.cancel() }

    /// closing the newest alert acknowledges every older one too — nobody should tap ✕ through a backlog in a flood
    func dismiss(_ id: String) {
        seen.insert(id)
        seen.formUnion(alerts.map(\.id))
        UserDefaults.standard.set(Array(seen.suffix(200)), forKey: "alertsSeen")
    }

    private func pull() async {
        if let a = try? await API.shared.alerts() {
            let recent = a.filter { (iso.date(from: $0.at).map { Date().timeIntervalSince($0) } ?? .infinity) < 6 * 3600 }
            alerts = recent
            for x in recent where !notified.contains(x.id) {
                notified.insert(x.id)
                let age = iso.date(from: x.at).map { Date().timeIntervalSince($0) } ?? .infinity
                if age < 600 { Notifier.shared.post(id: x.id, title: x.headline, body: x.text, critical: x.severity == "Extreme") }
            }
            UserDefaults.standard.set(Array(notified.suffix(300)), forKey: "alertsNotified")
        }
        if let r = try? await API.shared.river() { river = r }
    }
}

struct AlertBannerView: View {
    let alert: FloodAlert
    let onDismiss: () -> Void
    private var tone: Color { alert.severity == "Extreme" ? Theme.sos : alert.severity == "Severe" ? Theme.warn : Theme.info }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill").font(.title3).foregroundStyle(tone)
            VStack(alignment: .leading, spacing: 4) {
                Text("FLOOD ALERT · \(alert.area.uppercased())").font(.caption2.weight(.bold)).foregroundStyle(tone)
                Text(alert.headline).font(.headline).foregroundStyle(Theme.text)
                Text(alert.text).font(.subheadline).foregroundStyle(Theme.text.opacity(0.85))
            }
            Spacer(minLength: 0)
            Button(action: onDismiss) { Image(systemName: "xmark").font(.callout.weight(.semibold)).foregroundStyle(Theme.mute).frame(width: 36, height: 36) }
                .accessibilityLabel("Dismiss alert")
        }
        .padding(16)
        .background(tone.opacity(0.14), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(tone.opacity(0.4)))
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

struct RiverCardView: View {
    let stations: [RiverStation]
    private func tone(_ s: String) -> Color { s == "danger" || s == "extreme" ? Theme.sos : s == "warning" ? Theme.warn : s == "normal" ? Theme.safe : Theme.mute }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("RIVER NOW", systemImage: "water.waves").font(.caption.weight(.semibold)).foregroundStyle(Theme.mute)
            ForEach(stations) { g in
                HStack(spacing: 8) {
                    Text(g.name).font(.subheadline).foregroundStyle(Theme.text).lineLimit(1)
                    Spacer()
                    Text(g.stage.map { String(format: "%.2f m", $0) } ?? "—").font(.subheadline.monospacedDigit()).foregroundStyle(Theme.text)
                    Text(g.trendCmHr > 2 ? "↑\(Int(g.trendCmHr))" : g.trendCmHr < -2 ? "↓\(Int(-g.trendCmHr))" : "→")
                        .font(.caption.monospacedDigit()).foregroundStyle(Theme.mute).frame(width: 40, alignment: .trailing)
                    Text(g.status == "no_data" ? "NO DATA" : g.status.uppercased()).font(.caption2.weight(.bold)).foregroundStyle(tone(g.status)).frame(width: 70, alignment: .trailing)
                }
                .accessibilityElement(children: .combine)
            }
            Text("Trend in cm per hour · updated from river gauges every 10 min").font(.caption2).foregroundStyle(Theme.mute)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.panel, in: RoundedRectangle(cornerRadius: 18))
    }
}
