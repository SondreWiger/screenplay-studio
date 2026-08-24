import SwiftUI

@MainActor
final class ShotsViewModel: ObservableObject {

    enum Grouping: String, CaseIterable, Identifiable {
        case scene, order
        var id: String { rawValue }
        var label: String { self == .scene ? "By scene" : "In order" }
    }

    @Published private(set) var shots: [Shot] = []
    /// Loaded here rather than passed in from the project hub: the shot list is
    /// reachable directly from a deep link, and grouping must not depend on
    /// another screen having run first.
    @Published private(set) var scenes: [ProductionScene] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var searchText = ""
    @Published var grouping: Grouping = .scene
    @Published var hideCompleted = false

    private let projectID: String
    private var hasLoaded = false
    private var liveTask: Task<Void, Never>?

    init(projectID: String) {
        self.projectID = projectID
    }

    deinit { liveTask?.cancel() }

    func startLiveUpdates() {
        guard liveTask == nil else { return }
        liveTask = Task { [weak self, projectID] in
            let stream = await RealtimeClient.shared.changes(
                table: "shots", filter: "project_id=eq.\(projectID)"
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
        let changed = LiveMerge.apply(change, to: &shots) { a, b in
            (a.sortOrder ?? 0) < (b.sortOrder ?? 0)
        }
        guard changed else { return }
        Task { await LocalCache.shared.save(shots, for: LocalCache.Key.shots(projectID)) }
    }

    private var sceneLookup: [String: ProductionScene] {
        Dictionary(uniqueKeysWithValues: scenes.map { ($0.id, $0) })
    }

    func scene(for shot: Shot) -> ProductionScene? {
        guard let id = shot.sceneID else { return nil }
        return sceneLookup[id]
    }

    var filteredShots: [Shot] {
        var result = shots

        if hideCompleted { result = result.filter { !$0.done } }

        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !term.isEmpty {
            result = result.filter {
                ($0.description?.lowercased().contains(term) ?? false)
                    || ($0.shotNumber?.lowercased().contains(term) ?? false)
                    || ($0.lens?.lowercased().contains(term) ?? false)
                    || $0.techSummary.lowercased().contains(term)
            }
        }

        return result
    }

    /// Shots bucketed under their scene, with unassigned shots last.
    var groupedShots: [(scene: ProductionScene?, shots: [Shot])] {
        guard grouping == .scene else {
            return [(scene: nil, shots: filteredShots)]
        }

        let lookup = sceneLookup
        let grouped = Dictionary(grouping: filteredShots) { $0.sceneID ?? "" }

        var sections: [(scene: ProductionScene?, shots: [Shot])] = scenes.compactMap { scene in
            guard let shots = grouped[scene.id], !shots.isEmpty else { return nil }
            return (scene: scene, shots: shots)
        }

        // Anything pointing at a scene that no longer exists, plus loose shots.
        let orphans = filteredShots.filter { shot in
            guard let id = shot.sceneID else { return true }
            return lookup[id] == nil
        }
        if !orphans.isEmpty {
            sections.append((scene: nil, shots: orphans))
        }
        return sections
    }

    var completedCount: Int { shots.filter(\.done).count }

    var totalDuration: Int {
        shots.reduce(0) { $0 + ($1.durationSeconds ?? 0) }
    }

    var durationLabel: String? {
        guard totalDuration > 0 else { return nil }
        let minutes = totalDuration / 60
        return minutes >= 60
            ? String(format: "%dh %dm", minutes / 60, minutes % 60)
            : "\(minutes)m"
    }

    // MARK: - Loading

    func loadIfNeeded() async {
        guard !hasLoaded else {
            await refresh()
            return
        }
        hasLoaded = true

        let cache = LocalCache.shared
        async let cachedShots = cache.load([Shot].self, for: LocalCache.Key.shots(projectID))
        async let cachedScenes = cache.load([ProductionScene].self, for: LocalCache.Key.scenes(projectID))
        shots = await cachedShots ?? []
        scenes = await cachedScenes ?? []

        if shots.isEmpty { isLoading = true }
        await refresh()
        isLoading = false
    }

    func refresh() async {
        async let shotsTask = ProductionService.fetchShots(projectID: projectID)
        async let scenesTask = ProductionService.fetchScenes(projectID: projectID)

        do {
            let (fetchedShots, fetchedScenes) = try await (shotsTask, scenesTask)
            shots = fetchedShots
            scenes = fetchedScenes
            errorMessage = nil

            let cache = LocalCache.shared
            await cache.save(fetchedShots, for: LocalCache.Key.shots(projectID))
            await cache.save(fetchedScenes, for: LocalCache.Key.scenes(projectID))
        } catch is CancellationError {
        } catch {
            if shots.isEmpty {
                errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    // MARK: - Mutations

    func toggleCompleted(_ shot: Shot) async {
        guard let index = shots.firstIndex(where: { $0.id == shot.id }) else { return }
        let newValue = !shot.done
        shots[index].isCompleted = newValue
        Haptics.tap()

        do {
            try await ProductionService.setShotCompleted(id: shot.id, completed: newValue)
            await LocalCache.shared.save(shots, for: LocalCache.Key.shots(projectID))
        } catch {
            shots[index].isCompleted = shot.isCompleted
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }

    /// Bumps the take counter — the one thing anyone does with a shot list while
    /// the camera is rolling.
    func addTake(to shot: Shot) async {
        guard let index = shots.firstIndex(where: { $0.id == shot.id }) else { return }
        let previous = shots[index].takesCompleted ?? 0
        let newValue = previous + 1
        shots[index].takesCompleted = newValue
        Haptics.impact()

        do {
            try await ProductionService.setTakesCompleted(id: shot.id, takes: newValue)
            await LocalCache.shared.save(shots, for: LocalCache.Key.shots(projectID))
        } catch {
            shots[index].takesCompleted = previous
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }

    func create(
        sceneID: String?,
        shotNumber: String?,
        type: ShotType,
        movement: ShotMovement,
        description: String?,
        lens: String?,
        ownerID: String?
    ) async -> Shot? {
        do {
            let created = try await ProductionService.createShot(
                projectID: projectID,
                sceneID: sceneID,
                shotNumber: shotNumber,
                type: type,
                movement: movement,
                description: description,
                lens: lens,
                sortOrder: shots.count,
                ownerID: ownerID
            )
            if let created {
                shots.append(created)
                await LocalCache.shared.save(shots, for: LocalCache.Key.shots(projectID))
                Haptics.success()
            }
            return created
        } catch {
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
            return nil
        }
    }

    func delete(_ shot: Shot) async {
        let previous = shots
        shots.removeAll { $0.id == shot.id }
        do {
            try await ProductionService.deleteShot(id: shot.id)
            await LocalCache.shared.save(shots, for: LocalCache.Key.shots(projectID))
            Haptics.success()
        } catch {
            shots = previous
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }

    /// Suggests the next shot number in the scene's series (1A, 1B, …).
    func suggestedShotNumber(for sceneID: String?) -> String {
        let inScene = shots.filter { $0.sceneID == sceneID }
        let sceneNumber = sceneID.flatMap { id in scenes.first { $0.id == id }?.sceneNumber?.nonEmpty }
            ?? "\(inScene.count + 1)"

        guard sceneID != nil else { return "\(shots.count + 1)" }

        let letters = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        let index = inScene.count
        guard index < letters.count else { return "\(sceneNumber)-\(index + 1)" }
        return "\(sceneNumber)\(letters[index])"
    }
}
