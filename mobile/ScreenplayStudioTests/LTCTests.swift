import XCTest
@testable import Screenplay_Studio

final class LTCTests: XCTestCase {

    private let ltcRates: [FrameRate] = [.fps23_976, .fps24, .fps25, .fps29_97DF, .fps29_97, .fps30]

    /// Encodes a run of frames and decodes it again. The first frame is lost
    /// (the decoder needs its leading edge), everything after must match.
    private func roundTrip(
        rate: FrameRate,
        sampleRate: Double,
        start: Timecode,
        frameCount: Int = 60,
        chunk: Int? = nil,
        transform: (([Float]) -> [Float])? = nil
    ) -> (frames: [LTCFrame], decoder: LTCDecoder) {
        var samples = LTCEncoder.samples(from: start, frameCount: frameCount, ltcRate: rate, sampleRate: sampleRate)
        if let transform { samples = transform(samples) }
        let decoder = LTCDecoder(sampleRate: sampleRate)
        var frames: [LTCFrame] = []
        if let chunk {
            var offset = 0
            while offset < samples.count {
                frames += decoder.process(Array(samples[offset..<min(offset + chunk, samples.count)]))
                offset += chunk
            }
        } else {
            frames = decoder.process(samples)
        }
        return (frames, decoder)
    }

    private func assertSequential(_ frames: [LTCFrame], from start: Timecode, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertGreaterThan(frames.count, 40, "decoded too few frames", file: file, line: line)
        guard let first = frames.first else { return }
        let firstIndex = first.timecode(at: start.rate).frameIndex
        XCTAssertLessThanOrEqual(firstIndex - start.frameIndex, 1, "lost more than the first frame", file: file, line: line)
        for (offset, frame) in frames.enumerated() {
            let expected = Timecode(frameIndex: firstIndex + offset, rate: start.rate)
            XCTAssertEqual(frame.timecode(at: start.rate), expected, file: file, line: line)
            XCTAssertEqual(frame.dropFrame, start.rate.isDropFrame, file: file, line: line)
        }
    }

    func testRoundTripAtEveryRateAndSampleRate() {
        for rate in ltcRates {
            for sampleRate in [44_100.0, 48_000.0] {
                // Across a minute boundary, where drop-frame skips labels.
                let start = Timecode.parse("10:00:58:00", rate: rate)!
                let result = roundTrip(rate: rate, sampleRate: sampleRate, start: start, frameCount: 90)
                assertSequential(result.frames, from: start)
                XCTAssertEqual(result.decoder.detectedRate, rate, "\(rate) at \(sampleRate)")
            }
        }
    }

    func testDecodesAcrossBufferBoundaries() {
        let start = Timecode.parse("01:02:03:04", rate: .fps25)!
        let result = roundTrip(rate: .fps25, sampleRate: 48_000, start: start, chunk: 509)
        assertSequential(result.frames, from: start)
    }

    func testSurvivesAWeakNoisyOffsetInvertedSignal() {
        var generator = SeededGenerator(seed: 42)
        let start = Timecode.parse("23:59:58:00", rate: .fps24)!
        let result = roundTrip(rate: .fps24, sampleRate: 48_000, start: start) { samples in
            samples.map { -0.04 * $0 + 0.2 + Float.random(in: -0.004...0.004, using: &generator) }
        }
        // Wraps through midnight on the way.
        assertSequential(result.frames, from: start)
    }

    func testFrameStartIsTheFrameEdge() {
        let sampleRate = 48_000.0
        let rate = FrameRate.fps25
        let start = Timecode.parse("10:00:00:00", rate: rate)!
        let result = roundTrip(rate: rate, sampleRate: sampleRate, start: start)
        let samplesPerFrame = sampleRate / rate.actual
        for frame in result.frames {
            let k = frame.timecode(at: rate).frameIndex - start.frameIndex
            XCTAssertEqual(Double(frame.startSample), Double(k) * samplesPerFrame, accuracy: 1.5)
        }
    }

    func testUserBitsRoundTrip() {
        let rate = FrameRate.fps25
        let tc = Timecode.parse("12:34:56:07", rate: rate)!
        let bits = LTCEncoder.bits(for: tc, userBits: 0x2610_0826)
        XCTAssertEqual(Array(bits[64..<80]), [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1])

        // Three frames with the same user bits. The first loses its leading
        // edge and the last never sees the edge that ends it, so the middle
        // one is the one that decodes in full.
        var samples: [Float] = []
        var level: Float = 0.5
        let perBit = 48_000 / (rate.actual * 80)
        var clock = 0.0
        for frame in (0..<3).map({ Timecode(frameIndex: tc.frameIndex + $0, rate: rate) }) {
            for bit in LTCEncoder.bits(for: frame, userBits: 0x2610_0826) {
                level = -level
                let mid = clock + perBit / 2, end = clock + perBit
                while Double(samples.count) < mid.rounded() { samples.append(level) }
                if bit == 1 { level = -level }
                while Double(samples.count) < end.rounded() { samples.append(level) }
                clock = end
            }
        }
        let decoded = LTCDecoder(sampleRate: 48_000).process(samples)
        XCTAssertEqual(decoded.count, 1)
        XCTAssertEqual(decoded.last?.userBits, 0x2610_0826)
        XCTAssertEqual(decoded.last?.timecode(at: rate).description, "12:34:56:08")
    }

    func testSilenceAndNoiseDecodeNothing() {
        var generator = SeededGenerator(seed: 7)
        let noise = (0..<48_000).map { _ in Float.random(in: -0.3...0.3, using: &generator) }
        XCTAssertTrue(LTCDecoder(sampleRate: 48_000).process(noise).isEmpty)
        XCTAssertTrue(LTCDecoder(sampleRate: 48_000).process([Float](repeating: 0, count: 48_000)).isEmpty)
    }
}

/// Deterministic randomness so a failing noise test fails the same way twice.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> UInt64 {
        state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
        return state
    }
}
