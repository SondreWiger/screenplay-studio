import Foundation

// MARK: - Project Document

struct ProjectDocument: Codable, Identifiable, Hashable {
    let id: String
    var projectID: String
    var folderID: String?
    var title: String
    var content: String?
    var documentType: String?
    var isPinned: Bool?
    var lastEditedBy: String?
    var createdBy: String?
    var createdAt: Date?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, title, content
        case projectID = "project_id"
        case folderID = "folder_id"
        case documentType = "document_type"
        case isPinned = "is_pinned"
        case lastEditedBy = "last_edited_by"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var resolvedTitle: String {
        title.nonEmpty ?? "Untitled"
    }

    var wordCount: Int {
        content?.split(whereSeparator: \.isWhitespace).count ?? 0
    }

    var typeSymbol: String {
        switch documentType {
        case "script_notes":  return "note.text"
        case "treatment":     return "doc.richtext"
        case "outline":       return "list.number"
        case "research":      return "books.vertical"
        case "meeting_notes": return "bubble.left.and.bubble.right"
        case "call_sheet":    return "phone.arrow.right"
        case "shot_list":     return "camera"
        case "schedule":      return "calendar"
        default:              return "doc.text"
        }
    }

    var typeLabel: String {
        switch documentType {
        case "script_notes":  return "Script Notes"
        case "treatment":     return "Treatment"
        case "outline":       return "Outline"
        case "research":      return "Research"
        case "meeting_notes": return "Meeting Notes"
        case "call_sheet":    return "Call Sheet"
        case "shot_list":     return "Shot List"
        case "schedule":      return "Schedule"
        default:              return "Document"
        }
    }
}

// MARK: - Project Folder

struct ProjectFolder: Codable, Identifiable, Hashable {
    let id: String
    var projectID: String
    var name: String
    var parentID: String?
    var sortOrder: Int?
    var createdBy: String?
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name
        case projectID = "project_id"
        case parentID = "parent_id"
        case sortOrder = "sort_order"
        case createdBy = "created_by"
        case createdAt = "created_at"
    }
}

// MARK: - Insert payloads

struct NewDocument: Encodable {
    var projectID: String
    var title: String
    var content: String?
    var documentType: String?
    var folderID: String?
    var createdBy: String?

    enum CodingKeys: String, CodingKey {
        case title, content
        case projectID = "project_id"
        case documentType = "document_type"
        case folderID = "folder_id"
        case createdBy = "created_by"
    }
}

struct NewFolder: Encodable {
    var projectID: String
    var name: String
    var parentID: String?
    var createdBy: String?

    enum CodingKeys: String, CodingKey {
        case name
        case projectID = "project_id"
        case parentID = "parent_id"
        case createdBy = "created_by"
    }
}
