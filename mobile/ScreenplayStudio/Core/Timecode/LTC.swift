import Foundation

/// One decoded Linear Timecode frame.
struct LTCFrame: Equatable, Sendable {
    var hours: Int
    var minutes: Int
    var seconds: Int
    var frames: Int
    var dropFrame: Bool
    /// The eight user-bit groups, group 1 in the lowest nibble. Recorders
    /// often put the date or a reel number here.
    var userBits: UInt32
    /// Decoder sample count at the start of bit 0 — the frame edge the
    /// timecode label refers to.
    var startSample: Int64
    /// Decoder sample count at the end of the sync word.
    var endSample: Int64

    func timecode(at rate: FrameRate) -> Timecode {
        Timecode(hours: hours, minutes: minutes, seconds: seconds, frames: frames, rate: rate)
    }
}

/// Decodes SMPTE 12M Linear Timecode from audio samples.
///
/// LTC is 80 bits per frame in biphase mark code: the level flips at every bit
/// boundary, and flips again mid-bit for a 1. So the decoder only needs the
/// spacing between zero crossings — a long gap is a 0, two short ones are a 1
/// — which makes it indifferent to level, polarity and most of the abuse a
/// signal gets between a sync box and an iPad's audio input.
///
/// Each frame ends in a fixed 16-bit sync word; when the last sixteen bits
/// match it, the sixty-four before are the frame.
final class LTCDecoder {

    let sampleRate: Double

    /// Running count of samples consumed — the time base for frame positions.
    private(set) var position: Int64 = 0
    /// Peak absolute level of recent input, 0...1, for a signal meter.
    private(set) var level: Float = 0
    /// The LTC rate implied by the frame spacing and drop-frame flag, once
    /// there's enough signal to say.
    private(set) var detectedRate: FrameRate?

    // Signal conditioning
    private var previousInput: Float = 0
    private var previousOutput: Float = 0
    private var envelope: Float = 0
    private let envelopeDecay: Float
    private let levelDecay: Float
    private var isHigh = false
    private var lastTransition: Int64 = -1

    // Bit clock
    private var bitPeriod: Double
    private let minBitPeriod: Double
    private let maxBitPeriod: Double
    private var halfPending = false
    private var halfStart: Int64 = 0
    private var halfInterval: Double = 0

    // Shift register
    private var bits = [UInt8](repeating: 0, count: 80)
    private var bitStarts = [Int64](repeating: 0, count: 80)
    private var head = 0
    private var validBits = 0

    // Rate detection
    private var recentStarts: [Int64] = []
    private var lastFrameNumber: Int?

    private static let syncWord: [UInt8] = [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1]

    init(sampleRate: Double) {
        self.sampleRate = sampleRate
        // LTC runs from 23.976 to 30 fps, so a bit lasts between these.
        minBitPeriod = sampleRate / (80 * 30.5)
        maxBitPeriod = sampleRate / (80 * 23.5)
        bitPeriod = sampleRate / (80 * 27)
        envelopeDecay = Float(exp(-1 / (0.05 * sampleRate)))
        levelDecay = Float(exp(-1 / (0.3 * sampleRate)))
    }

    func reset() {
        halfPending = false
        validBits = 0
        lastTransition = -1
        recentStarts.removeAll()
        lastFrameNumber = nil
        detectedRate = nil
    }

    @discardableResult
    func process(_ samples: [Float]) -> [LTCFrame] {
        samples.withUnsafeBufferPointer { process($0) }
    }

