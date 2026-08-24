import Foundation

/// The app's Supabase client: GoTrue auth + PostgREST data over `URLSession`.
///
/// Written by hand rather than pulled in as a package so the app ships with no
/// third-party code, launches fast, and builds without network access to a
/// package registry. Only the subset of the API this app uses is implemented.
actor Supabase {

    static let shared = Supabase()

    private let session: URLSession
    private var config: SupabaseConfig?
    private var authSession: AuthSession?

    /// In-flight refresh, so ten concurrent requests hitting an expired token
    /// produce one refresh call rather than ten.
    private var refreshTask: Task<AuthSession, Error>?

    private static let sessionKeychainAccount = "auth.session"

    // MARK: - Lifecycle

    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = false
        configuration.timeoutIntervalForRequest = 20
        configuration.timeoutIntervalForResource = 60
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        // Cellular-friendly: let the system batch discretionary work.
        configuration.httpMaximumConnectionsPerHost = 6
        self.session = URLSession(configuration: configuration)

        self.config = SupabaseConfig.current

        #if DEBUG
        if DemoData.isActive {
            self.authSession = DemoData.session
            return
        }
        #endif

        self.authSession = Self.loadStoredSession()
    }

    // MARK: - Configuration

    func reloadConfig() {
        config = SupabaseConfig.current
    }

    /// Connection details for the realtime socket, which needs the project URL
    /// and anon key rather than a bearer token.
    func realtimeConfig() -> SupabaseConfig? { config }

    var isConfigured: Bool {
        #if DEBUG
        if DemoData.isActive { return true }
        #endif
        return config != nil
    }

    // MARK: - Session state

    var currentSession: AuthSession? { authSession }
    var currentUserID: String? { authSession?.user.id }
    var isSignedIn: Bool { authSession != nil }

    private static func loadStoredSession() -> AuthSession? {
        SessionStore.load()
    }

    private func store(_ session: AuthSession?) {
        authSession = session
        if let session {
            SessionStore.save(session)
        } else {
            SessionStore.clear()
        }
    }

    /// Where the session is actually being kept, for Diagnostics.
    func sessionBacking() -> String { SessionStore.backing }

    // MARK: - Auth

    @discardableResult
    func signIn(email: String, password: String) async throws -> AuthSession {
        let body: [String: JSONValue] = [
            "email": .string(email.trimmingCharacters(in: .whitespacesAndNewlines)),
            "password": .string(password),
        ]
        let session: AuthSession = try await authRequest(
            path: "token",
            query: [URLQueryItem(name: "grant_type", value: "password")],
            body: body
        )
        store(session)
        return session
    }

    /// Returns nil when the project has email confirmation switched on — GoTrue
    /// replies with a user but no session, and the caller shows "check your inbox".
    @discardableResult
    func signUp(email: String, password: String, fullName: String?) async throws -> AuthSession? {
        var body: [String: JSONValue] = [
            "email": .string(email.trimmingCharacters(in: .whitespacesAndNewlines)),
            "password": .string(password),
        ]
        if let fullName, !fullName.isEmpty {
            body["data"] = .object(["full_name": .string(fullName)])
        }

        let raw: Data = try await authRequestRaw(path: "signup", query: [], body: body)
        // A confirmation-required signup has no access_token in the payload.
        if let session = try? JSONDecoder().decode(AuthSession.self, from: raw) {
            store(session)
            return session
        }
        return nil
    }

    func sendPasswordReset(email: String) async throws {
        let body: [String: JSONValue] = [
            "email": .string(email.trimmingCharacters(in: .whitespacesAndNewlines))
        ]
        _ = try await authRequestRaw(path: "recover", query: [], body: body)
    }

    func signOut() async {
        // Best effort — a failed server-side revoke must not trap the user in
        // a signed-in state on the device.
        if let config, let token = authSession?.accessToken {
            var request = URLRequest(url: config.authURL.appendingPathComponent("logout"))
            request.httpMethod = "POST"
            request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            _ = try? await session.data(for: request)
        }
        refreshTask?.cancel()
        refreshTask = nil
        store(nil)
    }

    /// Returns a valid access token, refreshing first if the current one is stale.
    func validAccessToken() async throws -> String {
        #if DEBUG
        if DemoData.isActive { return "demo-access-token" }
        #endif

        guard let current = authSession else { throw SupabaseError.notAuthenticated }
        guard current.isExpired else { return current.accessToken }

        if let refreshTask {
            return try await refreshTask.value.accessToken
        }

        let task = Task<AuthSession, Error> { [refreshToken = current.refreshToken] in
            let body: [String: JSONValue] = ["refresh_token": .string(refreshToken)]
            let refreshed: AuthSession = try await authRequest(
                path: "token",
                query: [URLQueryItem(name: "grant_type", value: "refresh_token")],
                body: body
            )
            return refreshed
        }
        refreshTask = task

        do {
            let refreshed = try await task.value
            refreshTask = nil
            store(refreshed)
            return refreshed.accessToken
        } catch {
            refreshTask = nil
            // A rejected refresh token means the session is genuinely dead.
            if case SupabaseError.http(let status, _) = error, status == 400 || status == 401 {
                store(nil)
                throw SupabaseError.notAuthenticated
            }
            throw error
        }
    }

    // MARK: - Auth transport

    private func authRequest<T: Decodable>(
        path: String,
        query: [URLQueryItem],
        body: [String: JSONValue]
    ) async throws -> T {
        let data = try await authRequestRaw(path: path, query: query, body: body)
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw SupabaseError.decoding(String(describing: error))
        }
    }

    private func authRequestRaw(
        path: String,
        query: [URLQueryItem],
        body: [String: JSONValue]
    ) async throws -> Data {
        guard let config else { throw SupabaseError.notConfigured }

        var components = URLComponents(
            url: config.authURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )!
        if !query.isEmpty { components.queryItems = query }

        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        return try await perform(request)
    }

    // MARK: - PostgREST transport

    /// Executes a built query and decodes the rows.
    ///
    /// If the array as a whole fails to decode, each row is retried on its own
    /// and the bad ones are skipped rather than losing the good ones. A schema
    /// that has moved on from this build should cost the user one row, not the
    /// whole screen — and the skip is recorded so it can be found later.
    func execute<T: Decodable>(_ query: PostgrestQuery) async throws -> [T] {
        let data = try await executeRaw(query)
        guard !data.isEmpty else { return [] }

        do {
            let rows = try JSONDecoder.supabase.decode([T].self, from: data)
            await Diagnostics.shared.record(query.table, "loaded \(rows.count) row(s)")
            return rows
        } catch {
            let salvaged = salvage(T.self, from: data)
            if salvaged.rows.isEmpty && salvaged.failed > 0 {
                await Diagnostics.shared.record(
                    query.table,
                    "every row failed to decode — \(error)",
                    isFailure: true
                )
                throw SupabaseError.decoding("\(T.self): \(error)")
            }
            await Diagnostics.shared.record(
                query.table,
                "loaded \(salvaged.rows.count), skipped \(salvaged.failed) unreadable row(s)",
                isFailure: salvaged.failed > 0
            )
            return salvaged.rows
        }
    }

    /// Decodes an array one element at a time, keeping what it can.
    private func salvage<T: Decodable>(_ type: T.Type, from data: Data) -> (rows: [T], failed: Int) {
        guard let elements = try? JSONSerialization.jsonObject(with: data) as? [Any] else {
            return ([], 0)
        }
        var rows: [T] = []
        var failed = 0
        for element in elements {
            guard
                let elementData = try? JSONSerialization.data(withJSONObject: element),
                let row = try? JSONDecoder.supabase.decode(T.self, from: elementData)
            else {
                failed += 1
                continue
            }
            rows.append(row)
        }
        return (rows, failed)
    }

    /// Executes a query expected to return exactly one row.
    func executeSingle<T: Decodable>(_ query: PostgrestQuery) async throws -> T? {
        let rows: [T] = try await execute(query)
        return rows.first
    }

    /// Executes a query where the response body is not needed.
    func executeIgnoringResult(_ query: PostgrestQuery) async throws {
        _ = try await executeRaw(query)
    }

    private func executeRaw(_ query: PostgrestQuery) async throws -> Data {
        #if DEBUG
        if DemoData.isActive {
            // Reads return canned rows; writes report success with no body. The
            // hook sits here so decoding, caching and error handling upstream
            // are all still the real thing.
            return query.method == .get ? DemoData.rows(for: query) : Data("[]".utf8)
        }
        #endif

        guard let config else { throw SupabaseError.notConfigured }
        let token = try await validAccessToken()

        var components = URLComponents(
            url: config.restURL.appendingPathComponent(query.table),
            resolvingAgainstBaseURL: false
        )!
        if !query.queryItems.isEmpty { components.queryItems = query.queryItems }

        var request = URLRequest(url: components.url!)
        request.httpMethod = query.method.rawValue
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var preferences = query.preferences
        if query.method == .get, let range = query.rangeHeader {
            request.setValue(range, forHTTPHeaderField: "Range")
            preferences.append("count=exact")
        }
        if !preferences.isEmpty {
            request.setValue(preferences.joined(separator: ","), forHTTPHeaderField: "Prefer")
        }
        request.httpBody = query.body

        return try await perform(request)
    }

    // MARK: - Shared transport

    /// One attempt plus two backed-off retries for transient failures.
    private func perform(_ request: URLRequest) async throws -> Data {
        var lastError: Error = SupabaseError.transport("Request failed.")

        for attempt in 0..<3 {
            if attempt > 0 {
                // 0.4s, 1.2s — enough to ride out a handover or a cold function.
                let delay = UInt64(0.4 * pow(3, Double(attempt - 1)) * 1_000_000_000)
                try? await Task.sleep(nanoseconds: delay)
            }
            try Task.checkCancellation()

            do {
                let (data, response) = try await session.data(for: request)
                guard let http = response as? HTTPURLResponse else {
                    throw SupabaseError.transport("Malformed server response.")
                }

                if (200...299).contains(http.statusCode) {
                    return data
                }

                let error = SupabaseError.http(
                    status: http.statusCode,
                    message: Self.errorMessage(from: data, status: http.statusCode)
                )
                await Diagnostics.shared.record(
                    request.url?.path ?? "request",
                    "HTTP \(http.statusCode) — \(Self.errorMessage(from: data, status: http.statusCode))",
                    isFailure: true
                )
                guard error.isRetryable else { throw error }
                lastError = error

            } catch let error as SupabaseError {
                guard error.isRetryable else { throw error }
                lastError = error
            } catch let error as URLError {
                switch error.code {
                case .notConnectedToInternet, .dataNotAllowed, .networkConnectionLost:
                    throw SupabaseError.offline
                case .cancelled:
                    throw CancellationError()
                default:
                    lastError = SupabaseError.transport(error.localizedDescription)
                }
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                lastError = SupabaseError.transport(error.localizedDescription)
            }
        }

        throw lastError
    }

    /// PostgREST and GoTrue both return JSON errors, in different shapes.
    private static func errorMessage(from data: Data, status: Int) -> String {
        guard
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return "" }

        for key in ["message", "error_description", "msg", "hint", "details", "error"] {
            if let value = object[key] as? String, !value.isEmpty {
                return value
            }
        }
        return status == 401 ? "Your session expired. Sign in again." : ""
    }
}
