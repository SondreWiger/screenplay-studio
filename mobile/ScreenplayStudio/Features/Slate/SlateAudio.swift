import AVFoundation
import QuartzCore
import UIKit
import os

/// The slate's sound: the sync beep, LTC out to a camera, and LTC in from a
/// recorder to jam the clock.
///
/// Everything runs through one `AVAudioEngine`. The beep is pre-rendered and
/// scheduled for a host time, so it can land on the same instant the screen
/// flashes; the LTC generator is phase-locked to the slate's clock rather than
/// free-running on the audio clock, so it can't drift away from the board.
final class SlateAudio {

    /// The slate's jam, shared with the render thread.
    final class JamBox {
        // Heap-allocated so the lock has a fixed address, which an
        // `os_unfair_lock` stored inline in a class isn't guaranteed.
        private let lock: UnsafeMutablePointer<os_unfair_lock> = {
            let lock = UnsafeMutablePointer<os_unfair_lock>.allocate(capacity: 1)
            lock.initialize(to: os_unfair_lock())
            return lock
        }()
        private var _jam: TimecodeJam
        private var _rate: FrameRate

        init(jam: TimecodeJam, rate: FrameRate) {
            _jam = jam
            _rate = rate
        }

        deinit {
            lock.deinitialize(count: 1)
            lock.deallocate()
        }

        func set(jam: TimecodeJam, rate: FrameRate) {
            os_unfair_lock_lock(lock)
            _jam = jam
            _rate = rate
            os_unfair_lock_unlock(lock)
        }

        func read() -> (TimecodeJam, FrameRate) {
            os_unfair_lock_lock(lock)
            defer { os_unfair_lock_unlock(lock) }
            return (_jam, _rate)
        }
    }

    /// What LTC input heard, reported on the main thread.
    struct LTCReading {
        var timecode: Timecode
        /// Real frame rate measured from the signal.
        var measuredFPS: Double
        var dropFrame: Bool
        /// Slate clock time at which `timecode`'s frame began.
        var frameStartClock: Double
    }

    let jamBox: JamBox

    private let engine = AVAudioEngine()
    private let beepPlayer = AVAudioPlayerNode()
    private var ltcSource: AVAudioSourceNode?
    private var ltcAmplitude: Float = 0.5
    /// The format the beep player was connected with; the beep buffer must match it.
    private var beepFormat: AVAudioFormat?
    private var beepBuffer: AVAudioPCMBuffer?
    private var beepDuration: Double = 0
    /// The session is set up for recording as well as playback.
    private var listening = false
    private var listenSampleRate: Double = 0
    private var decoder: LTCDecoder?
    private var consecutive = 0
    private var lastDecodedFrames = -1
    private var onReading: ((LTCReading) -> Void)?
    /// Between `prepare` and `stopAll`: the slate screen is up and wants sound.
    private var isActive = false
    private var observers: [NSObjectProtocol] = []

    private(set) var isLTCOutputOn = false
    private(set) var isListening = false

