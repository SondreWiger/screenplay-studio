import Foundation

/// Where the signed-in session is kept between launches.
///
/// The Keychain is the right home for bearer tokens, but it is only available
/// when the app is signed with a keychain access group. A build without a
/// development team selected — which is every build until someone sets one in
/// Xcode — gets `errSecMissingEntitlement` on every write, and the app forgets
/// the login each launch with nothing to show for it.
///
/// So: Keychain first, and a sandboxed file with `completeUntilFirstUserAuth`
/// protection as a fallback. The file is inside the app container, excluded
/// from backups, and encrypted at rest by the OS once the device has been
/// unlocked once. That is weaker than the Keychain and the fallback is recorded
/// in Diagnostics, but it is the difference between the app working and the app
/// asking for a password every single time.
enum SessionStore {

    private static let account = "auth.session"

    private static var fileURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = base.appendingPathComponent("ScreenplayStudio", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("session.json")
    }

    /// Which mechanism actually holds the session, for Diagnostics.
    private(set) static var backing: String = "unknown"

    static func save(_ session: AuthSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }

        if KeychainStore.set(data, for: account) == errSecSuccess {
            backing = "keychain"
            // Don't leave a stale copy behind once the Keychain works.
            try? FileManager.default.removeItem(at: fileURL)
            return
        }

        writeFallback(data)
    }

    static func load() -> AuthSession? {
        if let data = KeychainStore.get(account),
           let session = try? JSONDecoder().decode(AuthSession.self, from: data) {
            backing = "keychain"
            return session
        }

        guard
            let data = try? Data(contentsOf: fileURL),
            let session = try? JSONDecoder().decode(AuthSession.self, from: data)
        else {
            backing = "none"
            return nil
        }

        backing = "protected file"
        return session
    }

    static func clear() {
        KeychainStore.delete(account)
        try? FileManager.default.removeItem(at: fileURL)
        backing = "none"
    }

    private static func writeFallback(_ data: Data) {
        var url = fileURL
        do {
            try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])

            // A session restored onto another device would be useless and is
            // not something to hand to iCloud.
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try? url.setResourceValues(values)

            backing = "protected file"
            Task {
                await Diagnostics.shared.record(
                    "session",
                    "keychain unavailable — session stored in a protected file instead. "
                        + "Select a development team in Signing & Capabilities to use the keychain."
                )
            }
        } catch {
            backing = "none"
            Task {
                await Diagnostics.shared.record(
                    "session", "could not persist session: \(error.localizedDescription)", isFailure: true
                )
            }
        }
    }
}
