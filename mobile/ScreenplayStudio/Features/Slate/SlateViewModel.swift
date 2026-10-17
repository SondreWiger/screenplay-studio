import SwiftUI
import Combine

@MainActor
final class SlateViewModel: ObservableObject {

    enum ReportStatus: Equatable {
        case off
        case idle
        case syncing
        case synced(Date)
        /// Changes are waiting for a connection.
        case waiting
        case failed(String)
    }

    @Published var state: SlateState
    @Published private(set) var takes: [SlateTake] = []
    /// Sticks closed: from the clap until the hold runs out.
    @Published private(set) var isClosed = false
    /// The clap frame, frozen on the board while the sticks are closed.
    @Published private(set) var heldReading: TimecodeReading?
    /// Bumped on each clap; the board flashes when it changes.
    @Published private(set) var flashCount = 0
    @Published private(set) var reportStatus: ReportStatus = .idle

    /// Shots in the project, so the slate can be pointed at one and takes
    /// logged against it rather than floating free.
    @Published private(set) var shots: [Shot] = []
    @Published private(set) var scenes: [ProductionScene] = []

    let ltc = LTCReader()

    let projectID: String
    private let store: SlateStore
    private var removedTakes: [SlateTake] = []
    private var dirtyReports: Set<CameraReportKey> = []
    private var ownerID: String?

    private let clapSound = ClapSound()
    private var reopenTask: Task<Void, Never>?
    private var reportTask: Task<Void, Never>?
    private var cancellables: Set<AnyCancellable> = []
    private var lastJamPersist = Date.distantPast
    private var isActive = false

    init(projectID: String, projectTitle: String) {
        self.projectID = projectID
        store = SlateStore(projectID: projectID)
        // Restore the board as it was left — a slate that forgets the roll
        // number between launches is worse than no slate.
        state = store.loadState(projectTitle: projectTitle)
        state.isTail = false
        let log = store.loadLog()
        takes = log.takes
        removedTakes = log.removed
        dirtyReports = log.dirtyReports
        if !state.logToCameraReport { reportStatus = .off }

        ltc.$reference
            .compactMap { $0 }
            .sink { [weak self] reference in self?.follow(reference) }
            .store(in: &cancellables)

        NetworkMonitor.shared.$isOnline
            .removeDuplicates()
            .filter { $0 }
            .sink { [weak self] _ in self?.scheduleReportSync(after: .milliseconds(500)) }
            .store(in: &cancellables)
    }

    // MARK: - Lifecycle

    func activate(ownerID: String?) {
        self.ownerID = ownerID
        guard !isActive else { return }
        isActive = true
        if AppSettings.shared.slateSoundEnabled { clapSound.start() }
        if state.timecodeSource == .ltc { Task { await ltc.start() } }
        scheduleReportSync(after: .milliseconds(300))
    }

    func deactivate() {
        guard isActive else { return }
        isActive = false
        clapSound.stop()
        ltc.stop()
        persist()
    }

    // MARK: - Timecode

    /// What the board shows right now.
    func reading(at monotonic: Double = MonotonicClock.now()) -> TimecodeReading {
        heldReading ?? state.clock.reading(at: monotonic)
    }

    func setSource(_ source: TimecodeSource) {
        state.timecodeSource = source
        if source == .ltc {
            Task { await ltc.start() }
        } else {
            ltc.stop()
        }
        if source == .jam, state.jam == nil { jamToTimeOfDay() }
        persist()
        Haptics.selectionChanged()
    }

    func setFrameRate(_ rate: FrameRate) {
        state.frameRate = rate
        persist()
        Haptics.selectionChanged()
    }

    /// Starts free-running from a typed-in timecode, the way you'd jam a
    /// board from the sound cart's display.
    func jam(to timecode: Timecode) {
        state.jam = JamReference(
            frameIndex: Double(timecode.frameIndex),
            rate: timecode.rate,
            monotonic: MonotonicClock.now(),
            wallClock: Date(),
            origin: .manual
        )
        state.timecodeSource = .jam
        ltc.stop()
        persist()
        Haptics.success()
    }

    /// Takes the device clock as a starting point and free-runs from it, so a
    /// later network-time correction doesn't move the board mid-day.
    func jamToTimeOfDay() {
        let reading = TimecodeClock.timeOfDay(Date(), rate: state.frameRate)
        state.jam = JamReference(
            frameIndex: TimecodeClock.frameIndex(of: reading),
            rate: state.frameRate,
            monotonic: MonotonicClock.now(),
            wallClock: Date(),
            origin: .timeOfDay
        )
        state.timecodeSource = .jam
        persist()
        Haptics.success()
    }

