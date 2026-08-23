import SwiftUI
import Combine

/// Observable wrapper around the `Supabase` actor's session state.
@MainActor
final class AuthStore: ObservableObject {

    enum Phase: Equatable {
        /// Reading the stored session on launch.
        case loading
        /// No Supabase project configured on this device yet.
        case needsConfiguration
        case signedOut
        case signedIn(AuthUser)
    }

    @Published private(set) var phase: Phase = .loading
    @Published private(set) var profile: Profile?
    @Published var errorMessage: String?
    @Published private(set) var isWorking = false
    /// Set after a sign-up that needs email confirmation.
    @Published var confirmationEmail: String?

    var user: AuthUser? {
        if case .signedIn(let user) = phase { return user }
        return nil
    }

    var userID: String? { user?.id }

    // MARK: - Launch

    func bootstrap() async {
        await Supabase.shared.reloadConfig()

        guard await Supabase.shared.isConfigured else {
            phase = .needsConfiguration
            return
        }

        guard let session = await Supabase.shared.currentSession else {
            phase = .signedOut
            return
        }

        phase = .signedIn(session.user)

        // Refresh in the background — a stale token shouldn't hold up the UI,
        // and if the refresh fails the user drops to the sign-in screen.
        Task {
            do {
                _ = try await Supabase.shared.validAccessToken()
                await loadProfile()
            } catch SupabaseError.notAuthenticated {
                phase = .signedOut
            } catch {
                // Offline at launch: keep the cached session and let the user work.
            }
        }
    }

    // MARK: - Configuration

    func configure(urlString: String, anonKey: String) async {
        guard SupabaseConfig.save(urlString: urlString, anonKey: anonKey) != nil else {
            errorMessage = "That doesn't look like a valid Supabase URL and anon key."
            Haptics.error()
            return
        }
        await Supabase.shared.reloadConfig()
        errorMessage = nil
        Haptics.success()
        await bootstrap()
    }

    // MARK: - Credentials

    func signIn(email: String, password: String) async {
        guard !isWorking else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            let session = try await Supabase.shared.signIn(email: email, password: password)
            phase = .signedIn(session.user)
            Haptics.success()
            await loadProfile()
            await SyncQueue.shared.drain()
        } catch {
            errorMessage = Self.friendlyMessage(for: error)
            Haptics.error()
        }
    }

    func signUp(email: String, password: String, fullName: String) async {
        guard !isWorking else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            if let session = try await Supabase.shared.signUp(
                email: email, password: password, fullName: fullName.nonEmpty
            ) {
                phase = .signedIn(session.user)
                Haptics.success()
                await loadProfile()
            } else {
                confirmationEmail = email
                Haptics.success()
            }
        } catch {
            errorMessage = Self.friendlyMessage(for: error)
            Haptics.error()
        }
    }

    func sendPasswordReset(email: String) async {
        guard !isWorking else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await Supabase.shared.sendPasswordReset(email: email)
            Haptics.success()
        } catch {
            errorMessage = Self.friendlyMessage(for: error)
            Haptics.error()
        }
    }

    func signOut() async {
        await Supabase.shared.signOut()
        await LocalCache.shared.clearAll()
        profile = nil
        AppSettings.shared.lastProjectID = ""
        phase = .signedOut
        Haptics.tap()
    }

    // MARK: - Profile

    func loadProfile() async {
        guard let userID else { return }
        let query = PostgrestQuery("profiles").select().eq("id", userID).limit(1)
        profile = try? await Supabase.shared.executeSingle(query)
    }

    // MARK: - Error text

    /// Turns GoTrue's terse errors into something a person can act on.
    private static func friendlyMessage(for error: Error) -> String {
        guard let supabaseError = error as? SupabaseError else {
            return error.localizedDescription
        }

        switch supabaseError {
        case .http(let status, let message):
            let lower = message.lowercased()
            if lower.contains("invalid login credentials") {
                return "That email and password don't match an account."
            }
            if lower.contains("email not confirmed") {
                return "Check your inbox and confirm your email address first."
            }
            if lower.contains("already registered") || lower.contains("already been registered") {
                return "An account with that email already exists. Try signing in."
            }
            if lower.contains("password should be") {
                return "Pick a password with at least 6 characters."
            }
            if status == 429 {
                return "Too many attempts. Wait a moment and try again."
            }
            return message.isEmpty ? "Something went wrong (\(status))." : message
        default:
            return supabaseError.errorDescription ?? "Something went wrong."
        }
    }
}