    /// Feeds samples through and returns any frames completed within them.
    @discardableResult
    func process(_ samples: UnsafeBufferPointer<Float>) -> [LTCFrame] {
        var frames: [LTCFrame] = []

        // Start the DC blocker from the input's own level, or an input sitting
        // off zero kicks it into a transient that hides the first frames.
        if position == 0, let first = samples.first {
            previousInput = first
        }

        for sample in samples {
            // DC blocker: some inputs sit well off zero, which would bias
            // every crossing the same way and skew the bit timing.
            let output = sample - previousInput + 0.999 * previousOutput
            previousInput = sample
            previousOutput = output

            let magnitude = abs(output)
            envelope = max(magnitude, envelope * envelopeDecay)
            level = max(magnitude, level * levelDecay)

            // Hysteresis at a fraction of the envelope keeps hiss on a quiet
            // line from reading as transitions.
            let threshold = max(envelope * 0.3, 0.0015)
            if !isHigh, output > threshold {
                isHigh = true
                if let frame = transition(at: position) { frames.append(frame) }
            } else if isHigh, output < -threshold {
                isHigh = false
                if let frame = transition(at: position) { frames.append(frame) }
            }

            position += 1
        }

        return frames
    }

    // MARK: - Bits

    private func transition(at sample: Int64) -> LTCFrame? {
        defer { lastTransition = sample }
        guard lastTransition >= 0 else { return nil }

        let interval = Double(sample - lastTransition)
        let start = lastTransition

        // Nothing in LTC is shorter than a quarter bit or longer than one and
        // a half; either means noise or a dropout, so start over.
        guard interval > bitPeriod * 0.25, interval < bitPeriod * 1.5 else {
            resync()
            return nil
        }

        if interval > bitPeriod * 0.75 {
            // A full bit with no mid-bit flip: 0. Arriving after half a bit
            // means the pairing was off; drop the half and carry on.
            halfPending = false
            adapt(to: interval)
            return append(0, start: start, end: sample)
        }

        if halfPending {
            halfPending = false
            adapt(to: interval + halfInterval)
            return append(1, start: halfStart, end: sample)
        }

        halfPending = true
        halfStart = start
        halfInterval = interval
        return nil
    }

    private func adapt(to fullBit: Double) {
        bitPeriod = min(max(bitPeriod * 0.9 + fullBit * 0.1, minBitPeriod), maxBitPeriod)
    }

    private func resync() {
        halfPending = false
        validBits = 0
    }

    private func append(_ bit: UInt8, start: Int64, end: Int64) -> LTCFrame? {
        bits[head] = bit
        bitStarts[head] = start
        head = (head + 1) % 80
        validBits = min(validBits + 1, 80)

        guard validBits == 80 else { return nil }
        for (offset, expected) in Self.syncWord.enumerated() where self.bit(64 + offset) != expected {
            return nil
        }

        validBits = 0
        guard var frame = parseFrame() else { return nil }
        frame.endSample = end
        noteForRateDetection(frame)
        return frame
    }

    /// Bit `index` of the 80 in the register, oldest first.
    private func bit(_ index: Int) -> UInt8 {
        bits[(head + index) % 80]
    }

    private func value(_ from: Int, _ count: Int) -> Int {
        var result = 0
        for offset in 0..<count where bit(from + offset) == 1 {
            result |= 1 << offset
        }
        return result
    }

    private func parseFrame() -> LTCFrame? {
        let frameUnits = value(0, 4), secondUnits = value(16, 4)
        let minuteUnits = value(32, 4), hourUnits = value(48, 4)
        guard frameUnits < 10, secondUnits < 10, minuteUnits < 10, hourUnits < 10 else { return nil }

        let frames = frameUnits + 10 * value(8, 2)
        let seconds = secondUnits + 10 * value(24, 3)
        let minutes = minuteUnits + 10 * value(40, 3)
        let hours = hourUnits + 10 * value(56, 2)
        guard frames < 30, seconds < 60, minutes < 60, hours < 24 else { return nil }

        var userBits: UInt32 = 0
        for (group, offset) in [4, 12, 20, 28, 36, 44, 52, 60].enumerated() {
            userBits |= UInt32(value(offset, 4)) << UInt32(group * 4)
        }

        return LTCFrame(
            hours: hours, minutes: minutes, seconds: seconds, frames: frames,
            dropFrame: bit(10) == 1,
            userBits: userBits,
            startSample: bitStarts[head],
            endSample: 0
        )
    }

    // MARK: - Rate detection

