import SwiftUI

/// Loads the counts and progress shown on the project hub.
///
/// One view model fetches all five collections because the hub summarises every
/// one of them, and the child screens read from the same cache — so opening
/// Scenes after the hub has loaded is instant.
@MainActor
final class ProjectHubViewModel: ObservableObject {

    @Published private(set) var scripts: [Script] = []
    @Published private(set) var scenes: [ProductionScene] = []
    @Published private(set) var shots: [Shot] = []
    @Published private(set) var characters: [ProjectCharacter] = []
    @Published private(set) var events: [ScheduleEvent] = []

    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let projectID: String
    private var hasLoaded = false

    init(projectID: String) {
        self.projectID = projectID
    }

    // MARK: - Derived summaries

    var sceneCount: Int { scenes.count }
    var shotCount: Int { shots.count }
    var characterCount: Int { characters.count }

    var completedScenes: Int { scenes.filter(\.done).count }
    var completedShots: Int { shots.filter(\.done).count }

    var sceneProgress: Double {
        scenes.isEmpty ? 0 : Double(completedScenes) / Double(scenes.count)
    }

    var shotProgress: Double {
        shots.isEmpty ? 0 : Double(completedShots) / Double(shots.count)
    }

    /// Total page count across the breakdown, in eighths.
    var totalPages: Double {
        scenes.reduce(0) { $0 + ($1.pageCount ?? 0) }
    }

    var pagesLabel: String? {
        guard totalPages > 0 else { return nil }
        return String(format: "%.1f pages", totalPages)
    }

    /// The next scheduled thing, which is what someone opening the app on a
    /// shoot day actually wants to know.
    var nextEvent: ScheduleEvent? {
        let now = Date()
        return events
            .filter { $0.endTime >= now }
            .min { $0.startTime < $1.startTime }
    }

    var activeScript: Script? {
        ScriptService.preferredScript(
            from: scripts,
            remembered: UserDefaults.standard.string(forKey: "ss.lastScript.\(projectID)")
        )
    }

    // MARK: - Loading

    func loadIfNeeded() async {
        guard !hasLoaded else {
            await refresh()
            return
        }
        hasLoaded = true

        await loadFromCache()
        if scenes.isEmpty && shots.isEmpty && scripts.isEmpty { isLoading = true }
        await refresh()
        isLoading = false
    }

    private func loadFromCache() async {
        let cache = LocalCache.shared
        async let cachedScripts = cache.load([Script].self, for: LocalCache.Key.scripts(projectID))
        async let cachedScenes = cache.load([ProductionScene].self, for: LocalCache.Key.scenes(projectID))
        async let cachedShots = cache.load([Shot].self, for: LocalCache.Key.shots(projectID))
        async let cachedCharacters = cache.load([ProjectCharacter].self, for: LocalCache.Key.characters(projectID))
        async let cachedEvents = cache.load([ScheduleEvent].self, for: LocalCache.Key.schedule(projectID))

        scripts = await cachedScripts ?? []
        scenes = await cachedScenes ?? []
        shots = await cachedShots ?? []
        characters = await cachedCharacters ?? []
        events = await cachedEvents ?? []
    }

    func refresh() async {
        // All five run concurrently — five sequential round trips on a cellular
        // connection is roughly a second of staring at a half-empty screen.
        //
        // Each result is applied on its own. An earlier version awaited them as
        // one tuple, which meant a single failing table threw away the other
        // four: if the schedule fetch was rejected, the script list vanished
        // too and the hub offered to create a script the project already had.
        async let scriptsTask = fetched { try await ScriptService.fetchScripts(projectID: self.projectID) }
        async let scenesTask = fetched { try await ProductionService.fetchScenes(projectID: self.projectID) }
        async let shotsTask = fetched { try await ProductionService.fetchShots(projectID: self.projectID) }
        async let charactersTask = fetched { try await ProductionService.fetchCharacters(projectID: self.projectID) }
        async let eventsTask = fetched { try await ProductionService.fetchSchedule(projectID: self.projectID) }

        let (newScripts, newScenes, newShots, newCharacters, newEvents) =
            await (scriptsTask, scenesTask, shotsTask, charactersTask, eventsTask)

        let cache = LocalCache.shared
        var failures: [String] = []

        switch newScripts {
        case .success(let rows):
            scripts = rows
            await cache.save(rows, for: LocalCache.Key.scripts(projectID))
        case .failure(let error):
            failures.append("scripts: \(message(for: error))")
        }

        switch newScenes {
        case .success(let rows):
            scenes = rows
            await cache.save(rows, for: LocalCache.Key.scenes(projectID))
        case .failure(let error):
            failures.append("scenes: \(message(for: error))")
        }

        switch newShots {
        case .success(let rows):
            shots = rows
            await cache.save(rows, for: LocalCache.Key.shots(projectID))
        case .failure(let error):
            failures.append("shots: \(message(for: error))")
        }

        switch newCharacters {
        case .success(let rows):
            characters = rows
            await cache.save(rows, for: LocalCache.Key.characters(projectID))
        case .failure(let error):
            failures.append("characters: \(message(for: error))")
        }

        switch newEvents {
        case .success(let rows):
            events = rows
            await cache.save(rows, for: LocalCache.Key.schedule(projectID))
        case .failure(let error):
            failures.append("schedule: \(message(for: error))")
        }

        errorMessage = failures.isEmpty ? nil : failures.joined(separator: "\n")
    }

    /// Runs a fetch and captures the outcome instead of letting it cancel its
    /// siblings. Cancellation is not a failure — the screen simply went away.
    private func fetched<T>(_ work: @escaping () async throws -> [T]) async -> Result<[T], Error> {
        do {
            return .success(try await work())
        } catch is CancellationError {
            return .failure(CancellationError())
        } catch {
            return .failure(error)
        }
    }

    private func message(for error: Error) -> String {
        if error is CancellationError { return "cancelled" }
        return (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
    }

    /// Remembers which draft was last opened, so the hub reopens the same one.
    func remember(_ script: Script) {
        UserDefaults.standard.set(script.id, forKey: "ss.lastScript.\(projectID)")
        objectWillChange.send()
    }

    /// Creates an additional draft alongside the existing ones.
    func createDraft(title: String, ownerID: String) async -> Script? {
        do {
            guard let created = try await ScriptService.createScript(
                projectID: projectID, title: title, ownerID: ownerID
            ) else { return nil }
            scripts.insert(created, at: 0)
            await LocalCache.shared.save(scripts, for: LocalCache.Key.scripts(projectID))
            remember(created)
            Haptics.success()
            return created
        } catch {
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
            return nil
        }
    }

    /// Creates the first script so the editor always has something to open.
    func ensureScript(ownerID: String, projectTitle: String) async -> Script? {
        if let existing = activeScript { return existing }

        // Ask the server before creating anything. If the earlier load failed,
        // the local list being empty says nothing about whether the project
        // already has a draft — and creating a second empty one would be worse
        // than showing an error.
        if let remote = try? await ScriptService.fetchScripts(projectID: projectID), !remote.isEmpty {
            scripts = remote
            await LocalCache.shared.save(remote, for: LocalCache.Key.scripts(projectID))
            return activeScript
        }

        do {
            let created = try await ScriptService.createScript(
                projectID: projectID, title: projectTitle, ownerID: ownerID
            )
            if let created {
                scripts.insert(created, at: 0)
                await LocalCache.shared.save(scripts, for: LocalCache.Key.scripts(projectID))
            }
            return created
        } catch {
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            return nil
        }
    }
}
