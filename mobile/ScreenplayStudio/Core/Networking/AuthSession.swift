import Foundation

/// The GoTrue token payload, trimmed to what the app actually uses.
struct AuthSession: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
    let user: AuthUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case expiresAt = "expires_at"
        case user
    }

    init(accessToken: String, refreshToken: String, expiresAt: Date, user: AuthUser) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
        self.user = user
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        accessToken = try c.decode(String.self, forKey: .accessToken)
        refreshToken = try c.decode(String.self, forKey: .refreshToken)
        user = try c.decode(AuthUser.self, forKey: .user)

        // GoTrue sends `expires_at` (absolute, seconds) on sign-in and
        // `expires_in` (relative) on refresh. Accept either.
        if let absolute = try c.decodeIfPresent(Double.self, forKey: .expiresAt) {
            expiresAt = Date(timeIntervalSince1970: absolute)
        } else if let relative = try c.decodeIfPresent(Double.self, forKey: .expiresIn) {
            expiresAt = Date().addingTimeInterval(relative)
        } else {
            expiresAt = Date().addingTimeInterval(3600)
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(accessToken, forKey: .accessToken)
        try c.encode(refreshToken, forKey: .refreshToken)
        try c.encode(expiresAt.timeIntervalSince1970, forKey: .expiresAt)
        try c.encode(user, forKey: .user)
    }

    /// Refresh a minute early so a request never races the expiry.
    var isExpired: Bool { Date() >= expiresAt.addingTimeInterval(-60) }
}

struct AuthUser: Codable, Equatable, Identifiable {
    let id: String
    let email: String?
    let userMetadata: [String: JSONValue]?

    enum CodingKeys: String, CodingKey {
        case id, email
        case userMetadata = "user_metadata"
    }

    var fullName: String? {
        if case .string(let name) = userMetadata?["full_name"] { return name }
        if case .string(let name) = userMetadata?["name"] { return name }
        return nil
    }
}
