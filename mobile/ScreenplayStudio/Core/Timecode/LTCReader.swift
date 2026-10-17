import AVFoundation
import Combine

/// The app's audio session, shared by the clap sound and the LTC input.
///
/// Always `mixWithOthers`: a slate must never stop a sound recordist's
/// monitoring or anyone's music. Recording is only requested while LTC input
/// is on, and then in `.measurement` mode, which switches off the voice
/// processing and gain control that would mangle a timecode signal.
@MainActor
enum SlateAudioSession {

    private static var recording = false
    private static var users = 0

    static func activate() {
        users += 1
        apply()
    }

    static func setRecording(_ isRecording: Bool) {
        recording = isRecording
        apply()
    }

    static func deactivate() {
        users = max(0, users - 1)
        guard users == 0 else { return }
        recording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private static func apply() {
        let session = AVAudioSession.sharedInstance()
        do {
            if recording {
                try session.setCategory(
                    .playAndRecord,
                    mode: .measurement,
                    options: [.mixWithOthers, .defaultToSpeaker, .allowBluetoothA2DP]
                )
                preferExternalInput(session)
            } else {
                try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            }
            try session.setActive(true)
        } catch {
            Task { await Diagnostics.shared.record("audio", "session: \(error.localizedDescription)", isFailure: true) }
        }
    }

    /// A sync box arrives on a headset jack or a USB interface; the built-in
    /// microphone is the last resort and Bluetooth is never usable for LTC.
    private static func preferExternalInput(_ session: AVAudioSession) {
        guard let inputs = session.availableInputs else { return }
        let bluetooth: Set<AVAudioSession.Port> = [.bluetoothHFP, .bluetoothA2DP, .bluetoothLE]
        if let external = inputs.first(where: { $0.portType != .builtInMic && !bluetooth.contains($0.portType) }) {
            try? session.setPreferredInput(external)
        }
    }
}

/// Reads LTC from the audio input and turns it into jam references.
///
/// Every channel of the input is decoded separately — sync boxes commonly put
/// LTC on one side of a stereo cable — and whichever locks first is used.
@MainActor
final class LTCReader: ObservableObject {

    enum Status: Equatable {
        case off
        case denied
        case starting
        /// Listening, but nothing decodable is arriving.
        case noSignal
        /// Decoding, but not yet a steady run of frames.
        case acquiring
        case locked
        case failed(String)
    }

    @Published private(set) var status: Status = .off
    /// Recent peak input level, 0...1.
    @Published private(set) var level: Float = 0
    /// The last frame decoded, at the LTC's own rate.
    @Published private(set) var timecode: Timecode?
    @Published private(set) var detectedRate: FrameRate?
    @Published private(set) var userBits: UInt32 = 0
    @Published private(set) var inputName: String?
    @Published private(set) var isUsingBuiltInMic = false
    /// Refreshed on every good frame while locked.
    @Published private(set) var reference: JamReference?

    private var engine: AVAudioEngine?
    private var observers: [NSObjectProtocol] = []
    private let pipeline = LTCPipeline()
    private var poller: Task<Void, Never>?
    private(set) var isRunning = false

    // MARK: - Lifecycle

    func start() async {
        guard !isRunning else { return }
        isRunning = true

        switch Self.microphoneAccess() {
        case .some(false):
            status = .denied
            isRunning = false
            return
        case .none:
            let granted = await Self.requestMicrophoneAccess()
            guard granted, isRunning else {
                status = granted ? .off : .denied
                isRunning = false
                return
            }
        case .some(true):
            break
        }

        status = .starting
        SlateAudioSession.activate()
        SlateAudioSession.setRecording(true)
        observe()
        startEngine()
        startPolling()
    }

