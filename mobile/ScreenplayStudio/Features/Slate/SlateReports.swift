import Foundation

/// Which camera or sound report a take belongs in: one report per roll, per
/// day — the way the camera and sound departments file them.
struct SlateReportKey: Codable, Hashable {
    enum Kind: String, Codable { case camera, sound }

    var kind: Kind
    /// yyyy-MM-dd
    var date: String
    var roll: String
    /// Camera letter, for camera reports.
    var camera: String?
}

/// Writes slated takes into the project's Camera & Sound Reports
/// (`camera_reports` — the same rows the web app's Camera Reports page shows),
/// so the reports fill themselves in as the day goes.
///
/// Each take carries a `slate_id`. A sync rewrites only those entries: rows
/// someone typed by hand on the web are kept as they are.
enum SlateReports {

    /// The reports a take appears in.
    static func keys(for take: SlateTake) -> [SlateReportKey] {
        var keys: [SlateReportKey] = []
        if take.kind.hasCamera {
            keys.append(SlateReportKey(kind: .camera, date: take.reportDate, roll: take.roll, camera: take.cameraLetter))
        }
        if take.kind.hasSound {
            keys.append(SlateReportKey(kind: .sound, date: take.reportDate, roll: take.soundRoll, camera: nil))
        }
        return keys
    }

    // MARK: - Entries

    static func notes(for take: SlateTake) -> String {
        var parts: [String] = []
        if take.rating != .none && take.rating != .circled { parts.append(take.rating.label) }
        if take.isTailSlate { parts.append("Tail slate") }
        if let note = take.note?.nonEmpty { parts.append(note) }
        return parts.joined(separator: " · ")
    }

    static func cameraEntry(_ take: SlateTake) -> JSONValue {
        .object([
            "scene": .string(take.scene),
            "setup": .string(take.setup),
            "take": .string(String(take.take)),
            "lens": .string(take.lens ?? ""),
            "stop": "",
            "filter": "",
            "focus_dist": "",
            "int_ext": .string(take.isInterior ? "INT" : "EXT"),
            "day_night": .string(take.isDay ? "DAY" : "NIGHT"),
            "type": .string(take.kind.label),
            "circle": .bool(take.rating == .circled),
            "notes": .string(notes(for: take)),
            "timecode": .string(take.timecode ?? ""),
            "tail_timecode": .string(take.tailTimecode ?? ""),
            "rating": .string(take.rating.rawValue),
            "slate_id": .string(take.id.uuidString),
        ])
    }

    static func soundEntry(_ take: SlateTake) -> JSONValue {
        .object([
            "roll": .string(take.soundRoll),
            "scene": .string(take.setup.isEmpty ? take.scene : "\(take.scene)\(take.setup)"),
            "take": .string(String(take.take)),
            "track1": "",
            "track2": "",
            "wild_track": .bool(take.kind == .wild),
            "notes": .string(notes(for: take)),
            "timecode": .string(take.timecode ?? ""),
            "circle": .bool(take.rating == .circled),
            "slate_id": .string(take.id.uuidString),
        ])
    }

    // MARK: - Sync

    private struct ReportRow: Decodable {
        let id: String
        let takes: [JSONValue]?
        let soundTakes: [JSONValue]?

        enum CodingKeys: String, CodingKey {
            case id, takes
            case soundTakes = "sound_takes"
        }
    }

    private struct NewReport: Encodable {
        let projectID: String
        let reportType: String
        let reportDate: String
        let rollNumber: String
        let cameraID: String?
        let operatorName: String?
        let takes: [JSONValue]
        let soundTakes: [JSONValue]
        let createdBy: String?

        enum CodingKeys: String, CodingKey {
            case takes
            case projectID = "project_id"
            case reportType = "report_type"
            case reportDate = "report_date"
            case rollNumber = "roll_number"
            case cameraID = "camera_id"
            case operatorName = "operator"
            case soundTakes = "sound_takes"
            case createdBy = "created_by"
        }
    }

