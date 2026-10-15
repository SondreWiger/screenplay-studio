import Foundation

// SMPTE 12M linear timecode (LTC) — the audio signal timecode travels as
// between recorders, cameras and slates.
//
// A line-for-line port of `mobile/reference/ltc.ts`; `tests/slate-ltc.test.ts`
// and `tests/slate-timecode.test.ts` exercise that reference with encode →
// decode round trips at every rate, both sample rates, inverted polarity,
// noise and dropouts. Change both together.
//
// An LTC frame is 80 bits, sent least-significant first, once per video frame,
// biphase-mark coded: the level flips at the start of every bit, and a 1 flips
// again half-way through. The decoder only measures the time between flips —
// about one bit period is a 0, two half periods a 1 — so it doesn't care about
// polarity or level.

enum LTC {
    static let bitsPerFrame = 80
    /// Bits 64–79 as sent: 0011 1111 1111 1101.
    static let syncWord = 0x3FFD

    struct Frame: Equatable {
        var timecode: Timecode
        var dropFrame: Bool
    }

    /// Position of the biphase-mark polarity correction bit.
    static func polarityBit(_ rate: FrameRate) -> Int {
        (rate.nominal == 25 || rate.nominal == 50) ? 59 : 27
    }

    /// LTC frames per second: at 48/50/60 fps each LTC frame carries a pair of
    /// video frames, so it runs at half the rate.
    static func frameRate(for rate: FrameRate) -> Double {
        rate.nominal > 30 ? rate.actual / 2 : rate.actual
    }

    /// Writes a frame's 80 bits, in transmission order, into `bits`.
    static func encode(_ frame: Frame, rate: FrameRate, into bits: inout [UInt8]) {
        for i in 0..<bitsPerFrame { bits[i] = 0 }
        func set(_ start: Int, _ count: Int, _ value: Int) {
            for i in 0..<count { bits[start + i] = UInt8((value >> i) & 1) }
        }
        let tc = frame.timecode
        let ltcFrames = rate.nominal > 30 ? tc.frames / 2 : tc.frames
        set(0, 4, ltcFrames % 10)
        set(8, 2, ltcFrames / 10)
        bits[10] = frame.dropFrame ? 1 : 0
        set(16, 4, tc.seconds % 10)
        set(24, 3, tc.seconds / 10)
        set(32, 4, tc.minutes % 10)
        set(40, 3, tc.minutes / 10)
        set(48, 4, tc.hours % 10)
        set(56, 2, tc.hours / 10)
        for i in 0..<16 { bits[64 + i] = UInt8((syncWord >> (15 - i)) & 1) }
        // An even number of ones per frame, so every frame starts on the same edge.
        var ones = 0
        for i in 0..<bitsPerFrame { ones += Int(bits[i]) }
        bits[polarityBit(rate)] = UInt8(ones % 2)
    }

    static func decode(_ bits: [UInt8]) -> Frame? {
        for i in 0..<16 where Int(bits[64 + i]) != (syncWord >> (15 - i)) & 1 { return nil }
        func read(_ start: Int, _ count: Int) -> Int {
            var value = 0
            for i in 0..<count { value |= Int(bits[start + i]) << i }
            return value
        }
        let frames = read(0, 4) + 10 * read(8, 2)
        let seconds = read(16, 4) + 10 * read(24, 3)
        let minutes = read(32, 4) + 10 * read(40, 3)
        let hours = read(48, 4) + 10 * read(56, 2)
        guard frames <= 29, seconds <= 59, minutes <= 59, hours <= 23 else { return nil }
        return Frame(
            timecode: Timecode(hours: hours, minutes: minutes, seconds: seconds, frames: frames),
            dropFrame: bits[10] == 1
        )
    }
}

// MARK: - Encoder

/// Generates LTC sample by sample. Runs on the audio render thread, so it never
/// allocates after `init`; each frame's timecode comes from `nextFrame`, which
/// lets the caller keep it locked to the slate's clock.
final class LTCEncoder {

    /// What the caller supplies at the start of each frame.
    struct FrameStart {
        var frame: LTC.Frame
        /// Samples to shift this frame's timing by (positive = later), so the
        /// caller can hold frame starts on its own clock's boundaries.
        var phaseCorrection: Double = 0
    }

    let sampleRate: Double
    let rate: FrameRate
    let samplesPerBit: Double
    var amplitude: Float

    private var bits = [UInt8](repeating: 0, count: LTC.bitsPerFrame)
    private var bitIndex = LTC.bitsPerFrame
    private var phase: Double
    private var midFlipped = false
    private var level: Float = 1
    private var output: Float = 0
    private let slew: Float
    private let nextFrame: () -> FrameStart

    init(sampleRate: Double, rate: FrameRate, amplitude: Float = 0.5, nextFrame: @escaping () -> FrameStart) {
        self.sampleRate = sampleRate
        self.rate = rate
        self.amplitude = amplitude
        self.nextFrame = nextFrame
        samplesPerBit = sampleRate / (LTC.frameRate(for: rate) * Double(LTC.bitsPerFrame))
        // SMPTE asks for a 25–50 µs rise time; edges ramp over roughly 40 µs.
        slew = (2 * amplitude) / Float(max(1, 40e-6 * sampleRate))
        phase = samplesPerBit // start exactly on a bit boundary
    }

