import Foundation
import Darwin

/// Seconds on a clock that never jumps and keeps counting while the device
/// sleeps.
///
/// `mach_continuous_time` rather than `CACurrentMediaTime` (which pauses during
/// sleep) or `Date` (which NTP can step): a jammed slate that sat locked in a
/// case over lunch must still be on time when it comes out.
enum MonotonicClock {

    private static let timebase: Double = {
        var info = mach_timebase_info_data_t()
        mach_timebase_info(&info)
        return Double(info.numer) / Double(info.denom) / 1_000_000_000
    }()

    static func now() -> Double {
        Double(mach_continuous_time()) * timebase
    }

    /// Converts a host time from Core Audio (`mach_absolute_time` ticks, which
    /// stop during sleep) onto this clock.
    static func fromHostTime(_ hostTime: UInt64) -> Double {
        let absoluteNow = Double(mach_absolute_time()) * timebase
        let continuousNow = Double(mach_continuous_time()) * timebase
        return Double(hostTime) * timebase + (continuousNow - absoluteNow)
    }
}

/// Where the slate's running timecode comes from.
enum TimecodeSource: String, Codable, CaseIterable, Identifiable, Sendable {
    /// The device clock, which iOS keeps on network time.
    case timeOfDay
    /// Free-running from a jam — typed in, or taken from an LTC feed.
    case jam
    /// Following an LTC signal on the audio input; free-runs if it drops out.
    case ltc

    var id: String { rawValue }

    var label: String {
        switch self {
        case .timeOfDay: return "Time of day"
        case .jam:       return "Jam"
        case .ltc:       return "LTC input"
        }
    }

    var shortLabel: String {
        switch self {
        case .timeOfDay: return "TOD"
        case .jam:       return "JAM"
        case .ltc:       return "LTC"
        }
    }
}

/// A fixed point that free-running timecode counts from.
struct JamReference: Codable, Equatable, Sendable {

    enum Origin: String, Codable, Sendable {
        case manual, ltc, timeOfDay
    }

    /// Fractional frame count at the reference instant, at `rate`.
    var frameIndex: Double
    var rate: FrameRate
    /// The instant on `MonotonicClock`.
    var monotonic: Double
    /// The same instant on the wall clock — lets a jam survive a relaunch,
    /// and spots a reboot (which resets the monotonic clock).
    var wallClock: Date
    var origin: Origin

    /// Re-derives the monotonic anchor if the device has rebooted since the
    /// jam. The wall clock is the only thing that survives a reboot, so that
    /// becomes the bridge — accurate to network time rather than to the frame,
    /// which is why the UI recommends a fresh jam after one.
    func restored() -> JamReference {
        let monotonicElapsed = MonotonicClock.now() - monotonic
        let wallElapsed = Date().timeIntervalSince(wallClock)
        guard monotonicElapsed < 0 || abs(monotonicElapsed - wallElapsed) > 2 else { return self }
        var copy = self
        copy.monotonic = MonotonicClock.now() - wallElapsed
        return copy
    }

    /// How long this jam has been free-running.
    var age: TimeInterval { max(0, MonotonicClock.now() - monotonic) }
}

/// A running timecode reading: the label plus how far into it we are.
struct TimecodeReading: Equatable, Sendable {
    var timecode: Timecode
    /// 0..<1 — position within the current frame.
    var subframe: Double
}

/// Turns "now" into timecode.
///
/// A value type so the board can compute a reading on every display refresh
/// inside a `TimelineView` without touching any observable state.
struct TimecodeClock: Equatable, Sendable {

    var source: TimecodeSource
    /// The rate shown on the board.
    var rate: FrameRate
    var jam: JamReference?

    /// The reading at an instant on `MonotonicClock` (defaults to now).
    func reading(at monotonic: Double = MonotonicClock.now(), wallClock: Date = Date()) -> TimecodeReading {
        if source != .timeOfDay, let jam {
            let elapsed = monotonic - jam.monotonic
            let index = jam.frameIndex + elapsed * jam.rate.actual
            return Self.reading(forIndex: index, at: jam.rate, displayedAt: rate)
        }
        return Self.timeOfDay(wallClock, rate: rate)
    }

    /// The device clock as timecode.
    ///
    /// Labels track the clock: non-drop rates count `nominal` labels a second
    /// (so 23.976 reads the same as the clock on the wall rather than slipping
    /// 3.6 seconds an hour), and drop-frame counts real frames, which is what
    /// drop-frame exists for.
    static func timeOfDay(_ date: Date, rate: FrameRate) -> TimecodeReading {
        let offset = Double(TimeZone.current.secondsFromGMT(for: date))
        var secondsOfDay = (date.timeIntervalSince1970 + offset).truncatingRemainder(dividingBy: 86_400)
        if secondsOfDay < 0 { secondsOfDay += 86_400 }
        let labelRate = rate.isDropFrame ? rate.actual : Double(rate.nominal)
        return reading(forIndex: secondsOfDay * labelRate, at: rate, displayedAt: rate)
    }

    /// The fractional frame count a jam should start from, for a reading
    /// taken from this clock — used when jamming to time of day so the board
    /// doesn't visibly jump.
    static func frameIndex(of reading: TimecodeReading) -> Double {
        Double(reading.timecode.frameIndex) + reading.subframe
    }

    private static func reading(forIndex index: Double, at sourceRate: FrameRate, displayedAt displayRate: FrameRate) -> TimecodeReading {
        let whole = index.rounded(.down)
        let subframe = index - whole
        let label = Timecode(frameIndex: Int(whole), rate: sourceRate)
        guard sourceRate != displayRate else {
            return TimecodeReading(timecode: label, subframe: subframe)
        }
        // A jam taken at one rate shown at another: keep the moment, rescale
        // the frames (25 fps LTC on a 50 fps board, for instance).
        let converted = label.converted(to: displayRate, subframe: subframe)
        let position = (Double(label.frames) + subframe) / Double(sourceRate.nominal) * Double(displayRate.nominal)
        return TimecodeReading(timecode: converted, subframe: position - position.rounded(.down))
    }
}