    /// Measures frame spacing over consecutive frames. 24 and 23.976 differ by
    /// a tenth of a percent — two samples a frame at 48 kHz — so it averages
    /// over up to a second before committing.
    private func noteForRateDetection(_ frame: LTCFrame) {
        let number = ((frame.hours * 60 + frame.minutes) * 60 + frame.seconds) * 30 + frame.frames
        if let last = lastFrameNumber, number != last + 1, !(frame.frames == 0 && number > last) {
            recentStarts.removeAll()
        }
        lastFrameNumber = number

        recentStarts.append(frame.startSample)
        if recentStarts.count > 31 { recentStarts.removeFirst() }
        guard recentStarts.count >= 8, let first = recentStarts.first, let last = recentStarts.last else { return }

        let period = Double(last - first) / Double(recentStarts.count - 1)
        let fps = sampleRate / period
        let candidates: [(FrameRate, Double)] = frame.dropFrame
            ? [(.fps29_97DF, 30_000.0 / 1001)]
            : [(.fps23_976, 24_000.0 / 1001), (.fps24, 24), (.fps25, 25), (.fps29_97, 30_000.0 / 1001), (.fps30, 30)]
        guard let best = candidates.min(by: { abs($0.1 - fps) < abs($1.1 - fps) }),
              abs(best.1 - fps) / best.1 < 0.01 else { return }

        // Only distinguish pulldown from integer rates on a long enough run.
        if recentStarts.count < 24, [.fps23_976, .fps24, .fps29_97, .fps30].contains(best.0) {
            if detectedRate == nil || detectedRate?.nominal != best.0.nominal { detectedRate = best.0 }
            return
        }
        detectedRate = best.0
    }
}

/// Generates LTC audio. Used by the tests to prove the decoder against every
/// rate, and small enough to keep alongside it.
enum LTCEncoder {

    static func bits(for timecode: Timecode, userBits: UInt32 = 0) -> [UInt8] {
        var bits = [UInt8](repeating: 0, count: 80)
        func put(_ value: Int, at offset: Int, count: Int) {
            for i in 0..<count { bits[offset + i] = UInt8((value >> i) & 1) }
        }
        put(timecode.frames % 10, at: 0, count: 4)
        put(timecode.frames / 10, at: 8, count: 2)
        bits[10] = timecode.rate.isDropFrame ? 1 : 0
        put(timecode.seconds % 10, at: 16, count: 4)
        put(timecode.seconds / 10, at: 24, count: 3)
        put(timecode.minutes % 10, at: 32, count: 4)
        put(timecode.minutes / 10, at: 40, count: 3)
        put(timecode.hours % 10, at: 48, count: 4)
        put(timecode.hours / 10, at: 56, count: 2)
        for (group, offset) in [4, 12, 20, 28, 36, 44, 52, 60].enumerated() {
            put(Int((userBits >> UInt32(group * 4)) & 0xF), at: offset, count: 4)
        }
        let sync: [UInt8] = [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1]
        for (i, bit) in sync.enumerated() { bits[64 + i] = bit }
        return bits
    }

    /// Consecutive frames starting at `start`, as a square wave at `amplitude`.
    static func samples(
        from start: Timecode,
        frameCount: Int,
        ltcRate: FrameRate,
        sampleRate: Double,
        amplitude: Float = 0.5
    ) -> [Float] {
        let samplesPerBit = sampleRate / (ltcRate.actual * 80)
        var output: [Float] = []
        output.reserveCapacity(Int(Double(frameCount * 80) * samplesPerBit) + 1)
        var level: Float = amplitude
        var clock = 0.0
        var index = start.frameIndex

        for _ in 0..<frameCount {
            let timecode = Timecode(frameIndex: index, rate: ltcRate)
            for bit in bits(for: timecode) {
                // Every bit boundary flips the level.
                level = -level
                let mid = clock + samplesPerBit / 2
                let end = clock + samplesPerBit
                while Double(output.count) < mid.rounded() { output.append(level) }
                if bit == 1 { level = -level }
                while Double(output.count) < end.rounded() { output.append(level) }
                clock = end
            }
            index += 1
        }
        return output
    }
}
