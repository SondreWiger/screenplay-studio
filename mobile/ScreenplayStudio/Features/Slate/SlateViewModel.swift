import SwiftUI
import AVFoundation
import AudioToolbox

@MainActor
final class SlateViewModel: ObservableObject {

    @Published var state: SlateState
    @Published private(set) var takes: [SlateTake] = []
    @Published private(set) var isClosed = false
    @Published private(set) var lastMarkedAt: Date?
    @Published var errorMessage: String?

    /// Shots in the project, so the slate can be pointed at one and takes
    /// logged against it rather than floating free.
    @Published private(set) var shots: [Shot] = []
    @Published private(set) var scenes: [ProductionScene] = []

    private let projectID: String
    private let storageKey: String
    private var closeResetTask: Task<Void, Never>?

    init(projectID: String, projectTitle: String) {
        self.projectID = projectID
        self.storageKey = "ss.slate.\(projectID)"

        // Restore the board as it was left — a slate that forgets the roll
        // number between launches is worse than no slate.
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let restored = try? JSONDecoder().decode(SlateState.self, from: data) {
            state = restored
        } else {
            var fresh = SlateState()
            fresh.production = projectTitle
            state = fresh
        }

        if let data = UserDefaults.standard.data(forKey: storageKey + ".takes"),
           let restored = try? JSONDecoder().decode([SlateTake].self, from: data) {
            takes = restored
        }
    }

    // MARK: - Persistence

    func persist() {
        if let data = try? JSONEncoder().encode(state) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
        if let data = try? JSONEncoder().encode(Array(takes.prefix(200))) {
            UserDefaults.standard.set(data, forKey: storageKey + ".takes")
        }
    }

    // MARK: - Loading context

    func loadContext() async {
        let cache = LocalCache.shared
        async let cachedShots = cache.load([Shot].self, for: LocalCache.Key.shots(projectID))
        async let cachedScenes = cache.load([ProductionScene].self, for: LocalCache.Key.scenes(projectID))
        shots = await cachedShots ?? []
        scenes = await cachedScenes ?? []

        // Refresh quietly; the slate has to work offline on set, so a failure
        // here is not worth interrupting anyone over.
        if let fetchedShots = try? await ProductionService.fetchShots(projectID: projectID) {
            shots = fetchedShots
            await cache.save(fetchedShots, for: LocalCache.Key.shots(projectID))
        }
        if let fetchedScenes = try? await ProductionService.fetchScenes(projectID: projectID) {
            scenes = fetchedScenes
            await cache.save(fetchedScenes, for: LocalCache.Key.scenes(projectID))
        }
    }

    var linkedShot: Shot? {
        guard let id = state.linkedShotID else { return nil }
        return shots.first { $0.id == id }
    }

    /// Points the slate at a shot and fills in what the board can infer.
    func link(to shot: Shot) {
        state.linkedShotID = shot.id
        state.linkedSceneID = shot.sceneID

        if let sceneID = shot.sceneID,
           let scene = scenes.first(where: { $0.id == sceneID }) {
            state.linkedSceneID = sceneID
            if let number = scene.sceneNumber?.nonEmpty { state.scene = number }
            state.isInterior = scene.locationType != .exterior
            state.isDay = !(scene.timeOfDay?.isNight ?? false)
        } else if let number = shot.shotNumber?.nonEmpty {
            state.scene = number
        }

        // Continue the count rather than restarting it.
        state.take = (shot.takesCompleted ?? 0) + 1
        persist()
        Haptics.selectionChanged()
    }

    func unlink() {
        state.linkedShotID = nil
        state.linkedSceneID = nil
        persist()
        Haptics.tap()
    }

    // MARK: - Marking

    /// Claps the sticks: animation, haptic, sound, log, and — if the slate is
    /// pointed at a shot — a take recorded against it in the shot list.
    func mark() {
        guard !isClosed else { return }

        isClosed = true
        lastMarkedAt = Date()

        playClap()

        let take = SlateTake(
            roll: state.roll,
            scene: state.scene,
            take: state.take,
            isMOS: state.isMOS
        )
        takes.insert(take, at: 0)

        if let shot = linkedShot {
            Task { await logTake(on: shot) }
        }

        persist()

        // Reopen the sticks after the beat it takes to pull the board out of
        // frame, then advance the take so the board is ready for the next one.
        closeResetTask?.cancel()
        closeResetTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(1400))
            guard let self, !Task.isCancelled else { return }
            self.isClosed = false
            self.state.take += 1
            self.persist()
        }
    }

    /// Marks a take as a print — the circled take.
    func toggleCircle(_ take: SlateTake) {
        guard let index = takes.firstIndex(where: { $0.id == take.id }) else { return }
        takes[index].isCircled.toggle()
        Haptics.tap()
        persist()
    }

    func deleteTake(_ take: SlateTake) {
        takes.removeAll { $0.id == take.id }
        persist()
        Haptics.tap()
    }

    func adjustTake(by delta: Int) {
        state.take = max(1, state.take + delta)
        Haptics.selectionChanged()
        persist()
    }

    /// Rolls to the next camera roll and resets the take, the way an AC does at
    /// a magazine change.
    func nextRoll() {
        let digits = state.roll.filter(\.isNumber)
        let prefix = state.roll.prefix(while: { !$0.isNumber })
        if let number = Int(digits) {
            state.roll = "\(prefix)\(String(format: "%0\(max(digits.count, 3))d", number + 1))"
        } else {
            state.roll += "1"
        }
        state.take = 1
        Haptics.impact()
        persist()
    }

    private func logTake(on shot: Shot) async {
        let next = (shot.takesCompleted ?? 0) + 1
        do {
            try await ProductionService.setTakesCompleted(id: shot.id, takes: next)
            if let index = shots.firstIndex(where: { $0.id == shot.id }) {
                shots[index].takesCompleted = next
                await LocalCache.shared.save(shots, for: LocalCache.Key.shots(projectID))
            }
        } catch {
            // On set, a failed write must not stop the next take being marked.
            // It gets queued and replayed, not thrown in anyone's face.
            await SyncQueue.shared.enqueue(
                PendingMutation(
                    table: "shots",
                    kind: .update,
                    matchColumn: "id",
                    matchValue: shot.id,
                    payload: try? JSONEncoder.supabase.encode(["takes_completed": next])
                )
            )
        }
    }

    // MARK: - Clap

    private func playClap() {
        Haptics.impact()
        // A second, heavier tap a fraction later reads as sticks hitting rather
        // than a single button press.
        Task {
            try? await Task.sleep(for: .milliseconds(45))
            Haptics.success()
        }

        guard AppSettings.shared.slateSoundEnabled else { return }
        // A short, sharp system sound, deliberately not routed through an
        // `AVAudioSession` playback category so it never interrupts audio being
        // recorded elsewhere.
        AudioServicesPlaySystemSound(1104)
    }
}
