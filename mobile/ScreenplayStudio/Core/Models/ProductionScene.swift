import Foundation

/// A row of the `scenes` table — the scene breakdown.
///
/// Named `ProductionScene` because SwiftUI already owns the name `Scene`.
struct ProductionScene: Codable, Identifiable, Hashable {
    let id: String
    var projectID: String
    var scriptID: String?
    var sceneNumber: String?
    var sceneHeading: String?
    var locationType: SceneLocationType?
    var locationName: String?
    var timeOfDay: SceneTime?
    var synopsis: String?
    var pageCount: Double?
    var estimatedDurationMinutes: Int?
    var shootingDurationMinutes: Int?
    var locationID: String?
    var castIDs: [String]?
    var extrasCount: Int?
    var props: [String]?
    var costumes: [String]?
    var makeupNotes: String?
    var specialEffects: [String]?
    var stunts: String?
    var vehicles: [String]?
    var animals: [String]?
    var soundNotes: String?
    var musicCues: [String]?
    var vfxNotes: String?
    var mood: String?
    var weatherRequired: String?
    var specialEquipment: [String]?
    var notes: String?
    var isCompleted: Bool?
    var sortOrder: Int?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, synopsis, props, costumes, stunts, vehicles, animals, mood, notes
        case projectID = "project_id"
        case scriptID = "script_id"
        case sceneNumber = "scene_number"
        case sceneHeading = "scene_heading"
        case locationType = "location_type"
        case locationName = "location_name"
        case timeOfDay = "time_of_day"
        case pageCount = "page_count"
        case estimatedDurationMinutes = "estimated_duration_minutes"
        case shootingDurationMinutes = "shooting_duration_minutes"
        case locationID = "location_id"
        case castIDs = "cast_ids"
        case extrasCount = "extras_count"
        case makeupNotes = "makeup_notes"
        case specialEffects = "special_effects"
        case soundNotes = "sound_notes"
        case musicCues = "music_cues"
        case vfxNotes = "vfx_notes"
        case weatherRequired = "weather_required"
        case specialEquipment = "special_equipment"
        case isCompleted = "is_completed"
        case sortOrder = "sort_order"
        case updatedAt = "updated_at"
    }

    var done: Bool { isCompleted ?? false }

    /// The slug line, reconstructed when the stored heading is blank.
    var displayHeading: String {
        if let heading = sceneHeading?.nonEmpty { return heading.uppercased() }
        var parts: [String] = []
        if let locationType { parts.append(locationType.label) }
        if let locationName = locationName?.nonEmpty { parts.append(locationName.uppercased()) }
        let head = parts.joined(separator: " ")
        if let timeOfDay {
            return head.isEmpty ? timeOfDay.label : "\(head) - \(timeOfDay.label)"
        }
        return head.isEmpty ? "Untitled scene" : head
    }

    /// Eighths of a page, the unit ADs schedule in.
    var eighthsLabel: String? {
        guard let pageCount, pageCount > 0 else { return nil }
        let totalEighths = Int((pageCount * 8).rounded())
        let whole = totalEighths / 8
        let remainder = totalEighths % 8
        switch (whole, remainder) {
        case (0, let r): return "\(r)/8"
        case (let w, 0): return "\(w)"
        case (let w, let r): return "\(w) \(r)/8"
        }
    }

    /// Every breakdown category with something in it, for the summary chips.
    var breakdownTallies: [(label: String, symbol: String, count: Int)] {
        [
            ("Cast", "person.2.fill", castIDs?.count ?? 0),
            ("Props", "shippingbox.fill", props?.count ?? 0),
            ("Costumes", "tshirt.fill", costumes?.count ?? 0),
            ("SFX", "sparkles", specialEffects?.count ?? 0),
            ("Vehicles", "car.fill", vehicles?.count ?? 0),
            ("Animals", "pawprint.fill", animals?.count ?? 0),
            ("Music", "music.note", musicCues?.count ?? 0),
            ("Equipment", "wrench.and.screwdriver.fill", specialEquipment?.count ?? 0),
        ].filter { $0.count > 0 }
    }

    var totalBreakdownItems: Int {
        breakdownTallies.reduce(0) { $0 + $1.count }
    }
}

struct NewScene: Encodable {
    var projectID: String
    var scriptID: String?
    var sceneNumber: String?
    var sceneHeading: String?
    var locationType: String
    var locationName: String?
    var timeOfDay: String
    var synopsis: String?
    var sortOrder: Int
    var createdBy: String?

    enum CodingKeys: String, CodingKey {
        case synopsis
        case projectID = "project_id"
        case scriptID = "script_id"
        case sceneNumber = "scene_number"
        case sceneHeading = "scene_heading"
        case locationType = "location_type"
        case locationName = "location_name"
        case timeOfDay = "time_of_day"
        case sortOrder = "sort_order"
        case createdBy = "created_by"
    }
}