    init(jam: TimecodeJam, rate: FrameRate) {
        jamBox = JamBox(jam: jam, rate: rate)
        engine.attach(beepPlayer)

        let center = NotificationCenter.default
        observers = [
            // A route change (headphones, an interface plugged in) stops the
            // engine and can change the hardware's sample rate.
            center.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
                self?.configurationChanged()
            },
            // A call, Siri or an alarm takes the audio; take it back after.
            center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
                guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                      AVAudioSession.InterruptionType(rawValue: raw) == .ended else { return }
                self?.resume()
            },
            center.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in
                self?.resume()
            },
        ]
    }

    deinit {
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        stopAll()
    }

    // MARK: - Session

    private func configureSession() throws {
        let session = AVAudioSession.sharedInstance()
        if listening {
            // `.measurement` turns off the input processing (gain control,
            // noise suppression) that would mangle a timecode signal.
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.mixWithOthers, .defaultToSpeaker])
        } else {
            // Mix with others: the slate must never stop audio another app is
            // recording or playing.
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        }
        try session.setPreferredIOBufferDuration(0.005)
        try session.setActive(true)
    }

    /// Start the engine if it isn't running. The session is only touched when
    /// it has to be: these are blocking calls to the audio server, and the
    /// beep is scheduled within a frame or two of the clap.
    private func startEngine() throws {
        if !engine.isRunning { try configureSession() }
        if beepFormat == nil {
            let rate = engine.outputNode.outputFormat(forBus: 0).sampleRate
            if let format = AVAudioFormat(standardFormatWithSampleRate: rate > 0 ? rate : 48_000, channels: 1) {
                engine.connect(beepPlayer, to: engine.mainMixerNode, format: format)
                beepFormat = format
            }
        }
        if !engine.isRunning {
            engine.prepare()
            try engine.start()
        }
        if !beepPlayer.isPlaying { beepPlayer.play() }
    }

    /// Seconds between a buffer being rendered and it leaving the speaker.
    var outputLatency: Double {
        let session = AVAudioSession.sharedInstance()
        return session.outputLatency + session.ioBufferDuration
    }

    /// Bring back whatever was running after the engine stopped.
    private func resume() {
        guard isActive || isLTCOutputOn || isListening else { return }
        if isLTCOutputOn {
            // Rebuilt rather than resumed, so it lines up with the frame grid
            // again straight away instead of drifting back over seconds.
            try? restartLTCOutput()
        }
        try? startEngine()
    }

    private func configurationChanged() {
        if isListening, let onReading,
           engine.inputNode.outputFormat(forBus: 0).sampleRate != listenSampleRate {
            // A recorder or interface plugged in after tapping Listen: the
            // decoder has to be rebuilt for the new input's sample rate.
            stopListening()
            try? startListening(onReading: onReading)
        }
        resume()
    }

    /// Get the engine running ahead of the first clap, so the beep has no
    /// start-up delay.
    func prepare(beepDuration: Double) {
        isActive = true
        do {
            try startEngine()
            makeBeep(duration: beepDuration)
        } catch {
            print("[slate] audio start failed: \(error)")
        }
    }

    func stopAll() {
        isActive = false
        stopLTCOutput()
        stopListening()
        beepPlayer.stop()
        engine.stop()
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    // MARK: - Sync beep

    /// A 1 kHz tone with a hard onset — the transient an editor lines up — and
    /// a short fade at the end so it doesn't click.
    private func makeBeep(duration: Double) {
        guard let format = beepFormat, abs(duration - beepDuration) > 0.0005 || beepBuffer == nil else { return }
        let sampleRate = format.sampleRate
        let count = AVAudioFrameCount(max(1, duration * sampleRate))
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: count),
              let data = buffer.floatChannelData?[0] else { return }
        buffer.frameLength = count
        let fade = Int(0.003 * sampleRate)
        for i in 0..<Int(count) {
            let tail = Int(count) - i
            let envelope = tail < fade ? Float(tail) / Float(fade) : 1
            data[i] = 0.9 * envelope * sinf(2 * .pi * 1000 * Float(i) / Float(sampleRate))
        }
        beepBuffer = buffer
        beepDuration = duration
    }

    /// Play the beep so it leaves the speaker at `hostSeconds`
    /// (`CACurrentMediaTime` base), or straight away if that's already past.
    func playBeep(leavingSpeakerAt hostSeconds: Double, duration: Double) {
        do { try startEngine() } catch { return }
        makeBeep(duration: duration)
        guard let buffer = beepBuffer else { return }
        let renderAt = hostSeconds - outputLatency
        if renderAt > CACurrentMediaTime() + 0.002 {
            let when = AVAudioTime(hostTime: AVAudioTime.hostTime(forSeconds: renderAt))
            beepPlayer.scheduleBuffer(buffer, at: when, options: [], completionHandler: nil)
        } else {
            print("[slate] beep scheduled late by \(Int((CACurrentMediaTime() - renderAt) * 1000)) ms")
            beepPlayer.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        }
    }

    // MARK: - LTC out

    /// Generate LTC on the audio output, for a camera's audio input. The
    /// generator's frames are aligned to — and kept aligned to — the slate's
    /// frame boundaries.
    func startLTCOutput(amplitude: Float = 0.5) throws {
        guard ltcSource == nil else { return }
        ltcAmplitude = amplitude
        try configureSession()
        let sampleRate = engine.outputNode.outputFormat(forBus: 0).sampleRate
        guard sampleRate > 0, let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1) else {
            throw NSError(domain: "Slate", code: 2, userInfo: [NSLocalizedDescriptionKey: "No audio output is available."])
        }

        let box = jamBox
        let latency = outputLatency
        let (startJam, rate) = box.read()
        let ltcFramePeriod = 1 / LTC.frameRate(for: rate)
        // At 48/50/60 fps each LTC frame carries an (even, odd) pair of video
        // frames, so boundaries fall on even frame counts.
        let framesPerLTC = rate.nominal > 30 ? 2.0 : 1.0

        /// Where `clock` sits relative to the slate's LTC frame grid, in
        /// seconds: 0 on a boundary, positive just after one.
        func offsetFromBoundary(_ clock: Double, _ jam: TimecodeJam) -> Double {
            let parity = framesPerLTC > 1 ? Double(jam.anchorFrames & 1) : 0
            let position = ((clock - jam.anchorClock) * rate.actual + parity) / framesPerLTC
            return (position - position.rounded()) * ltcFramePeriod
        }

        // State owned by the render thread from here on. The generator is
        // made here because the render thread mustn't allocate; a new frame
        // rate replaces the whole source node (`restartLTCOutput`).
        var lastJam = startJam
        var needsAlign = true
        var silenceRemaining = 0
        /// Slate-clock time of the sample being generated.
        var sampleClock = 0.0

        let encoder = LTCEncoder(sampleRate: sampleRate, rate: rate, amplitude: amplitude) {
            // The frame starting now: the slate's frame at this instant (taken
            // half a frame in, so a boundary a sample early doesn't send the
            // previous label), and how far this start sits from the true
            // boundary.
            let (jam, _) = box.read()
            let frames = jam.frameCount(at: sampleClock + 0.5 / rate.actual, rate: rate)
            let late = offsetFromBoundary(sampleClock, jam)
            return LTCEncoder.FrameStart(
                frame: LTC.Frame(timecode: Timecode(frameCount: frames, rate: rate), dropFrame: rate.isDropFrame),
                phaseCorrection: -late * sampleRate
            )
        }

        let source = AVAudioSourceNode(format: format) { _, timestamp, frameCount, audioBufferList -> OSStatus in
            let buffers = UnsafeMutableAudioBufferListPointer(audioBufferList)
            guard let out = buffers.first?.mData?.assumingMemoryBound(to: Float.self) else { return noErr }
            let count = Int(frameCount)
            let (jam, currentRate) = box.read()

            if currentRate != rate {
                // Waiting to be replaced by a generator at the new rate.
                out.update(repeating: 0, count: count)
            } else {
                if jam != lastJam {
                    // Re-jammed: the frame grid moved, so start again on it
                    // rather than creep over at a sample a frame.
                    lastJam = jam
                    needsAlign = true
                }

                // Re-derived from the host clock every buffer, so the audio
                // clock's own drift never accumulates.
                let hostSeconds = AVAudioTime.seconds(forHostTime: timestamp.pointee.mHostTime)
                let bufferClock = SlateClock.fromHostSeconds(hostSeconds + latency)

                if needsAlign {
                    // Hold the first frame back to the next boundary of the
                    // slate's frame grid.
                    var wait = -offsetFromBoundary(bufferClock, jam)
                    if wait < 0 { wait += ltcFramePeriod }
                    silenceRemaining = Int((wait * sampleRate).rounded())
                    encoder.reset()
                    needsAlign = false
                }

                for i in 0..<count {
                    sampleClock = bufferClock + Double(i) / sampleRate
                    if silenceRemaining > 0 {
                        silenceRemaining -= 1
                        out[i] = 0
                    } else {
                        out[i] = encoder.nextSample()
                    }
                }
            }

            // Copy to any further channels.
            if buffers.count > 1 {
                for index in 1..<buffers.count {
                    if let channel = buffers[index].mData?.assumingMemoryBound(to: Float.self) {
                        channel.update(from: out, count: count)
                    }
                }
            }
            return noErr
        }

        engine.attach(source)
        engine.connect(source, to: engine.mainMixerNode, format: format)
        ltcSource = source
        isLTCOutputOn = true
        do {
            try startEngine()
        } catch {
            stopLTCOutput()
            throw error
        }
    }

    /// A fresh generator: after the frame rate changes, or the engine was
    /// stopped by an interruption or a route change.
    func restartLTCOutput() throws {
        guard isLTCOutputOn else { return }
        stopLTCOutput()
        try startLTCOutput(amplitude: ltcAmplitude)
    }

    func stopLTCOutput() {
        guard let source = ltcSource else { return }
        engine.disconnectNodeOutput(source)
        engine.detach(source)
        ltcSource = nil
        isLTCOutputOn = false
    }

    // MARK: - LTC in

    /// Listen on the audio input for LTC. `onReading` is called on the main
    /// thread once four frames in a row have decoded in sequence, and for every
    /// frame after that until `stopListening()`.
    func startListening(onReading: @escaping (LTCReading) -> Void) throws {
        guard !isListening else { return }
        listening = true
        do {
            try configureSession()
            try installListener(onReading: onReading)
            isListening = true
            try startEngine()
        } catch {
            // Leave nothing half set up: the next try starts clean.
            if isListening { engine.inputNode.removeTap(onBus: 0) }
            decoder = nil
            self.onReading = nil
            isListening = false
            listening = false
            try? configureSession()
            throw error
        }
    }

    private func installListener(onReading: @escaping (LTCReading) -> Void) throws {
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            throw NSError(domain: "Slate", code: 1, userInfo: [NSLocalizedDescriptionKey: "No audio input is available."])
        }
        self.onReading = onReading
        let sampleRate = format.sampleRate
        listenSampleRate = sampleRate
        let inputLatency = AVAudioSession.sharedInstance().inputLatency
        var bufferStartIndex = 0
        var bufferHostSeconds = 0.0
        consecutive = 0
        lastDecodedFrames = -1

        let decoder = LTCDecoder(sampleRate: sampleRate) { [weak self] decoded in
            guard let self else { return }
            let tc = decoded.frame.timecode
            let fps = sampleRate / (decoded.samplesPerBit * Double(LTC.bitsPerFrame))
            // Frame numbers in a row, or it's not a signal we trust yet.
            let index = (tc.hours * 3600 + tc.minutes * 60 + tc.seconds) * 100 + tc.frames
            self.consecutive = (index > self.lastDecodedFrames && index - self.lastDecodedFrames <= 100) ? self.consecutive + 1 : 0
            self.lastDecodedFrames = index
            guard self.consecutive >= 4 else { return }

            // The edge that completed this frame is where the next one starts.
            let startHost = bufferHostSeconds
                + Double(decoded.nextFrameStartSample - bufferStartIndex) / sampleRate
                - inputLatency
            let nextStartClock = SlateClock.fromHostSeconds(startHost)
            let reading = LTCReading(
                timecode: tc,
                measuredFPS: fps,
                dropFrame: decoded.frame.dropFrame,
                frameStartClock: nextStartClock - 1 / max(fps, 1)
            )
            DispatchQueue.main.async { self.onReading?(reading) }
        }
        self.decoder = decoder

        input.installTap(onBus: 0, bufferSize: 2048, format: format) { buffer, when in
            guard let channel = buffer.floatChannelData?[0] else { return }
            bufferStartIndex = decoder.sampleIndex
            bufferHostSeconds = when.isHostTimeValid
                ? AVAudioTime.seconds(forHostTime: when.hostTime)
                : CACurrentMediaTime() - Double(buffer.frameLength) / sampleRate
            decoder.process(channel, count: Int(buffer.frameLength))
        }
    }

    func stopListening() {
        guard isListening else { return }
        engine.inputNode.removeTap(onBus: 0)
        decoder = nil
        onReading = nil
        isListening = false
        listening = false
        // Drop back to the playback-only session.
        if engine.isRunning { try? configureSession() }
    }
}
