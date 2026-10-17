import XCTest
@testable import Screenplay_Studio

final class TimecodeTests: XCTestCase {

    // MARK: - Labels and frame counts

    func testNonDropRoundTripsEveryRate() {
        for rate in FrameRate.allCases where !rate.isDropFrame {
            for index in stride(from: 0, to: rate.framesPerDay, by: 7_919) {
                let label = Timecode(frameIndex: index, rate: rate)
                XCTAssertTrue(label.isValid, "\(rate) \(label)")
                XCTAssertEqual(label.frameIndex, index, "\(rate) \(label)")
            }
        }
    }

    func testDropFrameRoundTripsEveryFrameOfAnHour() {
        for rate in [FrameRate.fps29_97DF, .fps59_94DF] {
            let hour = rate.framesPerTenMinutes * 6
            for index in 0..<hour {
                let label = Timecode(frameIndex: index, rate: rate)
                XCTAssertTrue(label.isValid, "\(rate) \(label) is a dropped label")
                XCTAssertEqual(label.frameIndex, index, "\(rate) \(label)")
            }
        }
    }

    func testDropFrameKnownValues() {
        let rate = FrameRate.fps29_97DF
        XCTAssertEqual(rate.framesPerDay, 2_589_408)
        XCTAssertEqual(Timecode(frameIndex: 1_799, rate: rate).description, "00:00:59;29")
        // ;00 and ;01 don't exist at the top of minute one.
        XCTAssertEqual(Timecode(frameIndex: 1_800, rate: rate).description, "00:01:00;02")
        // …but do at every tenth minute.
        XCTAssertEqual(Timecode(frameIndex: 17_982, rate: rate).description, "00:10:00;00")
        XCTAssertEqual(Timecode(hours: 1, minutes: 0, seconds: 0, frames: 0, rate: rate).frameIndex, 107_892)

        let sixty = FrameRate.fps59_94DF
        XCTAssertEqual(sixty.framesPerDay, 5_178_816)
        XCTAssertEqual(Timecode(frameIndex: 3_600, rate: sixty).description, "00:01:00;04")
    }

    func testWrapsAtMidnight() {
        for rate in FrameRate.allCases {
            XCTAssertEqual(Timecode(frameIndex: rate.framesPerDay, rate: rate).frameIndex, 0)
            let beforeMidnight = Timecode(frameIndex: -1, rate: rate)
            XCTAssertEqual(beforeMidnight.hours, 23)
            XCTAssertEqual(beforeMidnight.minutes, 59)
            XCTAssertEqual(beforeMidnight.seconds, 59)
            XCTAssertEqual(beforeMidnight.frames, rate.nominal - 1)
        }
    }

    func testParsing() {
        XCTAssertEqual(Timecode.parse("10:00:00:00", rate: .fps25)?.description, "10:00:00:00")
        XCTAssertEqual(Timecode.parse("1000000", rate: .fps25)?.description, "01:00:00:00")
        XCTAssertEqual(Timecode.parse("10.20.30.12", rate: .fps24)?.description, "10:20:30:12")
        XCTAssertNil(Timecode.parse("10:00:00:25", rate: .fps25), "frame 25 doesn't exist at 25 fps")
        XCTAssertNil(Timecode.parse("24:00:00:00", rate: .fps25))
        XCTAssertNil(Timecode.parse("", rate: .fps25))
        // A dropped label rounds forward to the first real one.
        XCTAssertEqual(Timecode.parse("00:01:00:00", rate: .fps29_97DF)?.description, "00:01:00;02")
    }

    func testRateConversionKeepsTheMoment() {
        let tc = Timecode(hours: 10, minutes: 0, seconds: 0, frames: 12, rate: .fps25)
        XCTAssertEqual(tc.converted(to: .fps50).description, "10:00:00:24")
        XCTAssertEqual(tc.converted(to: .fps25), tc)
        let back = Timecode(hours: 10, minutes: 0, seconds: 0, frames: 24, rate: .fps50).converted(to: .fps25)
        XCTAssertEqual(back.frames, 12)
    }

    // MARK: - Clock

    func testJammedClockCountsRealFrames() {
        let jam = JamReference(frameIndex: 900_000, rate: .fps25, monotonic: 100, wallClock: Date(), origin: .manual)
        let clock = TimecodeClock(source: .jam, rate: .fps25, jam: jam)
        XCTAssertEqual(clock.reading(at: 101).timecode.frameIndex, 900_025)
        XCTAssertEqual(clock.reading(at: 100.5).timecode.frameIndex, 900_012)
        XCTAssertEqual(clock.reading(at: 100.5).subframe, 0.5, accuracy: 1e-6)
    }

    func testPulldownJamRunsSlow() {
        // 23.976 counts 24,000 frames in 1,001 seconds.
        let jam = JamReference(frameIndex: 0, rate: .fps23_976, monotonic: 0, wallClock: Date(), origin: .manual)
        let clock = TimecodeClock(source: .jam, rate: .fps23_976, jam: jam)
        XCTAssertEqual(clock.reading(at: 1_001 + 1e-6).timecode.frameIndex, 24_000)
    }

    func testJamShownAtAnotherRate() {
        let jam = JamReference(frameIndex: 0, rate: .fps25, monotonic: 0, wallClock: Date(), origin: .ltc)
        let clock = TimecodeClock(source: .jam, rate: .fps50, jam: jam)
        // Half a second at 25 fps is frame 12.5 — frame 25 at 50 fps.
        XCTAssertEqual(clock.reading(at: 0.5).timecode.description, "00:00:00:25")
    }

    func testTimeOfDayMatchesTheWallClock() throws {
        var components = DateComponents()
        components.calendar = Calendar.current
        components.timeZone = TimeZone.current
        components.year = 2026; components.month = 10; components.day = 8
        components.hour = 10; components.minute = 20; components.second = 30
        let date = try XCTUnwrap(components.date).addingTimeInterval(0.5)

        XCTAssertEqual(TimecodeClock.timeOfDay(date, rate: .fps25).timecode.description, "10:20:30:12")
        XCTAssertEqual(TimecodeClock.timeOfDay(date, rate: .fps24).timecode.description, "10:20:30:12")
        // Non-drop pulldown still reads the clock on the wall.
        XCTAssertEqual(TimecodeClock.timeOfDay(date, rate: .fps23_976).timecode.description, "10:20:30:12")
    }

    func testTimeOfDaySourceIgnoresAJam() {
        let jam = JamReference(frameIndex: 0, rate: .fps25, monotonic: 0, wallClock: Date(), origin: .manual)
        let clock = TimecodeClock(source: .timeOfDay, rate: .fps25, jam: jam)
        let now = Date()
        XCTAssertEqual(
            clock.reading(at: 0, wallClock: now).timecode,
            TimecodeClock.timeOfDay(now, rate: .fps25).timecode
        )
    }
}
