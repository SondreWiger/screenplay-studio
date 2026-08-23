import Foundation

struct Project: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var logline: String?
    var synopsis: String?
    var genre: [String]?
    var format: String?
    var targetLengthMinutes: Int?
    var status: ProjectStatus?
    var posterURL: String?
    var coverURL: String?
    var createdBy: String
    var createdAt: Date?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, title, logline, synopsis, genre, format, status
        case targetLengthMinutes = "target_length_minutes"
        case posterURL = "poster_url"
        case coverURL = "cover_url"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var resolvedFormat: ProjectFormat {
        ProjectFormat(rawValue: format ?? "feature") ?? .feature
    }

    var resolvedStatus: ProjectStatus { status ?? .development }

    var genreSummary: String? {
        guard let genre, !genre.isEmpty else { return nil }
        return genre.joined(separator: " · ")
    }

    /// Deterministic accent so a project keeps the same colour everywhere it
    /// appears without needing a stored value.
    var accentSeed: Int {
        abs(id.hashValue) % Project.accentPalette.count
    }

    static let accentPalette: [UInt32] = [
        0xFF5F1F, 0x8B5CF6, 0x06B6D4, 0x22C55E,
        0xEC4899, 0xF59E0B, 0x3B82F6, 0xEF4444,
    ]
}

/// Payload for creating a project. Separate from `Project` so the insert only
/// sends columns the server should accept, letting defaults fill the rest.
struct NewProject: Encodable {
    var title: String
    var logline: String?
    var format: String
    var status: String
    var createdBy: String

    enum CodingKeys: String, CodingKey {
        case title, logline, format, status
        case createdBy = "created_by"
    }
}

struct Profile: Codable, Identifiable, Hashable {
    let id: String
    var email: String?
    var fullName: String?
    var displayName: String?
    var avatarURL: String?
    var bio: String?
    var role: String?

    enum CodingKeys: String, CodingKey {
        case id, email, bio, role
        case fullName = "full_name"
        case displayName = "display_name"
        case avatarURL = "avatar_url"
    }

    var bestName: String {
        displayName?.nonEmpty ?? fullName?.nonEmpty ?? email?.components(separatedBy: "@").first ?? "Unnamed"
    }

    var initials: String {
        let parts = bestName.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first.map(String.init) }
        return letters.isEmpty ? "?" : letters.joined().uppercased()
    }
}

extension String {
    var nonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
