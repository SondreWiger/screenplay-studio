import Foundation

/// Where the slate keeps its board and take log on the device.
///
/// Application Support, not the cache directory the rest of the app uses: iOS
/// clears caches when space runs low, and a day's take log is a production
/// record, not something to re-download.
final class SlateStore {

    static let shared = SlateStore()

    /// Posted (with the project ID) when the slate screen closes, so screens
    /// showing its status can re-read it.
    static let didClose = Notification.Name("SlateStoreDidClose")

    struct Snapshot: Codable {
        var state: SlateState
        var takes: [SlateTake]
        /// Takes deleted here that may still be in a report, so the next sync
        /// removes them there too.
        var deletedTakeIDs: [UUID] = []
        /// Reports with changes not yet sent.
        var dirtyReports: [SlateReportKey] = []
    }

    private let directory: URL
    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    private init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        directory = base.appendingPathComponent("Slate", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        // Kept out of iCloud device backups only if the user wants it; by
        // default a take log is worth backing up.
    }

    private func url(for projectID: String) -> URL {
        let safe = projectID.replacingOccurrences(of: "/", with: "_")
        return directory.appendingPathComponent("\(safe).json")
    }

    func load(projectID: String) -> Snapshot? {
        let file = url(for: projectID)
        if let data = try? Data(contentsOf: file) {
            if let snapshot = try? decoder.decode(Snapshot.self, from: data) {
                return snapshot
            }
            // Unreadable: keep it to one side rather than let the next save
            // write an empty log over a day's takes.
            let stamp = Int(Date().timeIntervalSince1970)
            let aside = file.deletingPathExtension().appendingPathExtension("corrupt-\(stamp).json")
            try? FileManager.default.moveItem(at: file, to: aside)
            return nil
        }
        return migrateFromDefaults(projectID: projectID)
    }

    func save(_ snapshot: Snapshot, projectID: String) {
        guard let data = try? encoder.encode(snapshot) else { return }
        try? data.write(to: url(for: projectID), options: .atomic)
    }

    func remove(projectID: String) {
        try? FileManager.default.removeItem(at: url(for: projectID))
    }

    func removeAll() {
        try? FileManager.default.removeItem(at: directory)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    /// The first version kept the board and takes in `UserDefaults`.
    private func migrateFromDefaults(projectID: String) -> Snapshot? {
        let key = "ss.slate.\(projectID)"
        let defaults = UserDefaults.standard
        guard let stateData = defaults.data(forKey: key),
              let state = try? JSONDecoder().decode(SlateState.self, from: stateData) else { return nil }
        let takes = defaults.data(forKey: key + ".takes")
            .flatMap { try? JSONDecoder().decode([SlateTake].self, from: $0) } ?? []
        let snapshot = Snapshot(state: state, takes: takes)
        save(snapshot, projectID: projectID)
        defaults.removeObject(forKey: key)
        defaults.removeObject(forKey: key + ".takes")
        return snapshot
    }
}