    /// `true` granted, `false` denied, `nil` not asked yet. `AVAudioApplication`
    /// is iOS 17 only and the app still runs on iOS 16, which asks through
    /// `AVAudioSession` instead.
    private static func microphoneAccess() -> Bool? {
        if #available(iOS 17.0, *) {
            switch AVAudioApplication.shared.recordPermission {
            case .granted: return true
            case .denied:  return false
            default:       return nil
            }
        }
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted: return true
        case .denied:  return false
        default:       return nil
        }
    }

    private static func requestMicrophoneAccess() async -> Bool {
        if #available(iOS 17.0, *) {
            return await AVAudioApplication.requestRecordPermission()
        }
        return await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    func stop() {
        guard isRunning else { return }
        isRunning = false
        poller?.cancel()
        poller = nil
        stopEngine()
        observers.forEach(NotificationCenter.default.removeObserver)
        observers.removeAll()
        SlateAudioSession.setRecording(false)
        SlateAudioSession.deactivate()
        status = .off
        level = 0
    }

    private func startEngine() {
        stopEngine()
        let engine = AVAudioEngine()
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)

        guard format.sampleRate > 0, format.channelCount > 0 else {
            status = .failed("No audio input is available.")
            return
        }

        pipeline.configure(sampleRate: format.sampleRate, channels: Int(min(format.channelCount, 2)))
        let pipeline = self.pipeline
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, when in
            pipeline.consume(buffer, at: when)
        }

        do {
            engine.prepare()
            try engine.start()
            self.engine = engine
            status = .noSignal
            refreshRoute()
        } catch {
            input.removeTap(onBus: 0)
            status = .failed("Couldn't start the audio input: \(error.localizedDescription)")
        }
    }

    private func stopEngine() {
        guard let engine else { return }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        self.engine = nil
    }

    private func refreshRoute() {
        let input = AVAudioSession.sharedInstance().currentRoute.inputs.first
        inputName = input?.portName
        isUsingBuiltInMic = input?.portType == .builtInMic
    }

    private func observe() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(
            forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isRunning else { return }
                // A newly plugged-in interface becomes the preferred input.
                SlateAudioSession.setRecording(true)
                self.refreshRoute()
            }
        })
        observers.append(center.addObserver(
            forName: .AVAudioEngineConfigurationChange, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isRunning else { return }
                self.startEngine()
            }
        })
        observers.append(center.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] note in
            let type = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            Task { @MainActor in
                guard let self, self.isRunning,
                      type == AVAudioSession.InterruptionType.ended.rawValue else { return }
                SlateAudioSession.setRecording(true)
                self.startEngine()
            }
        })
    }

    /// Pulls decoded state off the audio thread at a display-friendly rate.
    private func startPolling() {
        poller?.cancel()
        poller = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(80))
                guard let self else { return }
                self.publish(self.pipeline.snapshot())
            }
        }
    }

    private func publish(_ snapshot: LTCPipeline.Snapshot) {
        guard isRunning, engine != nil else { return }
        level = snapshot.level
        if let rate = snapshot.rate { detectedRate = rate }

        let now = MonotonicClock.now()
        guard let frame = snapshot.lastFrame, now - snapshot.lastFrameAt < 0.5 else {
            if status == .locked || status == .acquiring { status = .noSignal }
            return
        }

        userBits = frame.userBits
        let displayRate = detectedRate
            ?? FrameRate.ltcRate(nominal: frame.frames >= 25 ? 30 : 25, isPulldown: frame.dropFrame, isDropFrame: frame.dropFrame)
            ?? .fps25
        timecode = frame.timecode(at: displayRate)

        guard snapshot.consecutive >= 6, let rate = detectedRate else {
            status = .acquiring
            return
        }

        status = .locked
        let label = frame.timecode(at: rate)
        reference = JamReference(
            frameIndex: Double(label.frameIndex),
            rate: rate,
            monotonic: snapshot.lastFrameAt,
            wallClock: Date().addingTimeInterval(snapshot.lastFrameAt - now),
            origin: .ltc
        )
    }
}

// MARK: - Audio-thread side

/// Owns the decoders. Fed from the tap's thread, read from the main actor, so
/// everything shared goes through one lock.
private final class LTCPipeline: @unchecked Sendable {

    struct Snapshot {
        var level: Float = 0
        var lastFrame: LTCFrame?
        /// When `lastFrame` started, on `MonotonicClock`.
        var lastFrameAt: Double = 0
        var consecutive = 0
        var rate: FrameRate?
    }

    private let lock = NSLock()
    private var decoders: [LTCDecoder] = []
    private var sampleRate: Double = 48_000
    private var state = Snapshot()
    private var lastLabelNumber: Int?
    private var lockedChannel: Int?

    func configure(sampleRate: Double, channels: Int) {
        lock.lock(); defer { lock.unlock() }
        self.sampleRate = sampleRate
        decoders = (0..<max(1, channels)).map { _ in LTCDecoder(sampleRate: sampleRate) }
        state = Snapshot()
        lastLabelNumber = nil
        lockedChannel = nil
    }

    func snapshot() -> Snapshot {
        lock.lock(); defer { lock.unlock() }
        return state
    }

    func consume(_ buffer: AVAudioPCMBuffer, at when: AVAudioTime) {
        guard let channels = buffer.floatChannelData else { return }
        let count = Int(buffer.frameLength)
        guard count > 0 else { return }

        // The tap's host time is when the first sample of the buffer was
        // captured; input latency is how long it spent getting from the jack
        // to the converter.
        let latency = AVAudioSession.sharedInstance().inputLatency

        lock.lock(); defer { lock.unlock() }

        let bufferStart = when.isHostTimeValid
            ? MonotonicClock.fromHostTime(when.hostTime)
            : MonotonicClock.now() - Double(count) / sampleRate

        var peak: Float = 0
        for (channel, decoder) in decoders.enumerated() {
            let startPosition = decoder.position
            let frames = decoder.process(UnsafeBufferPointer(start: channels[channel], count: count))
            peak = max(peak, decoder.level)

            if lockedChannel == nil, !frames.isEmpty { lockedChannel = channel }
            guard channel == lockedChannel else { continue }

            for frame in frames {
                let offset = Double(frame.startSample - startPosition) / sampleRate
                let number = ((frame.hours * 60 + frame.minutes) * 60 + frame.seconds) * 30 + frame.frames
                if let last = lastLabelNumber, number > last, number - last <= 6 {
                    state.consecutive += 1
                } else {
                    state.consecutive = 0
                }
                lastLabelNumber = number
                state.lastFrame = frame
                state.lastFrameAt = bufferStart + offset - latency
                state.rate = decoder.detectedRate
            }
        }
        state.level = peak

        // A channel that has gone quiet gives the other one a chance.
        if let locked = lockedChannel, state.lastFrame != nil,
           MonotonicClock.now() - state.lastFrameAt > 1.0 {
            decoders[locked].reset()
            lockedChannel = nil
            state.consecutive = 0
        }
    }
}
