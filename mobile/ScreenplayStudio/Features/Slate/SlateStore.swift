import Foundation

/// Where a project's slate keeps its board and take log between launches.
///
/// The board is small and lives in `UserDefaults`. The take log can run to
/// hundreds of takes on a long day, so it goes to a file in Application
/// Support, written off the main thread so marking a take never waits on disk.
struct SlateStore {

    /// Everything about the take log that has to survive a relaunch.
    struct Log: Codable {
        var takes: [SlateTake] = []
        /// Takes deleted on the slate that the camera report still has.
        var removed: [SlateTake] = []
        /// Reports (day · roll · camera) with changes not yet written.
        var dirtyReports: Set<CameraReportKey> = []
    }

    /// The most takes kept on the device. A feature shoots a few hundred a day.
    static let takeLimit = 3_000

    private let projectID: String
    private let stateKey: String
    private let legacyTakesKey: String
    private let fileURL: URL
    private static let writer = DispatchQueue(label: "no.northem.screenplaystudio.slate-store", qos: .utility)

    init(projectID: String) {
        self.projectID = projectID
        stateKey = "ss.slate.\(projectID)"
        legacyTakesKey = "ss.slate.\(projectID).takes"
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = base.appendingPathComponent("ScreenplayStudio/Slate", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("\(projectID).json")
    }

    // MARK: - Board

    func loadState(projectTitle: String) -> SlateState {
        if let data = UserDefaults.standard.data(forKey: stateKey),
           let restored = try? JSONDecoder().decode(SlateState.self, from: data) {
            return restored
        }
        var fresh = SlateState()
        fresh.production = projectTitle
        return fresh
    }

    func save(_ state: SlateState) {
        guard let data = try? JSONEncoder().encode(state) else { return }
        UserDefaults.standard.set(data, forKey: stateKey)
    }

    // MARK: - Take log

    func loadLog() -> Log {
        if let data = try? Data(contentsOf: fileURL),
           let log = try? JSONDecoder().decode(Log.self, from: data) {
            return log
        }
        // Builds before 1.1 kept up to 200 takes in UserDefaults.
        var log = Log()
        if let data = UserDefaults.standard.data(forKey: legacyTakesKey),
           let takes = try? JSONDecoder().decode([SlateTake].self, from: data) {
            log.takes = takes
            save(log)
            UserDefaults.standard.removeObject(forKey: legacyTakesKey)
        }
        return log
    }

    func save(_ log: Log) {
        var trimmed = log
        if trimmed.takes.count > Self.takeLimit {
            trimmed.takes.removeLast(trimmed.takes.count - Self.takeLimit)
        }
        let url = fileURL
        Self.writer.async {
            guard let data = try? JSONEncoder().encode(trimmed) else { return }
            try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
    }

    /// Clears every project's slate from the device — on sign-out.
    static func removeAll() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.removeItem(at: base.appendingPathComponent("ScreenplayStudio/Slate", isDirectory: true))
        let defaults = UserDefaults.standard
        for key in defaults.dictionaryRepresentation().keys where key.hasPrefix("ss.slate.") {
            defaults.removeObject(forKey: key)
        }
    }
}