    /// Samples until the next frame starts.
    var samplesUntilFrame: Double {
        Double(LTC.bitsPerFrame - bitIndex - 1) * samplesPerBit + (samplesPerBit - phase)
    }

    @inline(__always)
    func nextSample() -> Float {
        if phase >= samplesPerBit {
            phase -= samplesPerBit
            bitIndex += 1
            if bitIndex >= LTC.bitsPerFrame {
                bitIndex = 0
                let start = nextFrame()
                LTC.encode(start.frame, rate: rate, into: &bits)
                // A small correction only: a jump would read as a glitch.
                phase -= max(-1, min(1, start.phaseCorrection))
            }
            level = -level // every bit starts with a transition
            midFlipped = false
        } else if !midFlipped, bits[bitIndex] == 1, phase >= samplesPerBit / 2 {
            level = -level // and a 1 has another half-way through
            midFlipped = true
        }
        phase += 1
        let target = level * amplitude
        output += max(-slew, min(slew, target - output))
        return output
    }
}

// MARK: - Decoder

/// Decodes LTC from audio. Feed it samples in order; it reports every complete
/// frame. Copes with either polarity, any level above the noise, and any rate
/// from 23.976 to 30 frames per second.
final class LTCDecoder {

    struct Decoded {
        var frame: LTC.Frame
        /// Sample index (in this decoder's running count) at which the frame
        /// *after* the decoded one begins.
        var nextFrameStartSample: Int
        /// Measured samples per bit, from which the real frame rate follows.
        var samplesPerBit: Double
    }

    let sampleRate: Double
    private(set) var sampleIndex = 0
    private var envelope: Float = 0
    private var high = false
    private var lastEdge = -1
    private var bitPeriod: Double
    private let minBit: Double
    private let maxBit: Double
    private var halfPending = false
    private var ring = [UInt8](repeating: 0, count: LTC.bitsPerFrame)
    private var head = 0
    private var recent16 = 0
    private var bitsSinceReset = 0
    private var frameBits = [UInt8](repeating: 0, count: LTC.bitsPerFrame)
    private let onFrame: (Decoded) -> Void

    init(sampleRate: Double, onFrame: @escaping (Decoded) -> Void) {
        self.sampleRate = sampleRate
        self.onFrame = onFrame
        // 23.976–30 fps spans about 20–25 samples per bit at 48 kHz.
        minBit = sampleRate / (31 * Double(LTC.bitsPerFrame))
        maxBit = sampleRate / (23 * Double(LTC.bitsPerFrame))
        bitPeriod = (minBit + maxBit) / 2
    }

    func process(_ samples: UnsafePointer<Float>, count: Int) {
        let release = 1 - Float(10 / sampleRate)
        for i in 0..<count {
            let x = samples[i]
            let magnitude = abs(x)
            // Peak follower: instant attack, ~0.1 s release.
            envelope = magnitude > envelope ? magnitude : envelope * release
            let threshold = envelope * 0.3
            if envelope > 0.002 {
                if !high && x > threshold {
                    high = true
                    edge()
                } else if high && x < -threshold {
                    high = false
                    edge()
                }
            }
            sampleIndex += 1
        }
    }

    private func edge() {
        let at = sampleIndex
        guard lastEdge >= 0 else {
            lastEdge = at
            return
        }
        let interval = Double(at - lastEdge)
        lastEdge = at

        if interval > maxBit * 1.4 || interval < minBit * 0.3 {
            // Silence, a dropout or a glitch: start over.
            halfPending = false
            bitsSinceReset = 0
            return
        }

        if interval < bitPeriod * 0.75 {
            // Half a bit. Two in a row are a 1.
            if halfPending {
                halfPending = false
                pushBit(1, at: at)
            } else {
                halfPending = true
            }
            adapt(interval * 2)
        } else {
            if halfPending {
                // A half without its partner: out of step. Resynchronise here.
                halfPending = false
                bitsSinceReset = 0
            }
            pushBit(0, at: at)
            adapt(interval)
        }
    }

    private func adapt(_ period: Double) {
        if period >= minBit * 0.9 && period <= maxBit * 1.1 {
            bitPeriod += (period - bitPeriod) * 0.05
        }
    }

    private func pushBit(_ bit: UInt8, at: Int) {
        ring[head] = bit
        head = (head + 1) % LTC.bitsPerFrame
        recent16 = ((recent16 << 1) | Int(bit)) & 0xFFFF
        bitsSinceReset += 1
        guard bitsSinceReset >= LTC.bitsPerFrame, recent16 == LTC.syncWord else { return }

        // The 80 most recent bits, oldest (frame bit 0) first; `head` is the oldest.
        for k in 0..<LTC.bitsPerFrame { frameBits[k] = ring[(head + k) % LTC.bitsPerFrame] }
        guard let frame = LTC.decode(frameBits) else { return }
        onFrame(Decoded(frame: frame, nextFrameStartSample: at, samplesPerBit: bitPeriod))
    }
}
