import Foundation

/// A row of the `characters` table.
///
/// Named `ProjectCharacter` because Swift's standard library owns `Character`.
struct ProjectCharacter: Codable, Identifiable, Hashable {
    let id: String
    var projectID: String
    var name: String
    var fullName: String?
    var age: String?
    var gender: String?
    var description: String?
    var backstory: String?
    var motivation: String?
    var arc: String?
    var appearance: String?
    var personalityTraits: [String]?
    var quirks: String?
    var voiceNotes: String?
    var avatarURL: String?
    var color: String?
    var isMain: Bool?
    var firstAppearance: String?
    var castActor: String?
    var castNotes: String?
    var sortOrder: Int?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name, age, gender, description, backstory, motivation, arc
        case appearance, quirks, color
        case projectID = "project_id"
        case fullName = "full_name"
        case personalityTraits = "personality_traits"
        case voiceNotes = "voice_notes"
        case avatarURL = "avatar_url"
        case isMain = "is_main"
        case firstAppearance = "first_appearance"
        case castActor = "cast_actor"
        case castNotes = "cast_notes"
        case sortOrder = "sort_order"
        case updatedAt = "updated_at"
    }

    var lead: Bool { isMain ?? false }

    var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first.map(String.init) }
        return letters.isEmpty ? "?" : letters.joined().uppercased()
    }

    var isCast: Bool { castActor?.nonEmpty != nil }

    /// One-line subtitle for the list row.
    var subtitle: String? {
        var parts: [String] = []
        if let age = age?.nonEmpty { parts.append(age) }
        if let gender = gender?.nonEmpty { parts.append(gender) }
        if let actor = castActor?.nonEmpty { parts.append("Cast: \(actor)") }
        return parts.isEmpty ? description?.nonEmpty : parts.joined(separator: " · ")
    }
}

struct NewCharacter: Encodable {
    var projectID: String
    var name: String
    var description: String?
    var isMain: Bool
    var color: String
    var sortOrder: Int
    var createdBy: String?

    enum CodingKeys: String, CodingKey {
        case name, description, color
        case projectID = "project_id"
        case isMain = "is_main"
        case sortOrder = "sort_order"
        case createdBy = "created_by"
    }
}
