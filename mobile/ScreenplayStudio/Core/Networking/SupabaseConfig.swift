import Foundation

/// Where the app points itself at a Supabase project.
///
/// Resolution order:
///   1. `Secrets.plist` bundled into the app (git-ignored — see `mobile/README.md`).
///   2. Values entered by the user on the connection screen, stored in `UserDefaults`.
///
/// Keeping (2) means a fresh checkout builds and runs without any secret files,
/// which matters because the anon key is per-deployment.
struct SupabaseConfig: Equatable {
    let url: URL
    let anonKey: String

    private static let urlDefaultsKey = "ss.supabase.url"
    private static let keyDefaultsKey = "ss.supabase.anonKey"

    static var current: SupabaseConfig? {
        if let bundled = fromBundle() { return bundled }
        return fromDefaults()
    }

    static var isConfigured: Bool { current != nil }

    private static func fromBundle() -> SupabaseConfig? {
        guard
            let path = Bundle.main.path(forResource: "Secrets", ofType: "plist"),
            let dict = NSDictionary(contentsOfFile: path) as? [String: Any],
            let urlString = dict["SUPABASE_URL"] as? String,
            let key = dict["SUPABASE_ANON_KEY"] as? String,
            let url = URL(string: urlString.trimmingCharacters(in: .whitespacesAndNewlines)),
            !key.isEmpty
        else { return nil }
        return SupabaseConfig(url: url, anonKey: key)
    }

    private static func fromDefaults() -> SupabaseConfig? {
        let defaults = UserDefaults.standard
        guard
            let urlString = defaults.string(forKey: urlDefaultsKey),
            let key = defaults.string(forKey: keyDefaultsKey),
            let url = URL(string: urlString),
            !key.isEmpty
        else { return nil }
        return SupabaseConfig(url: url, anonKey: key)
    }

    /// Persists a user-entered configuration. Returns nil if the input is unusable.
    @discardableResult
    static func save(urlString: String, anonKey: String) -> SupabaseConfig? {
        var trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasSuffix("/") { trimmed.removeLast() }
        if !trimmed.contains("://") { trimmed = "https://" + trimmed }
        let key = anonKey.trimmingCharacters(in: .whitespacesAndNewlines)

        guard let url = URL(string: trimmed), url.host != nil, !key.isEmpty else { return nil }

        let defaults = UserDefaults.standard
        defaults.set(trimmed, forKey: urlDefaultsKey)
        defaults.set(key, forKey: keyDefaultsKey)
        return SupabaseConfig(url: url, anonKey: key)
    }

    static func clear() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: urlDefaultsKey)
        defaults.removeObject(forKey: keyDefaultsKey)
    }

    var restURL: URL { url.appendingPathComponent("rest/v1") }
    var authURL: URL { url.appendingPathComponent("auth/v1") }
    var storageURL: URL { url.appendingPathComponent("storage/v1") }
}