    /// Jams once from the LTC feed and lets the board free-run, so the cable
    /// can come out.
    func jamFromLTC() {
        guard let reference = ltc.reference, ltc.status == .locked else { return }
        // A board set to a rate the sync box isn't running at would read
        // differently from the camera; the box wins.
        if let mismatch = ltcRateMismatch { state.frameRate = mismatch }
        state.jam = reference
        state.timecodeSource = .jam
        ltc.stop()
        persist()
        Haptics.success()
    }

    /// While following LTC, each good frame refreshes the jam. If the signal
    /// drops out the last one keeps running — the board free-runs, as any
    /// slate with a jam-sync input does.
    private func follow(_ reference: JamReference) {
        guard state.timecodeSource == .ltc else { return }
        // Only move the board when it has actually drifted from the feed —
        // republishing every frame would redraw the whole screen for nothing.
        if let current = state.jam, current.rate == reference.rate {
            let predicted = current.frameIndex + (reference.monotonic - current.monotonic) * current.rate.actual
            guard abs(predicted - reference.frameIndex) > 0.2 else { return }
        }
        state.jam = reference
        if Date().timeIntervalSince(lastJamPersist) > 5 {
            lastJamPersist = Date()
            store.save(state)
        }
    }

    /// A short line describing where the board's timecode is coming from.
    var timecodeStatus: String {
        switch state.timecodeSource {
        case .timeOfDay:
            return "Time of day"
        case .jam:
            guard let jam = state.jam else { return "Not jammed" }
            return "\(jam.origin == .ltc ? "Jammed from LTC" : "Jammed") \(Self.ageLabel(jam.age))"
        case .ltc:
            switch ltc.status {
            case .locked:
                return "LTC locked\(ltc.detectedRate.map { " · \($0.label) fps" } ?? "")"
            case .acquiring:
                return "Reading LTC…"
            case .noSignal, .starting:
                return state.jam == nil ? "Waiting for LTC" : "Free-running · no LTC"
            case .denied:
                return "Microphone access is off"
            case .failed:
                return "Audio input unavailable"
            case .off:
                return "LTC off"
            }
        }
    }

    /// True when a jam has free-run long enough that a tablet's clock may
    /// have wandered a frame — about four hours for a typical crystal.
    var jamIsStale: Bool {
        guard state.timecodeSource != .timeOfDay, let jam = state.jam else { return false }
        if state.timecodeSource == .ltc, ltc.status == .locked { return false }
        return jam.age > 4 * 3600
    }

    var ltcRateMismatch: FrameRate? {
        guard let rate = ltc.detectedRate, ltc.status == .locked else { return nil }
        let matches = rate.nominal == state.frameRate.nominal || rate.nominal * 2 == state.frameRate.nominal
        return matches && rate.isPulldown == state.frameRate.isPulldown ? nil : rate
    }

    static func ageLabel(_ age: TimeInterval) -> String {
        if age < 60 { return "just now" }
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = age < 3600 ? [.minute] : [.hour, .minute]
        formatter.unitsStyle = .abbreviated
        return "\(formatter.string(from: age) ?? "") ago"
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
            if let number = scene.sceneNumber?.nonEmpty { state.scene = number }
            state.isInterior = scene.locationType != .exterior
            state.isDay = !(scene.timeOfDay?.isNight ?? false)
        }
        state.shot = Self.setupLabel(for: shot, scene: state.scene)

