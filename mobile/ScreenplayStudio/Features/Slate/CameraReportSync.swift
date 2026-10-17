import Foundation

/// One camera report: a day's takes on one roll from one camera. The same
/// grouping the web app's Camera Reports page uses.
struct CameraReportKey: Codable, Hashable, Sendable {
    var date: String
    var roll: String
    var camera: String

    init(date: String, roll: String, camera: String) {
        self.date = date
        self.roll = roll
        self.camera = camera
    }

    init(_ take: SlateTake) {
        self.init(date: take.reportDate, roll: take.roll, camera: take.cameraUnit)
    }
}

/// Writes slate takes into the project's camera reports (`camera_reports`),
/// so the board doubles as the camera department's paperwork.
///
/// Each write re-reads the report and merges by take id, which makes it safe
/// to repeat: a sync that failed halfway, or one replayed after coming back
/// online, converges on the same report rather than duplicating takes.
/// Columns the slate doesn't know — lens, stop, focus distance a camera
/// assistant typed on the web — are kept on every take it updates.
enum CameraReportSync {

    private struct Row: Decodable {
        let id: String
        let cameraID: String?
        let takes: [JSONValue]?

        enum CodingKeys: String, CodingKey {
            case id, takes
            case cameraID = "camera_id"
        }
    }

    static func sync(
        projectID: String,
        key: CameraReportKey,
        takes: [SlateTake],
        removedIDs: Set<UUID>,
        operatorName: String?,
        ownerID: String?
    ) async throws {
        let query = PostgrestQuery("camera_reports")
            .select("id,camera_id,takes")
            .eq("project_id", projectID)
            .eq("report_type", "camera")
            .eq("report_date", key.date)
            .eq("roll_number", key.roll)
        let rows: [Row] = try await Supabase.shared.execute(query)

        // Prefer the report for this camera; fall back to one with no camera
        // set, which is how a report started on the web usually looks.
        let existing = rows.first { $0.cameraID == key.camera }
            ?? rows.first { ($0.cameraID ?? "").isEmpty }

        let ours = Set(takes.map(\.id.uuidString)).union(removedIDs.map(\.uuidString))
        var previous: [String: [String: JSONValue]] = [:]
        var kept: [JSONValue] = []
        for entry in existing?.takes ?? [] {
            if case .object(let object) = entry,
               case .string(let slateID)? = object["slate_id"], ours.contains(slateID) {
                previous[slateID] = object
            } else {
                kept.append(entry)
            }
        }

        let entries = takes
            .sorted { $0.markedAt < $1.markedAt }
            .map { JSONValue.object(entry(for: $0, merging: previous[$0.id.uuidString])) }
        let merged = kept + entries

        if let existing {
            let body: [String: JSONValue] = [
                "takes": .array(merged),
                "camera_id": .string(key.camera),
                "updated_at": .string(PostgresDate.string(from: Date())),
            ]
            let update = try PostgrestQuery("camera_reports")
                .eq("id", existing.id)
                .update(body, returning: false)
            try await Supabase.shared.executeIgnoringResult(update)
        } else {
            guard !entries.isEmpty else { return }
            var body: [String: JSONValue] = [
                "project_id": .string(projectID),
                "report_type": .string("camera"),
                "report_date": .string(key.date),
                "roll_number": .string(key.roll),
                "camera_id": .string(key.camera),
                "takes": .array(merged),
                "sound_takes": .array([]),
            ]
            if let operatorName = operatorName?.nonEmpty { body["operator"] = .string(operatorName) }
            if let ownerID { body["created_by"] = .string(ownerID) }
            let insert = try PostgrestQuery("camera_reports").insert([body], returning: false)
            try await Supabase.shared.executeIgnoringResult(insert)
        }
    }

    /// The take as the Camera Reports page reads it, plus the slate's extras
    /// (timecode, frame rate) under keys that page passes through untouched.
    private static func entry(for take: SlateTake, merging previous: [String: JSONValue]?) -> [String: JSONValue] {
        var object = previous ?? [
            "lens": .string(""),
            "stop": .string(""),
            "filter": .string(""),
            "focus_dist": .string(""),
        ]
        object["slate_id"] = .string(take.id.uuidString)
        object["scene"] = .string(take.scene)
        object["setup"] = .string(take.shot)
        object["take"] = .string(String(take.take))
        object["int_ext"] = .string(take.isInterior ? "INT" : "EXT")
        object["day_night"] = .string(take.isDay ? "DAY" : "NIGHT")
        object["type"] = .string(take.isMOS ? "MOS" : "SYNC")
        object["circle"] = .bool(take.isCircled)
        object["timecode"] = take.timecode.map(JSONValue.string) ?? .null
        object["fps"] = take.frameRate.map { .string($0.rawValue) } ?? .null
        object["marked_at"] = .string(PostgresDate.string(from: take.markedAt))

        var notes: [String] = []
        if take.isTail { notes.append("Tail slate") }
        if let note = take.note?.nonEmpty { notes.append(note) }
        if !notes.isEmpty {
            object["notes"] = .string(notes.joined(separator: " · "))
        } else if object["notes"] == nil {
            object["notes"] = .string("")
        }
        return object
    }
}
