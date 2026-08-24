import Foundation

/// One row-level change delivered by Supabase Realtime.
struct RealtimeChange: Sendable {

    enum Kind: String, Sendable {
        case insert = "INSERT"
        case update = "UPDATE"
        case delete = "DELETE"
    }

    let kind: Kind
    let table: String
    /// The new row, as JSON. Absent on delete.
    let record: Data?
    /// The previous row. On delete this carries the primary key only, unless
    /// the table has REPLICA IDENTITY FULL.
    let oldRecord: Data?

    /// Decodes the new row into a model.
    func decoded<T: Decodable>(_ type: T.Type) -> T? {
        guard let record else { return nil }
        return try? JSONDecoder.supabase.decode(T.self, from: record)
    }

    /// The id of the affected row, for applying a delete locally.
    var recordID: String? {
        for payload in [record, oldRecord] {
            guard
                let payload,
                let object = try? JSONSerialization.jsonObject(with: payload) as? [String: Any],
                let id = object["id"] as? String
            else { continue }
            return id
        }
        return nil
    }
}

/// A live connection to Supabase Realtime.
///
/// Speaks the Phoenix channel protocol directly over `URLSessionWebSocketTask`,
/// matching what the web app gets from `supabase-js`: one socket, many topics,
/// heartbeats, and reconnection with backoff.
///
/// Subscribers get an `AsyncStream`, so a screen listens with a `for await`
/// loop inside `.task` and the subscription tears itself down when the screen
/// goes away — no manual unsubscribe to forget.
actor RealtimeClient {

    static let shared = RealtimeClient()

    private struct Subscription {
        let topic: String
        let table: String
        let filter: String?
        let continuation: AsyncStream<RealtimeChange>.Continuation
    }

    private var socket: URLSessionWebSocketTask?
    private var subscriptions: [UUID: Subscription] = [:]
    private var refCounter = 0
    private var heartbeat: Task<Void, Never>?
    private var receiveLoop: Task<Void, Never>?
    private var reconnectAttempt = 0
    private var isConnected = false

    private let session: URLSession

    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        // A realtime socket must not be killed by the resource timeout.
        configuration.timeoutIntervalForResource = .infinity
        session = URLSession(configuration: configuration)
    }

    // MARK: - Public API

    /// Streams changes for one table, optionally narrowed by a PostgREST-style
    /// filter such as `project_id=eq.<uuid>`.
    func changes(table: String, filter: String? = nil) -> AsyncStream<RealtimeChange> {
        AsyncStream { continuation in
            let id = UUID()
            let topic = "realtime:ios-\(table)-\(id.uuidString.prefix(8))"

            Task {
                await self.register(
                    id: id,
                    subscription: Subscription(
                        topic: topic, table: table, filter: filter, continuation: continuation
                    )
                )
            }

            continuation.onTermination = { _ in
                Task { await self.unregister(id: id, topic: topic) }
            }
        }
    }

    /// Called after a token refresh so the server keeps authorising the socket.
    func updateAccessToken(_ token: String) async {
        guard isConnected else { return }
        for subscription in subscriptions.values {
            await send([
                "topic": subscription.topic,
                "event": "access_token",
                "payload": ["access_token": token],
                "ref": nextRef(),
            ])
        }
    }

    func disconnect() {
        heartbeat?.cancel(); heartbeat = nil
        receiveLoop?.cancel(); receiveLoop = nil
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
        isConnected = false
    }

    // MARK: - Subscription bookkeeping

    private func register(id: UUID, subscription: Subscription) async {
        subscriptions[id] = subscription
        await connectIfNeeded()
        await join(subscription)
    }

    private func unregister(id: UUID, topic: String) async {
        guard subscriptions.removeValue(forKey: id) != nil else { return }
        await send(["topic": topic, "event": "phx_leave", "payload": [:], "ref": nextRef()])

        // Nothing left to listen for — drop the socket rather than hold a
        // connection (and a heartbeat timer) open for no one.
        if subscriptions.isEmpty {
            disconnect()
        }
    }

    // MARK: - Connection

    private func connectIfNeeded() async {
        guard socket == nil else { return }
        guard let config = await Supabase.shared.realtimeConfig() else { return }

        var components = URLComponents(
            url: config.url.appendingPathComponent("realtime/v1/websocket"),
            resolvingAgainstBaseURL: false
        )!
        components.scheme = config.url.scheme == "http" ? "ws" : "wss"
        components.queryItems = [
            URLQueryItem(name: "apikey", value: config.anonKey),
            URLQueryItem(name: "vsn", value: "1.0.0"),
        ]

        let task = session.webSocketTask(with: components.url!)
        task.resume()
        socket = task
        isConnected = true
        reconnectAttempt = 0

        startReceiving()
        startHeartbeat()

        await Diagnostics.shared.record("realtime", "socket connected")
    }

    private func join(_ subscription: Subscription) async {
        var change: [String: Any] = [
            "event": "*",
            "schema": "public",
            "table": subscription.table,
        ]
        if let filter = subscription.filter {
            change["filter"] = filter
        }

        // A signed-in user's JWT is what row-level security evaluates; fall back
        // to the anon key so the socket still joins while a refresh is in
        // flight rather than dropping the subscription entirely.
        let fallbackKey = await Supabase.shared.realtimeConfig()?.anonKey ?? ""
        let token = (try? await Supabase.shared.validAccessToken()) ?? fallbackKey

        let ref = nextRef()
        await send([
            "topic": subscription.topic,
            "event": "phx_join",
            "ref": ref,
            "join_ref": ref,
            "payload": [
                "config": [
                    "broadcast": ["self": false],
                    "presence": ["key": ""],
                    "postgres_changes": [change],
                ],
                "access_token": token,
            ],
        ])
    }

    private func startHeartbeat() {
        heartbeat?.cancel()
        heartbeat = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(25))
                guard let self, !Task.isCancelled else { return }
                await self.sendHeartbeat()
            }
        }
    }

    private func sendHeartbeat() async {
        await send(["topic": "phoenix", "event": "heartbeat", "payload": [:], "ref": nextRef()])
    }

    private func startReceiving() {
        receiveLoop?.cancel()
        receiveLoop = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                let keepGoing = await self.receiveOnce()
                if !keepGoing { return }
            }
        }
    }

    /// Returns false when the loop should stop (socket died or was cancelled).
    private func receiveOnce() async -> Bool {
        guard let socket else { return false }
        do {
            let message = try await socket.receive()
            if case .string(let text) = message {
                handle(text)
            } else if case .data(let data) = message,
                      let text = String(data: data, encoding: .utf8) {
                handle(text)
            }
            return true
        } catch {
            guard !Task.isCancelled, isConnected else { return false }
            await Diagnostics.shared.record(
                "realtime", "socket dropped — \(error.localizedDescription)", isFailure: true
            )
            await scheduleReconnect()
            return false
        }
    }

    private func scheduleReconnect() async {
        heartbeat?.cancel(); heartbeat = nil
        socket = nil
        isConnected = false

        guard !subscriptions.isEmpty else { return }

        reconnectAttempt = min(reconnectAttempt + 1, 6)
        // 1s, 2s, 4s … capped at a minute, so a long outage doesn't hammer the
        // server and a brief one recovers quickly.
        let delay = min(pow(2.0, Double(reconnectAttempt - 1)), 60)

        Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard let self else { return }
            await self.reconnect()
        }
    }

    private func reconnect() async {
        guard socket == nil, !subscriptions.isEmpty else { return }
        await connectIfNeeded()
        for subscription in subscriptions.values {
            await join(subscription)
        }
    }

    // MARK: - Messages

    private func handle(_ text: String) {
        guard
            let data = text.data(using: .utf8),
            let envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let event = envelope["event"] as? String
        else { return }

        switch event {
        case "postgres_changes":
            deliver(envelope)
        case "phx_error":
            Task {
                await Diagnostics.shared.record("realtime", "channel error: \(text.prefix(160))", isFailure: true)
            }
        default:
            break
        }
    }

    private func deliver(_ envelope: [String: Any]) {
        guard
            let topic = envelope["topic"] as? String,
            let payload = envelope["payload"] as? [String: Any],
            let body = payload["data"] as? [String: Any],
            let typeRaw = body["type"] as? String,
            let kind = RealtimeChange.Kind(rawValue: typeRaw),
            let table = body["table"] as? String
        else { return }

        let record = (body["record"] as? [String: Any]).flatMap {
            try? JSONSerialization.data(withJSONObject: $0)
        }
        let oldRecord = (body["old_record"] as? [String: Any]).flatMap {
            try? JSONSerialization.data(withJSONObject: $0)
        }

        let change = RealtimeChange(kind: kind, table: table, record: record, oldRecord: oldRecord)

        for subscription in subscriptions.values where subscription.topic == topic {
            subscription.continuation.yield(change)
        }
    }

    private func send(_ object: [String: Any]) async {
        guard
            let socket,
            let data = try? JSONSerialization.data(withJSONObject: object),
            let text = String(data: data, encoding: .utf8)
        else { return }
        try? await socket.send(.string(text))
    }

    private func nextRef() -> String {
        refCounter += 1
        return String(refCounter)
    }
}
