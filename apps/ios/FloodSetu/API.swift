import Foundation

/// Talks to the same Next.js API as the web apps (`apps/web/src/app/api`). No new backend.
/// Simulator: http://localhost:3000 reaches the laptop. Real phone: set the laptop's LAN address in Settings.
enum Server {
    static var base: URL {
        let s = UserDefaults.standard.string(forKey: "serverURL") ?? "http://localhost:3000"
        return URL(string: s) ?? URL(string: "http://localhost:3000")!
    }
}

/// Stable per-install id, used to find "my requests" and for the heartbeat watchdog (raw id never stored server-side).
enum Device {
    static var id: String {
        if let d = UserDefaults.standard.string(forKey: "deviceId") { return d }
        let d = "ios-" + UUID().uuidString.lowercased()
        UserDefaults.standard.set(d, forKey: "deviceId")
        return d
    }
}

// MARK: - Victim models (mirror citizenView in server/dispatch/service.ts)

struct SosRequest: Codable, Identifiable, Equatable {
    let id: String
    let status: String
    let createdAt: String?
    let people: Int?
    let urgency: String?
    let team: Team?
    let tips: [String]?
    let stale: Bool?
    let deviceLost: Bool?
    let timeline: [TimelineItem]?

    struct Team: Codable, Equatable {
        let role: String
        let callsign: String
        let eta: Double?
    }
    struct TimelineItem: Codable, Equatable {
        let status: String
        let at: String
        let note: String?
    }
}

struct SosBody: Codable {
    let clientId: String
    let people: Int
    let urgency: String
    let needs: [String]
    var text: String?
    var lat: Double?
    var lng: Double?
    var accuracy: Double?
    let nbhd: String
    let deviceId: String
    let lang: String
    let createdAt: String
}

// MARK: - Rescuer models (mirror GET /api/dispatch/rescuer)

struct RescuerFeed: Codable {
    let unitId: String?
    let unit: Unit?
    let liveSos: [LiveSos]?
    let stale: Bool?
    let asOf: String?

    struct Unit: Codable {
        let id: String
        let name: String?
        let type: String
        let status: String
        let onboard: Int
        let capacity: Int
        let fuel: Double?
        let connected: Bool?
        let x: Double
        let y: Double
        let task: Task?
    }
    struct Task: Codable {
        let id: String
        let kind: String
        let incident: String?
        let people: Int
        let urgency: String
        let needs: [String]
        let phase: String
        let eta: Double?
        let site: Point
        let shelter: Shelter?
        let why: String?
    }
    struct Point: Codable { let x: Double; let y: Double }
    struct Shelter: Codable { let id: String; let name: String }
    struct LiveSos: Codable, Identifiable {
        let id: String
        let people: Int
        let text: String?
        let handle: String
    }
}

struct FieldBody: Codable {
    let kind: String
    var taskId: String?
    var incident: String?
    var reason: String?
    var note: String?
    var count: Int?
    let lamport: Int
    let deviceId: String
    let clientAt: String
}

enum APIError: Error { case http(Int), offline }

final class API {
    static let shared = API()
    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 8
        c.httpCookieStorage = .shared // keeps js_at / js_rt / js_csrf exactly like a browser
        c.httpShouldSetCookies = true
        return URLSession(configuration: c)
    }()
    private let iso = ISO8601DateFormatter()

    private func url(_ path: String, _ query: [URLQueryItem] = []) -> URL {
        var c = URLComponents(url: Server.base.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { c.queryItems = query }
        return c.url!
    }

    private var csrf: String? {
        HTTPCookieStorage.shared.cookies(for: Server.base)?.first { $0.name == "js_csrf" }?.value
    }

    private func send<T: Decodable>(_ method: String, _ path: String, query: [URLQueryItem] = [], body: Encodable? = nil, as: T.Type) async throws -> T {
        var r = URLRequest(url: url(path, query))
        r.httpMethod = method
        if let body {
            r.setValue("application/json", forHTTPHeaderField: "content-type")
            r.httpBody = try JSONEncoder().encode(body)
        }
        if method != "GET", let csrf { r.setValue(csrf, forHTTPHeaderField: "x-csrf") }
        let data: Data, resp: URLResponse
        do { (data, resp) = try await session.data(for: r) } catch { throw APIError.offline }
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else { throw APIError.http(code) }
        return try JSONDecoder().decode(T.self, from: data)
    }

    var now: String { iso.string(from: Date()) }

    // Victim
    private struct SosResp: Decodable { let request: SosRequest }
    private struct ListResp: Decodable { let requests: [SosRequest] }
    func sendSos(_ b: SosBody) async throws -> SosRequest { try await send("POST", "api/dispatch/sos", body: b, as: SosResp.self).request }
    /// Each poll doubles as the phone's heartbeat (server marks a silent phone "lost" after 90 s and escalates).
    func status(_ id: String) async throws -> SosRequest {
        try await send("GET", "api/dispatch/sos/\(id)", query: [.init(name: "device", value: Device.id)], as: SosResp.self).request
    }
    func myRequests() async throws -> [SosRequest] {
        try await send("GET", "api/dispatch/sos", query: [.init(name: "device", value: Device.id)], as: ListResp.self).requests
    }

    // Rescuer
    private struct Ok: Decodable { let ok: Bool? }
    func demoSignIn(unit: String) async throws {
        struct B: Encodable { let role = "rescuer"; let unit: String }
        _ = try await send("POST", "api/auth/demo", body: B(unit: unit), as: Ok.self)
    }
    func signOut() async {
        _ = try? await send("POST", "api/auth/logout", as: Ok.self)
        HTTPCookieStorage.shared.cookies(for: Server.base)?.forEach { HTTPCookieStorage.shared.deleteCookie($0) }
    }
    func feed() async throws -> RescuerFeed { try await send("GET", "api/dispatch/rescuer", as: RescuerFeed.self) }
    func field(_ b: FieldBody) async throws { _ = try await send("POST", "api/dispatch/rescuer", body: b, as: Ok.self) }
}
