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
        async let scriptsTask = ScriptService.fetchScripts(projectID: projectID)
        async let scenesTask = ProductionService.fetchScenes(projectID: projectID)
        async let shotsTask = ProductionService.fetchShots(projectID: projectID)
        async let charactersTask = ProductionService.fetchCharacters(projectID: projectID)
        async let eventsTask = ProductionService.fetchSchedule(projectID: projectID)

        do {
            let (fetchedScripts, fetchedScenes, fetchedShots, fetchedCharacters, fetchedEvents) =
                try await (scriptsTask, scenesTask, shotsTask, charactersTask, eventsTask)

            scripts = fetchedScripts
            scenes = fetchedScenes
            shots = fetchedShots
            characters = fetchedCharacters
            events = fetchedEvents
            errorMessage = nil

            let cache = LocalCache.shared
            await cache.save(fetchedScripts, for: LocalCache.Key.scripts(projectID))
            await cache.save(fetchedScenes, for: LocalCache.Key.scenes(projectID))
            await cache.save(fetchedShots, for: LocalCache.Key.shots(projectID))
            await cache.save(fetchedCharacters, for: LocalCache.Key.characters(projectID))
            await cache.save(fetchedEvents, for: LocalCache.Key.schedule(projectID))

        } catch is CancellationError {
            // Navigated away.
        } catch {
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
        }
    }

    /// Creates the first script so the editor always has something to open.
    func ensureScript(ownerID: String, projectTitle: String) async -> Script? {
        if let existing = activeScript { return existing }
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
