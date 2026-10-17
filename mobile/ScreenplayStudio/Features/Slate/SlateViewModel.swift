import SwiftUI
import AVFoundation

/// Runs the slate: the clock, the clap, the take log, and the links to the
/// shot list and the camera & sound reports.
///
/// A take goes **mark → cut → rate**. Marking claps the sticks: the screen
/// flashes and a sync beep sounds on the same displayed frame, and the
/// timecode of that frame is frozen on the board and logged. "Cut" closes the
/// take; rating it (circle, good, NG…) moves the board on to the next take.
@MainActor
final class SlateViewModel: ObservableObject {

    enum Phase: Equatable {
        case ready
        case rolling(UUID)
        case cut(UUID)
    }

    enum ReportStatus: Equatable {
        case idle
        case syncing
        case waiting(Int)
        case synced(Date)
        case failed(String)
    }

    // MARK: Published state

    @Published private(set) var state: SlateState
    @Published private(set) var takes: [SlateTake]
    @Published private(set) var phase: Phase = .ready
    @Published private(set) var jam: TimecodeJam
    /// The clap's timecode, held on the board for a moment so the camera sees it.
    @Published private(set) var frozenTimecode: Timecode?
    @Published private(set) var isFlashing = false
    @Published private(set) var sticksClosed = false
    /// The board is upside down for an end-board.
    @Published var isTailMode = false

    @Published private(set) var shots: [Shot] = []
    @Published private(set) var scenes: [ProductionScene] = []

    @Published private(set) var reportStatus: ReportStatus = .idle
    @Published private(set) var isListeningForLTC = false
    @Published private(set) var ltcMessage: String?
    @Published var notice: String?

    let projectID: String
    let projectTitle: String
    /// Set by the screen from the signed-in account, for report authorship.
    var userID: String?

    private let audio: SlateAudio
    private let displaySync = DisplaySyncTrigger()
    private var deletedTakeIDs: Set<UUID>
    private var dirtyReports: Set<SlateReportKey>
    private var reportTask: Task<Void, Never>?
    private var freezeTask: Task<Void, Never>?
    private var listenTimeout: Task<Void, Never>?
    private var isSyncInFlight = false
    /// "Slate this shot / scene": linked once the shot list is loaded.
    private var pendingShotID: String?
    private var pendingSceneID: String?

    init(projectID: String, projectTitle: String, initialShotID: String? = nil, initialSceneID: String? = nil) {
        self.projectID = projectID
        self.projectTitle = projectTitle
        self.pendingShotID = initialShotID
        self.pendingSceneID = initialShotID == nil ? initialSceneID : nil

        let snapshot = SlateStore.shared.load(projectID: projectID)
        var state = snapshot?.state ?? SlateState()
        if state.production.isEmpty { state.production = projectTitle }

        // A recorder jam carries over (re-anchored via the wall clock); time of
        // day is simply read again.
        let jam = state.jam.map { $0.rebased() } ?? TimecodeJam.timeOfDay(rate: state.frameRate)

        self.state = state
        self.takes = snapshot?.takes ?? []
        self.deletedTakeIDs = Set(snapshot?.deletedTakeIDs ?? [])
        self.dirtyReports = Set(snapshot?.dirtyReports ?? [])
        self.jam = jam
        self.audio = SlateAudio(jam: jam, rate: state.frameRate)
    }

    // MARK: - Lifecycle

    /// Get audio ready and pull in the shot list.
    func onAppear() async {
        audio.prepare(beepDuration: beepDuration)
        if state.ltcOutputEnabled { try? audio.startLTCOutput() }
        await loadCachedContext()
        applyPendingLink()
        syncReportsSoon(after: 0)
        await refreshContext()
        applyPendingLink()
    }