    /// Bring one report up to date with the local take log.
    ///
    /// - Parameters:
    ///   - takes: every take in the local log (only those filed under `key` are
    ///     written; the rest are used to recognise our own entries).
    ///   - removedIDs: takes deleted locally, to remove from the report.
    static func push(
        _ key: SlateReportKey,
        projectID: String,
        takes: [SlateTake],
        removedIDs: Set<UUID>,
        operatorName: String?,
        userID: String?
    ) async throws {
        let ours = Set(takes.map(\.id.uuidString)).union(removedIDs.map(\.uuidString))
        let filed = takes
            .filter { keys(for: $0).contains(key) }
            .sorted { $0.markedAt < $1.markedAt }
        let entries = filed.map { key.kind == .camera ? cameraEntry($0) : soundEntry($0) }

        var query = PostgrestQuery("camera_reports")
            .select("id,takes,sound_takes")
            .eq("project_id", projectID)
            .eq("report_type", key.kind.rawValue)
            .eq("report_date", key.date)
            .eq("roll_number", key.roll)
        if let camera = key.camera { query = query.eq("camera_id", camera) }
        let existing: [ReportRow] = try await Supabase.shared.execute(query.limit(1))

        if let row = existing.first {
            // Keep everything that isn't one of ours, then our current entries.
            let current = (key.kind == .camera ? row.takes : row.soundTakes) ?? []
            let kept = current.filter { entry in
                guard let id = entry["slate_id"]?.stringValue else { return true }
                return !ours.contains(id)
            }
            let merged: [JSONValue] = kept + entries
            let column = key.kind == .camera ? "takes" : "sound_takes"
            let body: [String: JSONValue] = [
                column: .array(merged),
                "updated_at": .string(PostgresDate.string(from: Date())),
            ]
            let update = try PostgrestQuery("camera_reports").eq("id", row.id).update(body, returning: false)
            try await Supabase.shared.executeIgnoringResult(update)
        } else {
            guard !entries.isEmpty else { return }
            let report = NewReport(
                projectID: projectID,
                reportType: key.kind.rawValue,
                reportDate: key.date,
                rollNumber: key.roll,
                cameraID: key.camera,
                operatorName: operatorName?.nonEmpty,
                takes: key.kind == .camera ? entries : [],
                soundTakes: key.kind == .sound ? entries : [],
                createdBy: userID
            )
            let insert = try PostgrestQuery("camera_reports").insert([report], returning: false)
            try await Supabase.shared.executeIgnoringResult(insert)
        }
    }

    // MARK: - Export

    /// The day's log as CSV, for the editor, the script supervisor or the DIT.
    static func csv(_ takes: [SlateTake]) -> String {
        func field(_ value: String) -> String {
            if value.contains(",") || value.contains("\"") || value.contains("\n") {
                return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
            }
            return value
        }
        let header = ["Date", "Time", "Scene", "Setup", "Take", "Timecode", "Tail TC", "Frame rate", "Camera", "Roll",
                      "Sound roll", "Type", "Rating", "Circled", "INT/EXT", "DAY/NIGHT", "Lens", "Duration (s)", "Notes"]
        let time = DateFormatter()
        time.dateFormat = "HH:mm:ss"
        let rows = takes.sorted { $0.markedAt < $1.markedAt }.map { take -> String in
            [
                take.reportDate,
                time.string(from: take.markedAt),
                take.scene,
                take.setup,
                String(take.take),
                take.timecode ?? "",
                take.tailTimecode ?? "",
                FrameRate(rawValue: take.frameRate)?.label ?? take.frameRate,
                take.cameraLetter,
                take.roll,
                take.soundRoll,
                take.kind.label,
                take.rating.label,
                take.rating == .circled ? "Yes" : "",
                take.isInterior ? "INT" : "EXT",
                take.isDay ? "DAY" : "NIGHT",
                take.lens ?? "",
                take.duration.map { String(format: "%.0f", $0) } ?? "",
                take.note ?? "",
            ].map(field).joined(separator: ",")
        }
        return ([header.joined(separator: ",")] + rows).joined(separator: "\n") + "\n"
    }
}
