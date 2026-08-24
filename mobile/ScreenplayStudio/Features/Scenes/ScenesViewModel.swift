import SwiftUI

@MainActor
final class ScenesViewModel: ObservableObject {

    enum Filter: String, CaseIterable, Identifiable {
        case all, day, night, remaining, shot
        var id: String { rawValue }

        var label: String {
            switch self {
            case .all:       return "All"
            case .day:       return "Day"
            case .night:     return "Night"
            case .remaining: return "To shoot"
            case .shot:      return "Shot"
            }
        }
    }

    @Published private(set) var scenes: [ProductionScene] = []
    @Published private(set) var locations: [ProductionLocation] = []
    @Published private(set) var characters: [ProjectCharacter] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var searchText = ""
    @Published var filter: Filter = .all

    private let projectID: String
    private var hasLoaded = false
    private var liveTask: Task<Void, Never>?

    init(projectID: String) {
        self.projectID = projectID
    }

    deinit { liveTask?.cancel() }

    /// Streams scene changes made anywhere — the web app, another phone, a
    /// collaborator — straight into this list.
    func startLiveUpdates() {
        guard liveTask == nil else { return }
        liveTask = Task { [weak self, projectID] in
            let stream = await RealtimeClient.shared.changes(
                table: "scenes", filter: "project_id=eq.\(projectID)"
            )
            for await change in stream {
                guard let self else { return }
                await self.applyLive(change)
            }
        }
    }

    func stopLiveUpdates() {
        liveTask?.cancel()
        liveTask = nil
    }

    private func applyLive(_ change: RealtimeChange) {
        let changed = LiveMerge.apply(change, to: &scenes) { a, b in
            (a.sortOrder ?? 0) < (b.sortOrder ?? 0)
        }
        guard changed else { return }
        Task { await LocalCache.shared.save(scenes, for: LocalCache.Key.scenes(projectID)) }
    }

    var filteredScenes: [ProductionScene] {
        var result = scenes

        switch filter {
        case .all:       break
        case .day:       result = result.filter { !($0.timeOfDay?.isNight ?? false) }
        case .night:     result = result.filter { $0.timeOfDay?.isNight ?? false }
        case .remaining: result = result.filter { !$0.done }
        case .shot:      result = result.filter(\.done)
        }

        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !term.isEmpty {
            result = result.filter {
                $0.displayHeading.lowercased().contains(term)
                    || ($0.synopsis?.lowercased().contains(term) ?? false)
                    || ($0.sceneNumber?.lowercased().contains(term) ?? false)
                    || ($0.locationName?.lowercased().contains(term) ?? false)
            }
        }

        return result
    }

    var completedCount: Int { scenes.filter(\.done).count }

    var totalPages: Double { scenes.reduce(0) { $0 + ($1.pageCount ?? 0) } }

    /// Name lookup so a scene row can show who's in it rather than a UUID.
    func characterNames(for scene: ProductionScene) -> [String] {
        guard let ids = scene.castIDs, !ids.isEmpty else { return [] }
        let byID = Dictionary(uniqueKeysWithValues: characters.map { ($0.id, $0.name) })
        return ids.compactMap { byID[$0] }
    }

    func locationName(for scene: ProductionScene) -> String? {
        guard let id = scene.locationID else { return nil }
        return locations.first { $0.id == id }?.name
    }

    // MARK: - Loading

    func loadIfNeeded() async {
        guard !hasLoaded else {
            await refresh()
            return
        }
        hasLoaded = true

        let cache = LocalCache.shared
        async let cachedScenes = cache.load([ProductionScene].self, for: LocalCache.Key.scenes(projectID))
        async let cachedCharacters = cache.load([ProjectCharacter].self, for: LocalCache.Key.characters(projectID))
        async let cachedLocations = cache.load([ProductionLocation].self, for: LocalCache.Key.locations(projectID))

        scenes = await cachedScenes ?? []
        characters = await cachedCharacters ?? []
        locations = await cachedLocations ?? []

        if scenes.isEmpty { isLoading = true }
        await refresh()
        isLoading = false
    }

    func refresh() async {
        async let scenesTask = ProductionService.fetchScenes(projectID: projectID)
        async let charactersTask = ProductionService.fetchCharacters(projectID: projectID)
        async let locationsTask = ProductionService.fetchLocations(projectID: projectID)

        do {
            let (fetchedScenes, fetchedCharacters, fetchedLocations) =
                try await (scenesTask, charactersTask, locationsTask)

            scenes = fetchedScenes
            characters = fetchedCharacters
            locations = fetchedLocations
            errorMessage = nil

            let cache = LocalCache.shared
            await cache.save(fetchedScenes, for: LocalCache.Key.scenes(projectID))
            await cache.save(fetchedCharacters, for: LocalCache.Key.characters(projectID))
            await cache.save(fetchedLocations, for: LocalCache.Key.locations(projectID))

        } catch is CancellationError {
        } catch {
            if scenes.isEmpty {
                errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    // MARK: - Mutations

    func toggleCompleted(_ scene: ProductionScene) async {
        guard let index = scenes.firstIndex(where: { $0.id == scene.id }) else { return }
        let newValue = !scene.done
        scenes[index].isCompleted = newValue
        Haptics.tap()

        do {
            try await ProductionService.setSceneCompleted(id: scene.id, completed: newValue)
            await LocalCache.shared.save(scenes, for: LocalCache.Key.scenes(projectID))
        } catch {
            scenes[index].isCompleted = scene.isCompleted
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }

    func create(
        heading: String,
        locationType: SceneLocationType,
        locationName: String?,
        timeOfDay: SceneTime,
        ownerID: String?
    ) async -> ProductionScene? {
        do {
            let created = try await ProductionService.createScene(
                projectID: projectID,
                heading: heading,
                locationType: locationType,
                locationName: locationName,
                timeOfDay: timeOfDay,
                sortOrder: scenes.count,
                ownerID: ownerID
            )
            if let created {
                scenes.append(created)
                await LocalCache.shared.save(scenes, for: LocalCache.Key.scenes(projectID))
                Haptics.success()
            }
            return created
        } catch {
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
            return nil
        }
    }

    func delete(_ scene: ProductionScene) async {
        let previous = scenes
        scenes.removeAll { $0.id == scene.id }
        do {
            try await ProductionService.deleteScene(id: scene.id)
            await LocalCache.shared.save(scenes, for: LocalCache.Key.scenes(projectID))
            Haptics.success()
        } catch {
            scenes = previous
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }

    /// Applies an edited scene coming back from the detail screen.
    func apply(_ updated: ProductionScene) {
        guard let index = scenes.firstIndex(where: { $0.id == updated.id }) else { return }
        scenes[index] = updated
        Task { await LocalCache.shared.save(scenes, for: LocalCache.Key.scenes(projectID)) }
    }
}
