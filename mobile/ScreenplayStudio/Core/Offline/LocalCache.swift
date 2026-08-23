import Foundation

/// A small on-disk JSON cache so every screen has something to draw the instant
/// it appears — including on a cold launch in a basement location with no signal.
///
/// Reads and writes hop to a background queue; the caller stays on the main
/// actor and never blocks a frame on file I/O.
actor LocalCache {

    static let shared = LocalCache()

    private let directory: URL
    private let encoder = JSONEncoder.supabase
    private let decoder = JSONDecoder.supabase

    private init() {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        directory = base.appendingPathComponent("ScreenplayStudioCache", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    private func url(for key: String) -> URL {
        // Keys contain UUIDs and dashes only, but sanitise anyway so a stray
        // slash can never escape the cache directory.
        let safe = key.replacingOccurrences(of: "/", with: "_")
        return directory.appendingPathComponent("\(safe).json")
    }

    func save<T: Encodable>(_ value: T, for key: String) {
        guard let data = try? encoder.encode(value) else { return }
        try? data.write(to: url(for: key), options: .atomic)
    }

    func load<T: Decodable>(_ type: T.Type, for key: String) -> T? {
        guard let data = try? Data(contentsOf: url(for: key)) else { return nil }
        return try? decoder.decode(type, from: data)
    }

    func remove(_ key: String) {
        try? FileManager.default.removeItem(at: url(for: key))
    }

    /// Age of a cached entry, so a screen can say "updated 5 minutes ago".
    func modifiedAt(_ key: String) -> Date? {
        try? FileManager.default
            .attributesOfItem(atPath: url(for: key).path)[.modificationDate] as? Date
    }

    func clearAll() {
        guard let contents = try? FileManager.default.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: nil
        ) else { return }
        for file in contents { try? FileManager.default.removeItem(at: file) }
    }

    // MARK: - Key namespace

    enum Key {
        static let projects = "projects"
        static func scripts(_ projectID: String) -> String { "scripts-\(projectID)" }
        static func elements(_ scriptID: String) -> String { "elements-\(scriptID)" }
        static func scenes(_ projectID: String) -> String { "scenes-\(projectID)" }
        static func shots(_ projectID: String) -> String { "shots-\(projectID)" }
        static func characters(_ projectID: String) -> String { "characters-\(projectID)" }
        static func schedule(_ projectID: String) -> String { "schedule-\(projectID)" }
        static func locations(_ projectID: String) -> String { "locations-\(projectID)" }
    }
}
