import Foundation

/// A row of `production_schedule`.
struct ScheduleEvent: Codable, Identifiable, Hashable {
    let id: String
    var projectID: String
    var title: String
    var description: String?
    @Lenient var eventType: ScheduleEventType?
    var startTime: Date
    var endTime: Date
    var allDay: Bool?
    var sceneIDs: [String]?
    var locationID: String?
    var assignedTo: [String]?
    var callTime: Date?
    var wrapTime: Date?
    var notes: String?
    var color: String?
    var isConfirmed: Bool?

    enum CodingKeys: String, CodingKey {
        case id, title, description, notes, color
        case projectID = "project_id"
        case eventType = "event_type"
        case startTime = "start_time"
        case endTime = "end_time"
        case allDay = "all_day"
        case sceneIDs = "scene_ids"
        case locationID = "location_id"
        case assignedTo = "assigned_to"
        case callTime = "call_time"
        case wrapTime = "wrap_time"
        case isConfirmed = "is_confirmed"
    }

    var resolvedType: ScheduleEventType { eventType ?? .other }
    var confirmed: Bool { isConfirmed ?? false }
    var isAllDay: Bool { allDay ?? false }

    /// Calendar day the event belongs to, used to bucket the agenda list.
    var day: Date {
        Calendar.current.startOfDay(for: startTime)
    }

    var timeRangeLabel: String {
        guard !isAllDay else { return "All day" }
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return "\(formatter.string(from: startTime)) – \(formatter.string(from: endTime))"
    }

    var durationLabel: String? {
        guard !isAllDay else { return nil }
        let minutes = Int(endTime.timeIntervalSince(startTime) / 60)
        guard minutes > 0 else { return nil }
        let hours = minutes / 60
        let remainder = minutes % 60
        if hours == 0 { return "\(remainder)m" }
        return remainder == 0 ? "\(hours)h" : "\(hours)h \(remainder)m"
    }
}

struct NewScheduleEvent: Encodable {
    var projectID: String
    var title: String
    var eventType: String
    var startTime: Date
    var endTime: Date
    var allDay: Bool
    var notes: String?
    var createdBy: String?

    enum CodingKeys: String, CodingKey {
        case title, notes
        case projectID = "project_id"
        case eventType = "event_type"
        case startTime = "start_time"
        case endTime = "end_time"
        case allDay = "all_day"
        case createdBy = "created_by"
    }
}

/// A row of `locations`, used to name the venue on schedule and scene rows.
struct ProductionLocation: Codable, Identifiable, Hashable {
    let id: String
    var projectID: String
    var name: String
    var address: String?
    @Lenient var locationType: SceneLocationType?
    var contactName: String?
    var contactPhone: String?
    var isConfirmed: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name, address
        case projectID = "project_id"
        case locationType = "location_type"
        case contactName = "contact_name"
        case contactPhone = "contact_phone"
        case isConfirmed = "is_confirmed"
    }

    var confirmed: Bool { isConfirmed ?? false }
}
