import AVFoundation
import AudioToolbox

/// The sound the slate makes when it claps.
///
/// Synthesised rather than a system sound: a broadband transient with a hard
/// attack, so it stands out as a sharp spike on a waveform when lining up
/// sound in the edit, the way real sticks do. Played through a running engine
/// so it fires within a few milliseconds of the tap.
@MainActor
final class ClapSound {

    private var engine: AVAudioEngine?
    private var player: AVAudioPlayerNode?
    private var buffer: AVAudioPCMBuffer?
    private var configObserver: NSObjectProtocol?

    func start() {
        guard engine == nil else { return }
        SlateAudioSession.activate()

        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        let format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1)!
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        buffer = Self.makeClap(format: format)

        do {
            engine.prepare()
            try engine.start()
            player.play()
            self.engine = engine
            self.player = player
        } catch {
            Task { await Diagnostics.shared.record("audio", "clap engine: \(error.localizedDescription)", isFailure: true) }
        }

        configObserver = NotificationCenter.default.addObserver(
            forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.restart() }
        }
    }

    func stop() {
        if let configObserver { NotificationCenter.default.removeObserver(configObserver) }
        configObserver = nil
        player?.stop()
        engine?.stop()
        player = nil
        guard engine != nil else { return }
        engine = nil
        SlateAudioSession.deactivate()
    }

    func play() {
        guard let engine, let player, let buffer else {
            AudioServicesPlaySystemSound(1104)
            return
        }
        if !engine.isRunning {
            try? engine.start()
        }
        if !player.isPlaying { player.play() }
        player.scheduleBuffer(buffer, at: nil, options: .interrupts)
    }

    private func restart() {
        guard engine != nil else { return }
        stop()
        start()
    }

    /// Noise burst plus a short 2 kHz ping, both with a ~6 ms decay.
    private static func makeClap(format: AVAudioFormat) -> AVAudioPCMBuffer? {
        let length = AVAudioFrameCount(format.sampleRate * 0.12)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: length),
              let samples = buffer.floatChannelData?[0] else { return nil }
        buffer.frameLength = length

        var generator = SystemRandomNumberGenerator()
        let rate = Float(format.sampleRate)
        for i in 0..<Int(length) {
            let t = Float(i) / rate
            let noise = Float.random(in: -1...1, using: &generator) * exp(-t / 0.006)
            let ping = sin(2 * .pi * 2_000 * t) * exp(-t / 0.018)
            samples[i] = (noise * 0.75 + ping * 0.35) * 0.9
        }
        return buffer
    }
}