        // Continue the count rather than restarting it.
        state.take = (shot.takesCompleted ?? 0) + 1
        persist()
        Haptics.selectionChanged()
    }

    /// Shot numbers are written all sorts of ways — "3", "12A", "12-3". The
    /// board wants the setup on its own, so a number that repeats the scene
    /// has it trimmed off.
    static func setupLabel(for shot: Shot, scene: String) -> String {
        guard var number = shot.shotNumber?.trimmingCharacters(in: .whitespaces), !number.isEmpty else { return "" }
        if !scene.isEmpty, number.uppercased().hasPrefix(scene.uppercased()), number.count > scene.count {
            number.removeFirst(scene.count)
            number = number.trimmingCharacters(in: CharacterSet(charactersIn: " -./"))
        }
        return number.uppercased()
    }

    func unlink() {
        state.linkedShotID = nil
        state.linkedSceneID = nil
        persist()
        Haptics.tap()
    }

    // MARK: - Marking

    /// Claps the sticks: freezes the timecode on the clap frame, flashes,
    /// sounds, logs the take and — if the slate is pointed at a shot —
    /// records it against the shot list.
    ///
    /// MOS takes are logged without the clap: on set the sticks stay closed
    /// for a shot with no sound, so there's nothing to sync.
    func mark() {
        guard !isClosed else { return }

        let reading = state.clock.reading()
        isClosed = true
        heldReading = reading

        if !state.isMOS {
            if AppSettings.shared.slateSoundEnabled { clapSound.play() }
            if state.flashOnClap { flashCount += 1 }
        }
        Haptics.impact()
        Task {
            try? await Task.sleep(for: .milliseconds(45))
            Haptics.success()
        }

        let take = SlateTake(state: state, timecode: reading.timecode)
        takes.insert(take, at: 0)
        if let shotID = take.shotID { adjustTakesCompleted(shotID: shotID, by: 1) }
        markReportDirty(CameraReportKey(take))
        persist()

        // Hold the clap frame for the beat it takes to pull the board out of
        // frame, then open up ready for the next one.
        reopenTask?.cancel()
        let hold = max(0.3, state.holdSeconds)
        reopenTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(hold))
            guard let self, !Task.isCancelled else { return }
            self.isClosed = false
            self.heldReading = nil
            if self.state.autoAdvanceTake { self.state.take += 1 }
            self.state.isTail = false
            self.persist()
        }
    }

    /// Marks a take as a print — the circled take.
    func toggleCircle(_ take: SlateTake) {
        guard let index = takes.firstIndex(where: { $0.id == take.id }) else { return }
        takes[index].isCircled.toggle()
        markReportDirty(CameraReportKey(takes[index]))
        Haptics.tap()
        persist()
    }

    func setNote(_ note: String, for take: SlateTake) {
        guard let index = takes.firstIndex(where: { $0.id == take.id }) else { return }
        takes[index].note = note.nonEmpty
        markReportDirty(CameraReportKey(takes[index]))
        persist()
    }

    func deleteTake(_ take: SlateTake) {
        takes.removeAll { $0.id == take.id }
        removedTakes.append(take)
        if let shotID = take.shotID { adjustTakesCompleted(shotID: shotID, by: -1) }
        markReportDirty(CameraReportKey(take))
        persist()
        Haptics.tap()
    }

    func adjustTake(by delta: Int) {
        state.take = max(1, state.take + delta)
        Haptics.selectionChanged()
        persist()
    }

    /// Rolls to the next camera roll and resets the take, the way an AC does
    /// at a magazine or card change.
    func nextRoll() {
        state.roll = Self.incremented(state.roll)
        state.take = 1
        Haptics.impact()
        persist()
    }

    /// The next setup in the scene: 12A → 12B, take back to 1.
    func nextSetup() {
        state.shot = Self.nextSetupLabel(after: state.shot)
        state.take = 1
        Haptics.impact()
        persist()
    }

    static func incremented(_ roll: String) -> String {
        guard let range = roll.range(of: "[0-9]+$", options: .regularExpression),
              let number = Int(roll[range]) else {
            return roll.isEmpty ? "1" : roll + "1"
        }
        let digits = roll[range].count
        return String(roll[..<range.lowerBound]) + String(format: "%0\(digits)d", number + 1)
    }

    /// Setups go A, B, C… skipping I and O, which read as 1 and 0 on a board.
    static func nextSetupLabel(after setup: String) -> String {
        let letters = Array("ABCDEFGHJKLMNPQRSTUVWXYZ")
        let current = setup.uppercased()
        if current.isEmpty { return "A" }
        if let number = Int(current) { return String(number + 1) }
        guard let last = current.last, let index = letters.firstIndex(of: last) else {
            return incremented(current)
        }
        if index + 1 < letters.count {
            return String(current.dropLast()) + String(letters[index + 1])
        }
        return String(current.dropLast()) + "AA"
    }

    // MARK: - Shot list

    /// Counts the take against the shot locally first, so a run of takes
    /// offline counts up instead of each one writing the same number.
    private func adjustTakesCompleted(shotID: String, by delta: Int) {
        guard let index = shots.firstIndex(where: { $0.id == shotID }) else { return }
        let next = max(0, (shots[index].takesCompleted ?? 0) + delta)
        shots[index].takesCompleted = next
        let snapshot = shots
        Task {
            await LocalCache.shared.save(snapshot, for: LocalCache.Key.shots(projectID))
            do {
                try await ProductionService.setTakesCompleted(id: shotID, takes: next)
            } catch {
                // On set, a failed write must not stop the next take being
                // marked. It's queued and replayed in order, not thrown in
                // anyone's face.
                await SyncQueue.shared.enqueue(
                    PendingMutation(
                        table: "shots",
                        kind: .update,
                        matchColumn: "id",
                        matchValue: shotID,
                        payload: try? JSONEncoder.supabase.encode(["takes_completed": next])
                    )
                )
            }
        }
    }

    // MARK: - Camera report

    func setLogsToCameraReport(_ enabled: Bool) {
        state.logToCameraReport = enabled
        reportStatus = enabled ? .idle : .off
        if enabled {
            // Pick up today's takes that were marked while it was off.
            let today = SlateTake.dayFormatter.string(from: Date())
            for take in takes where take.reportDate == today { dirtyReports.insert(CameraReportKey(take)) }
            scheduleReportSync(after: .milliseconds(300))
        }
        persist()
    }

    private func markReportDirty(_ key: CameraReportKey) {
        guard state.logToCameraReport else { return }
        dirtyReports.insert(key)
        scheduleReportSync(after: .seconds(2))
    }

    /// Debounced: a run of quick takes, circles and notes becomes one write.
    func scheduleReportSync(after delay: Duration) {
        guard state.logToCameraReport, !dirtyReports.isEmpty else {
            if state.logToCameraReport, case .waiting = reportStatus { reportStatus = .idle }
            return
        }
        reportTask?.cancel()
        reportTask = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            await self?.syncReports()
        }
    }

    func syncReports() async {
        guard state.logToCameraReport, !dirtyReports.isEmpty else { return }
        guard NetworkMonitor.shared.isOnline else {
            reportStatus = .waiting
            return
        }

        reportStatus = .syncing
        for key in dirtyReports {
            let group = takes.filter { CameraReportKey($0) == key }
            let removedIDs = Set(removedTakes.filter { CameraReportKey($0) == key }.map(\.id))
            do {
                try await CameraReportSync.sync(
                    projectID: projectID,
                    key: key,
                    takes: group,
                    removedIDs: removedIDs,
                    operatorName: state.camera,
                    ownerID: ownerID
                )
                dirtyReports.remove(key)
                removedTakes.removeAll { removedIDs.contains($0.id) }
            } catch is CancellationError {
                return
            } catch let error as SupabaseError where error.isRetryable {
                reportStatus = .waiting
                persist()
                return
            } catch {
                reportStatus = .failed((error as? SupabaseError)?.errorDescription ?? error.localizedDescription)
                persist()
                return
            }
        }
        reportStatus = .synced(Date())
        persist()
    }

    // MARK: - Persistence

    func persist() {
        store.save(state)
        store.save(SlateStore.Log(takes: takes, removed: removedTakes, dirtyReports: dirtyReports))
    }

    // MARK: - Export

    /// The take log as CSV, oldest first — the order a script supervisor or
    /// an editor reads it in.
    func csv(for selection: [SlateTake]? = nil) -> String {
        Self.csv(takes: selection ?? takes, state: state)
    }

    nonisolated static func csv(takes: [SlateTake], state: SlateState) -> String {
        let header = ["Date", "Time", "Camera", "Roll", "Scene", "Setup", "Take", "Timecode", "FPS", "TC source",
                      "INT/EXT", "DAY/NIGHT", "Sound", "Tail", "Circled", "Note", "Production", "Director", "DOP"]
        let rows = takes.sorted { $0.markedAt < $1.markedAt }.map { take -> [String] in
            [
                take.reportDate, take.timeLabel, take.cameraUnit, take.roll, take.scene, take.shot, String(take.take),
                take.timecode ?? "", take.frameRate?.rawValue ?? "", take.timecodeSource?.shortLabel ?? "",
                take.isInterior ? "INT" : "EXT", take.isDay ? "DAY" : "NIGHT", take.isMOS ? "MOS" : "SYNC",
                take.isTail ? "yes" : "", take.isCircled ? "yes" : "", take.note ?? "",
                state.production, state.director, state.camera,
            ]
        }
        return ([header] + rows)
            .map { $0.map(csvField).joined(separator: ",") }
            .joined(separator: "\r\n") + "\r\n"
    }

    nonisolated private static func csvField(_ value: String) -> String {
        guard value.contains(where: { $0 == "," || $0 == "\"" || $0 == "\n" || $0 == "\r" }) else { return value }
        return "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
    }
}
