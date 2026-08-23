import Foundation

enum SupabaseError: LocalizedError, Equatable {
    case notConfigured
    case notAuthenticated
    case offline
    case http(status: Int, message: String)
    case decoding(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "No Supabase project is connected yet."
        case .notAuthenticated:
            return "You need to sign in again."
        case .offline:
            return "You're offline. Changes are saved on this device and will sync when you reconnect."
        case .http(let status, let message):
            return message.isEmpty ? "Server error (\(status))." : message
        case .decoding(let detail):
            return "Unexpected response from the server. \(detail)"
        case .transport(let detail):
            return detail
        }
    }

    /// Whether retrying the same request could plausibly succeed.
    var isRetryable: Bool {
        switch self {
        case .offline, .transport:
            return true
        case .http(let status, _):
            return status == 408 || status == 429 || (500...599).contains(status)
        default:
            return false
        }
    }
}
