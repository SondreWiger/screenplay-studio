import Foundation

struct Shot: Codable, Identifiable, Hashable {
    let id: String
    var projectID: String
    var sceneID: String?
    var shotNumber: String?
    var shotType: ShotType?
    var shotMovement: ShotMovement?
    var lens: String?
    var description: String?
    var dialogueRef: String?
    var durationSeconds: Int?
    var cameraNotes: String?
    var lightingNotes: String?
    var soundNotes: String?
    var vfxRequired: Bool?
    var vfxNotes: String?
    var storyboardURL: String?
    var isCompleted: Bool?
    var takesNeeded: Int?
    var takesCompleted: Int?
    var sortOrder: Int?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, lens, description
        case projectID = "project_id"
        case sceneID = "scene_id"
        case shotNumber = "shot_number"
        case shotType = "shot_type"
        case shotMovement = "shot_movement"
        case dialogueRef = "dialogue_ref"
        case durationSeconds = "duration_seconds"
        case cameraNotes = "camera_notes"
        case lightingNotes = "lighting_notes"
        case soundNotes = "sound_notes"
        case vfxRequired = "vfx_required"
        case vfxNotes = "vfx_notes"
        case storyboardURL = "storyboard_url"
        case isCompleted = "is_completed"
        case takesNeeded = "takes_needed"
        case takesCompleted = "takes_completed"
        case sortOrder = "sort_order"
        case updatedAt = "updated_at"
    }

    var done: Bool { isCompleted ?? false }
    var needsVFX: Bool { vfxRequired ?? false }

    var displayNumber: String { shotNumber?.nonEmpty ?? "—" }

    var takesLabel: String? {
        let needed = takesNeeded ?? 0
        let completed = takesCompleted ?? 0
        guard needed > 0 || completed > 0 else { return nil }
        return "\(completed)/\(max(needed, completed)) takes"
    }

    var durationLabel: String? {
        guard let durationSeconds, durationSeconds > 0 else { return nil }
        if durationSeconds < 60 { return "\(durationSeconds)s" }
        let minutes = durationSeconds / 60
        let seconds = durationSeconds % 60
        return seconds == 0 ? "\(minutes)m" : "\(minutes)m \(seconds)s"
    }

    /// "WS · Dolly in · 35mm" — the one-line summary shown under the description.
    var techSummary: String {
        var parts: [String] = []
        if let shotType { parts.append(shotType.abbreviation) }
        if let shotMovement, shotMovement != .static { parts.append(shotMovement.label) }
        if let lens = lens?.nonEmpty { parts.append(lens) }
        return parts.joined(separator: " · ")
    }
}

struct NewShot: Encodable {
    var projectID: String
    var sceneID: String?
    var shotNumber: String?
    var shotType: String
    var shotMovement: String
    var description: String?
    var lens: String?
    var sortOrder: Int
    var createdBy: String?

    enum CodingKeys: String, CodingKey {
        case description, lens
        case projectID = "project_id"
        case sceneID = "scene_id"
        case shotNumber = "shot_number"
        case shotType = "shot_type"
        case shotMovement = "shot_movement"
        case sortOrder = "sort_order"
        case createdBy = "created_by"
    }
}