    /// Opened from a shot or a scene: put it on the board, carrying on its
    /// take count. Already on the board, it's left as it is.
    private func applyPendingLink() {
        if let id = pendingShotID {
            guard let shot = shots.first(where: { $0.id == id }) else { return }
            pendingShotID = nil
            if state.linkedShotID != id { link(to: shot) }
        } else if let id = pendingSceneID {
            guard let scene = scenes.first(where: { $0.id == id }) else { return }
            pendingSceneID = nil
            if state.linkedSceneID != id || state.linkedShotID != nil { link(to: scene) }
        }
    }

    func onDisappear() {
        if case .rolling(let id) = phase { cut(id) }
        stopListening()
        audio.stopAll()
        persist()
    }

    // MARK: - Clock

    func timecode(at clock: Double) -> Timecode {
        jam.timecode(at: clock, rate: state.frameRate)
    }

    var timecodeSourceLabel: String {
        switch jam.source {
        case .timeOfDay:
            return state.frameRate.tracksWallClock ? "Time of day" : "Time of day (free-run)"
        case .manual:
            return "Jammed by hand \(Self.relative(jam.jammedAt))"
        case .ltc:
            return "Jammed to LTC \(Self.relative(jam.jammedAt))"
        }
    }

    private static func relative(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func applyJam(_ newJam: TimecodeJam) {
        jam = newJam
        state.jam = newJam.source == .timeOfDay ? nil : newJam
        audio.jamBox.set(jam: newJam, rate: state.frameRate)
        persist()
    }

    func jamToTimeOfDay() {
        applyJam(.timeOfDay(rate: state.frameRate))
        Haptics.success()
    }

    /// Jam to a timecode typed from a recorder's display, at the moment the
    /// user tapped (`clock`).
    func jamManually(to timecode: Timecode, at clock: Double) {
        applyJam(.jam(to: timecode, at: clock, rate: state.frameRate, source: .manual))
        Haptics.success()
    }

    /// Move the running timecode a frame or so, to line it up with a
    /// recorder's display by eye.
    func nudgeJam(by frames: Int) {
        var nudged = jam
        nudged.anchorFrames += frames
        if nudged.source == .timeOfDay {
            // Off time of day now, so it has to be kept like a jam.
            nudged.source = .manual
            nudged.jammedAt = Date()
        }
        applyJam(nudged)
        Haptics.selectionChanged()
    }

    func setFrameRate(_ rate: FrameRate) {
        guard rate != state.frameRate else { return }
        let now = SlateClock.now()
        let current = jam.timecode(at: now, rate: state.frameRate)
        state.frameRate = rate
        if jam.source == .timeOfDay {
            applyJam(.timeOfDay(rate: rate))
        } else {
            // Keep the same label running at the new rate; re-jam to be exact.
            let frames = min(current.frames, rate.nominal - 1)
            let carried = Timecode(hours: current.hours, minutes: current.minutes, seconds: current.seconds, frames: frames)
            applyJam(.jam(to: carried, at: now, rate: rate, source: jam.source))
        }
        audio.prepare(beepDuration: beepDuration)
        Haptics.selectionChanged()
    }

    // MARK: - LTC

    /// Listen for a recorder's LTC on the audio input and jam to it.
    func listenForLTC() {
        guard !isListeningForLTC else { return }
        ltcMessage = "Listening for timecode…"
        AVAudioApplication.requestRecordPermission { [weak self] granted in
            Task { @MainActor in
                guard let self else { return }
                guard granted else {
                    self.ltcMessage = "Microphone access is off. Turn it on in Settings › Screenplay Studio to read timecode."
                    return
                }
                self.beginListening()
            }
        }
    }

    private func beginListening() {
        do {
            try audio.startListening { [weak self] reading in
                self?.received(reading)
            }
            isListeningForLTC = true
            listenTimeout?.cancel()
            listenTimeout = Task { [weak self] in
                try? await Task.sleep(for: .seconds(8))
                guard let self, !Task.isCancelled, self.isListeningForLTC else { return }
                self.stopListening()
                self.ltcMessage = "No timecode heard. Plug the recorder's TC out into the audio input (a TRRS or Lightning/USB-C adapter) and set its output level to line."
                Haptics.error()
            }
        } catch {
            ltcMessage = error.localizedDescription
        }
    }

    func stopListening() {
        listenTimeout?.cancel()
        audio.stopListening()
        if isListeningForLTC { ltcMessage = nil }
        isListeningForLTC = false
    }

    private func received(_ reading: SlateAudio.LTCReading) {
        guard isListeningForLTC else { return }
        let rate = state.frameRate
        // At 48/50/60 fps each LTC frame carries a pair of video frames.
        let ltcRate = LTC.frameRate(for: rate)
        let mismatch = abs(reading.measuredFPS - ltcRate) / ltcRate > 0.02
        if mismatch || reading.dropFrame != rate.isDropFrame {
            stopListening()
            let heard = reading.dropFrame ? String(format: "%.2f DF", reading.measuredFPS) : String(format: "%.3g", reading.measuredFPS)
            ltcMessage = "The recorder is sending \(heard) fps, but the slate is set to \(rate.label). Match the frame rates and jam again."
            Haptics.error()
            return
        }
        var tc = reading.timecode
        if rate.nominal > 30 { tc.frames *= 2 }
        applyJam(.jam(to: tc, at: reading.frameStartClock, rate: rate, source: .ltc))
        stopListening()
        ltcMessage = "Jammed to \(tc.formatted(rate)) from the recorder."
        Haptics.success()
    }

    /// LTC out of the audio output, for a camera's audio input.
    func setLTCOutput(_ on: Bool) {
        do {
            if on { try audio.startLTCOutput() } else { audio.stopLTCOutput() }
            state.ltcOutputEnabled = on
            persist()
            Haptics.selectionChanged()
        } catch {
            notice = "Couldn’t start timecode output: \(error.localizedDescription)"
        }
    }

    // MARK: - Board

    func update(_ change: (inout SlateState) -> Void) {
        var copy = state
        change(&copy)
        let rateChanged = copy.frameRate != state.frameRate
        let newRate = copy.frameRate
        copy.frameRate = state.frameRate
        state = copy
        if rateChanged { setFrameRate(newRate) }
        persist()
    }

    func adjustTake(by delta: Int) {
        state.take = max(1, state.take + delta)
        Haptics.selectionChanged()
        persist()
    }

    /// Rolls to the next camera roll, the way an AC does at a mag or card change.
    func nextRoll() {
        state.roll = Self.increment(state.roll)
        Haptics.impact()
        persist()
    }

    func nextSoundRoll() {
        state.soundRoll = Self.increment(state.soundRoll)
        Haptics.impact()
        persist()
    }

    static func increment(_ label: String) -> String {
        guard let range = label.range(of: "[0-9]+$", options: .regularExpression),
              let number = Int(label[range]) else { return label + "1" }
        let digits = label[range].count
        return label.replacingCharacters(in: range, with: String(format: "%0\(digits)d", number + 1))
    }

    var beepDuration: Double { max(2 / state.frameRate.actual, 0.06) }
    private var flashDuration: Double { max(1.5 / state.frameRate.actual, 0.05) }

    // MARK: - The take

    var currentTake: SlateTake? {
        switch phase {
        case .ready: return nil
        case .rolling(let id), .cut(let id): return takes.first { $0.id == id }
        }
    }

    /// Clap the sticks (or, in tail mode, end-board the take that's rolling).
    func mark() {
        guard !isSyncInFlight else { return }

        // Marking again moves on from whatever was happening.
        let tailOfRolling: UUID?
        switch phase {
        case .rolling(let id):
            tailOfRolling = isTailMode ? id : nil
            if !isTailMode { cut(id); nextTake() }
        case .cut:
            tailOfRolling = nil
            nextTake()
        case .ready:
            tailOfRolling = nil
        }

        isSyncInFlight = true
        sticksClosed = true
        let kind = state.kind
        let settings = state

        displaySync.next { [weak self] visibleAtHost in
            guard let self else { return }
            self.isSyncInFlight = false
            let clock = SlateClock.fromHostSeconds(visibleAtHost)
            let tc = self.jam.timecode(at: clock, rate: settings.frameRate)

            if settings.flashEnabled && kind.hasCamera {
                self.isFlashing = true
                Task { [weak self] in
                    try? await Task.sleep(for: .seconds(self?.flashDuration ?? 0.06))
                    self?.isFlashing = false
                }
            }
            if settings.beepEnabled && kind.hasSound && !settings.ltcOutputEnabled {
                self.audio.playBeep(
                    leavingSpeakerAt: visibleAtHost + Double(settings.syncOffsetMs) / 1000,
                    duration: self.beepDuration
                )
            }
            Haptics.impact()

            self.frozenTimecode = tc
            self.freezeTask?.cancel()
            self.freezeTask = Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(1600))
                guard !Task.isCancelled else { return }
                self?.frozenTimecode = nil
                self?.sticksClosed = false
            }

            let label = tc.formatted(settings.frameRate)
            if let id = tailOfRolling, let index = self.takes.firstIndex(where: { $0.id == id }) {
                // End-board on the take that's rolling, then cut it.
                self.takes[index].isTailSlate = true
                self.takes[index].tailTimecode = label
                self.isTailMode = false
                self.cut(id)
            } else {
                var take = SlateTake(timecode: label, state: settings)
                if self.isTailMode {
                    // Camera rolled without a head slate: the take is end-boarded.
                    take.isTailSlate = true
                    take.tailTimecode = label
                }
                self.takes.insert(take, at: 0)
                self.phase = .rolling(take.id)
                if self.isTailMode {
                    self.isTailMode = false
                    self.cut(take.id)
                }
                self.markDirty(take)
            }
            self.persist()
        }
    }

    /// A clap that isn't logged: flash and beep together, for calibrating the
    /// sync offset against a test recording.
    func testSync() {
        guard !isSyncInFlight else { return }
        isSyncInFlight = true
        sticksClosed = true
        let settings = state
        displaySync.next { [weak self] visibleAtHost in
            guard let self else { return }
            self.isSyncInFlight = false
            self.isFlashing = true
            Task { [weak self] in
                try? await Task.sleep(for: .seconds(self?.flashDuration ?? 0.06))
                self?.isFlashing = false
            }
            self.audio.playBeep(
                leavingSpeakerAt: visibleAtHost + Double(settings.syncOffsetMs) / 1000,
                duration: self.beepDuration
            )
            Haptics.impact()
            self.frozenTimecode = self.jam.timecode(at: SlateClock.fromHostSeconds(visibleAtHost), rate: settings.frameRate)
            self.freezeTask?.cancel()
            self.freezeTask = Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(1600))
                guard !Task.isCancelled else { return }
                self?.frozenTimecode = nil
                self?.sticksClosed = false
            }
        }
    }

    /// "Cut!" — the take is over.
    func cut() {
        if case .rolling(let id) = phase { cut(id) }
    }

    private func cut(_ id: UUID) {
        guard let index = takes.firstIndex(where: { $0.id == id }) else { return }
        takes[index].cutAt = Date()
        phase = .cut(id)
        Haptics.tap()
        markDirty(takes[index])
        recordTakeOnShot(takes[index])
        persist()
    }

    /// Rate the take that was just cut, and move to the next.
    func rate(_ rating: TakeRating) {
        guard let take = currentTake, let index = takes.firstIndex(where: { $0.id == take.id }) else { return }
        takes[index].rating = rating
        markDirty(takes[index])
        if rating == .circled { Haptics.success() } else { Haptics.selectionChanged() }
        if case .rolling = phase { cut(take.id) }
        nextTake()
    }

    /// Ready the board for the next take.
    func nextTake() {
        phase = .ready
        state.take += 1
        isTailMode = false
        persist()
    }

    // MARK: - Editing the log

    func update(take: SlateTake) {
        guard let index = takes.firstIndex(where: { $0.id == take.id }) else { return }
        // File it under both the old and new reports, in case the roll moved.
        markDirty(takes[index])
        takes[index] = take
        markDirty(take)
        persist()
    }

    func setRating(_ rating: TakeRating, for take: SlateTake) {
        var copy = take
        copy.rating = take.rating == rating ? .none : rating
        update(take: copy)
        Haptics.selectionChanged()
    }

    func delete(_ take: SlateTake) {
        markDirty(take)
        takes.removeAll { $0.id == take.id }
        deletedTakeIDs.insert(take.id)
        if currentTake == nil { phase = .ready }
        persist()
        Haptics.tap()
    }

    /// Take the last mark back — a slate on the wrong shot, a camera not rolling.
    func undoLastMark() {
        guard let last = takes.first else { return }
        delete(last)
        phase = .ready
        state.take = last.take
        persist()
    }

    func clearLog() {
        for take in takes { markDirty(take); deletedTakeIDs.insert(take.id) }
        takes = []
        phase = .ready
        persist()
    }

    /// Takes for the shot or scene on the board, newest first.
    var takesOnBoard: [SlateTake] {
        if let id = state.linkedShotID { return takes.filter { $0.shotID == id } }
        return takes.filter { $0.scene == state.scene && $0.setup == state.setup }
    }

    var todaysTakes: [SlateTake] {
        takes.filter { Calendar.current.isDateInToday($0.markedAt) }
    }

    // MARK: - Shots and scenes

    func loadContext() async {
        await loadCachedContext()
        await refreshContext()
    }

    private func loadCachedContext() async {
        let cache = LocalCache.shared
        async let cachedShots = cache.load([Shot].self, for: LocalCache.Key.shots(projectID))
        async let cachedScenes = cache.load([ProductionScene].self, for: LocalCache.Key.scenes(projectID))
        if let loaded = await cachedShots, shots.isEmpty { shots = loaded }
        if let loaded = await cachedScenes, scenes.isEmpty { scenes = loaded }
    }

    /// Refresh quietly; the slate has to work offline on set.
    private func refreshContext() async {
        let cache = LocalCache.shared
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

    var linkedScene: ProductionScene? {
        guard let id = state.linkedSceneID else { return nil }
        return scenes.first { $0.id == id }
    }

    /// Scenes in script order, each with its shots in shot-list order.
    var shotsByScene: [(scene: ProductionScene?, shots: [Shot])] {
        let sortedScenes = scenes.sorted { ($0.sortOrder ?? 0) < ($1.sortOrder ?? 0) }
        var groups: [(scene: ProductionScene?, shots: [Shot])] = sortedScenes.map { scene in
            (scene, shots.filter { $0.sceneID == scene.id }.sorted { ($0.sortOrder ?? 0) < ($1.sortOrder ?? 0) })
        }
        let loose = shots.filter { shot in shot.sceneID == nil || !scenes.contains { $0.id == shot.sceneID } }
        if !loose.isEmpty { groups.append((nil, loose.sorted { ($0.sortOrder ?? 0) < ($1.sortOrder ?? 0) })) }
        return groups
    }

    /// Point the board at a shot and fill in everything it can infer.
    func link(to shot: Shot) {
        if case .rolling(let id) = phase { cut(id) }
        if case .cut = phase { phase = .ready }
        state.linkedShotID = shot.id
        state.setup = shot.shotNumber?.nonEmpty ?? ""
        state.lens = shot.lens?.nonEmpty ?? state.lens
        if let sceneID = shot.sceneID, let scene = scenes.first(where: { $0.id == sceneID }) {
            fill(from: scene)
        } else {
            state.linkedSceneID = nil
        }
        // Carry on the count rather than restarting it.
        let logged = takes.filter { $0.shotID == shot.id }.map(\.take).max() ?? 0
        state.take = max(logged, shot.takesCompleted ?? 0) + 1
        persist()
        Haptics.selectionChanged()
    }

    /// Point the board at a scene without a particular shot.
    func link(to scene: ProductionScene) {
        if case .rolling(let id) = phase { cut(id) }
        if case .cut = phase { phase = .ready }
        state.linkedShotID = nil
        state.setup = ""
        fill(from: scene)
        let logged = takes.filter { $0.sceneID == scene.id && $0.shotID == nil }.map(\.take).max() ?? 0
        state.take = logged + 1
        persist()
        Haptics.selectionChanged()
    }

    private func fill(from scene: ProductionScene) {
        state.linkedSceneID = scene.id
        if let number = scene.sceneNumber?.nonEmpty { state.scene = number }
        if let type = scene.locationType { state.isInterior = type != .exterior }
        if let time = scene.timeOfDay { state.isDay = !time.isNight }
    }

    /// Slate a scene and setup typed in by hand, off the shot list. The scene
    /// is still matched to the breakdown when its number is there.
    func slate(scene: String, setup: String) {
        if case .rolling(let id) = phase { cut(id) }
        if case .cut = phase { phase = .ready }
        state.linkedShotID = nil
        state.linkedSceneID = nil
        if let match = scenes.first(where: { $0.sceneNumber?.caseInsensitiveCompare(scene) == .orderedSame }) {
            fill(from: match)
        }
        state.scene = scene
        state.setup = setup
        let logged = takes.filter { $0.scene == scene && $0.setup == setup }.map(\.take).max() ?? 0
        state.take = logged + 1
        persist()
        Haptics.selectionChanged()
    }

    /// Takes logged against a shot, for the shot list.
    func takeCount(for shot: Shot) -> (total: Int, circled: Int) {
        let logged = takes.filter { $0.shotID == shot.id }
        return (logged.count, logged.filter { $0.rating == .circled }.count)
    }

    func unlink() {
        state.linkedShotID = nil
        state.linkedSceneID = nil
        persist()
        Haptics.tap()
    }

    /// The shot after the one on the board: next in the scene, else the first
    /// of the next scene that still has shots to do.
    var nextShot: Shot? {
        let groups = shotsByScene
        let ordered = groups.flatMap(\.shots)
        guard let current = state.linkedShotID, let index = ordered.firstIndex(where: { $0.id == current }) else {
            return ordered.first { !$0.done }
        }
        return ordered[(index + 1)...].first { !$0.done } ?? ordered[(index + 1)...].first
    }

    func moveToNextShot() {
        guard let next = nextShot else { return }
        link(to: next)
    }

    /// Mark the shot on the board done and move to the next one. When it was
    /// the scene's last open shot, the scene is marked shot too.
    func completeShotAndAdvance() {
        guard let shot = linkedShot, let index = shots.firstIndex(where: { $0.id == shot.id }) else { return }
        shots[index].isCompleted = true
        let next = nextShot
        Task {
            await write(table: "shots", id: shot.id, fields: ["is_completed": .bool(true)]) {
                try await ProductionService.setShotCompleted(id: shot.id, completed: true)
            }
            await LocalCache.shared.save(shots, for: LocalCache.Key.shots(projectID))
        }
        if let sceneID = shot.sceneID,
           shots.filter({ $0.sceneID == sceneID }).allSatisfy(\.done),
           let sceneIndex = scenes.firstIndex(where: { $0.id == sceneID }), !scenes[sceneIndex].done {
            scenes[sceneIndex].isCompleted = true
            notice = "Scene \(scenes[sceneIndex].sceneNumber ?? "") is all shot."
            Task {
                await write(table: "scenes", id: sceneID, fields: ["is_completed": .bool(true)]) {
                    try await ProductionService.setSceneCompleted(id: sceneID, completed: true)
                }
                await LocalCache.shared.save(scenes, for: LocalCache.Key.scenes(projectID))
            }
        }
        Haptics.success()
        if let next { link(to: next) } else { notice = notice ?? "That was the last shot on the list." }
    }

    /// Keep the shot list's take count in step with the log.
    private func recordTakeOnShot(_ take: SlateTake) {
        guard let shotID = take.shotID, let index = shots.firstIndex(where: { $0.id == shotID }) else { return }
        let count = max(shots[index].takesCompleted ?? 0, take.take)
        guard count != shots[index].takesCompleted else { return }
        shots[index].takesCompleted = count
        let snapshot = shots
        Task {
            await write(table: "shots", id: shotID, fields: ["takes_completed": .number(Double(count))]) {
                try await ProductionService.setTakesCompleted(id: shotID, takes: count)
            }
            await LocalCache.shared.save(snapshot, for: LocalCache.Key.shots(projectID))
        }
    }

    /// Try a write; offline, queue it to replay later. On set, a failed write
    /// must never stop the next take being marked.
    private func write(table: String, id: String, fields: [String: JSONValue], _ attempt: () async throws -> Void) async {
        do {
            try await attempt()
        } catch {
            await SyncQueue.shared.enqueue(PendingMutation(
                table: table,
                kind: .update,
                matchColumn: "id",
                matchValue: id,
                payload: try? JSONEncoder.supabase.encode(fields)
            ))
        }
    }

    // MARK: - Reports

    private func markDirty(_ take: SlateTake) {
        for key in SlateReports.keys(for: take) { dirtyReports.insert(key) }
        reportStatus = .waiting(dirtyReports.count)
        syncReportsSoon()
    }

    /// Debounced: a burst of edits (rate, note, cut) becomes one write.
    func syncReportsSoon(after delay: Double = 1.5) {
        reportTask?.cancel()
        guard !dirtyReports.isEmpty else { return }
        reportTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            await self?.syncReports()
        }
    }

    func syncReports() async {
        guard !dirtyReports.isEmpty else {
            reportStatus = .idle
            return
        }
        reportStatus = .syncing
        let keys = dirtyReports
        let snapshot = takes
        let removed = deletedTakeIDs
        var failure: String?
        for key in keys {
            do {
                try await SlateReports.push(
                    key,
                    projectID: projectID,
                    takes: snapshot,
                    removedIDs: removed,
                    operatorName: state.camera,
                    userID: userID
                )
                dirtyReports.remove(key)
            } catch is CancellationError {
                return
            } catch {
                failure = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            }
        }
        if dirtyReports.isEmpty {
            // Once every report has caught up, deletions have been applied.
            deletedTakeIDs.subtract(removed)
            reportStatus = .synced(Date())
        } else {
            reportStatus = NetworkMonitor.shared.isOnline
                ? .failed(failure ?? "Some reports didn’t update.")
                : .waiting(dirtyReports.count)
        }
        persist()
    }

    // MARK: - Export

    func exportCSV() throws -> URL {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let name = "Slate log – \(projectTitle) – \(formatter.string(from: Date()))"
            .components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>"))
            .joined(separator: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name).appendingPathExtension("csv")
        try SlateReports.csv(takes).write(to: url, atomically: true, encoding: .utf8)
        return url
    }

    // MARK: - Persistence

    func persist() {
        SlateStore.shared.save(
            SlateStore.Snapshot(
                state: state,
                takes: Array(takes.prefix(2000)),
                deletedTakeIDs: Array(deletedTakeIDs),
                dirtyReports: Array(dirtyReports)
            ),
            projectID: projectID
        )
    }
}
