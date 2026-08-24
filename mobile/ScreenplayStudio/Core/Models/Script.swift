import Foundation

struct Script: Codable, Identifiable, Hashable {
    let id: String
    var projectID: String
    var title: String
    var version: Int?
    @Lenient var revisionColor: RevisionColor?
    var isActive: Bool?
    var locked: Bool?
    var lockedBy: String?
    var createdBy: String
    var createdAt: Date?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, title, version, locked
        case projectID = "project_id"
        case revisionColor = "revision_color"
        case isActive = "is_active"
        case lockedBy = "locked_by"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var isLocked: Bool { locked ?? false }
    var versionLabel: String { "v\(version ?? 1)" }
}

struct ScriptElement: Codable, Identifiable, Hashable {
    let id: String
    var scriptID: String
    var elementType: ScriptElementType
    var content: String
    var sortOrder: Int
    var sceneNumber: String?
    @Lenient var revisionColor: RevisionColor?
    var isRevised: Bool?
    var isOmitted: Bool?
    var createdAt: Date?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, content
        case scriptID = "script_id"
        case elementType = "element_type"
        case sortOrder = "sort_order"
        case sceneNumber = "scene_number"
        case revisionColor = "revision_color"
        case isRevised = "is_revised"
        case isOmitted = "is_omitted"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    /// Locally created element, before the server has seen it. The client mints
    /// the UUID so optimistic inserts have a stable identity and the offline
    /// queue can retry without creating duplicates.
    init(
        id: String = UUID().uuidString.lowercased(),
        scriptID: String,
        elementType: ScriptElementType,
        content: String = "",
        sortOrder: Int,
        sceneNumber: String? = nil
    ) {
        self.id = id
        self.scriptID = scriptID
        self.elementType = elementType
        self.content = content
        self.sortOrder = sortOrder
        self.sceneNumber = sceneNumber
        self.revisionColor = nil
        self.isRevised = nil
        self.isOmitted = nil
        self.createdAt = Date()
        self.updatedAt = Date()
    }

    /// The text as it should be displayed, applying the type's casing rule.
    var displayContent: String {
        elementType.isUppercased ? content.uppercased() : content
    }

    var isEmpty: Bool { content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}

/// The subset of columns sent when inserting an element.
struct ScriptElementInsert: Encodable {
    var id: String
    var scriptID: String
    var elementType: String
    var content: String
    var sortOrder: Int
    var createdBy: String?

    enum CodingKeys: String, CodingKey {
        case id, content
        case scriptID = "script_id"
        case elementType = "element_type"
        case sortOrder = "sort_order"
        case createdBy = "created_by"
    }

    init(element: ScriptElement, createdBy: String?) {
        self.id = element.id
        self.scriptID = element.scriptID
        self.elementType = element.elementType.rawValue
        self.content = element.content
        self.sortOrder = element.sortOrder
        self.createdBy = createdBy
    }
}

/// Partial update for an element — only the fields that actually changed go up,
/// which keeps autosave payloads small on a cellular connection.
struct ScriptElementPatch: Encodable {
    var content: String?
    var elementType: String?
    var sortOrder: Int?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case content
        case elementType = "element_type"
        case sortOrder = "sort_order"
        case updatedAt = "updated_at"
    }
}
