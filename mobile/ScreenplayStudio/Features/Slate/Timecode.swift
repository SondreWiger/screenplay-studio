import Foundation
import QuartzCore

// SMPTE timecode for the slate.
//
// A line-for-line port of `mobile/reference/timecode.ts`, which is what the
// tests in `tests/slate-timecode.test.ts` exercise. Change both together.

/// The production's frame rate. Set once per project, in Slate setup.
enum FrameRate: String, CaseIterable, Identifiable, Codable {
    case fps23_976 = "23.976"
    case fps24 = "24"
    case fps25 = "25"
    case fps29_97DF = "29.97df"
    case fps29_97 = "29.97"
    case fps30 = "30"
    case fps48 = "48"
    case fps50 = "50"
    case fps59_94DF = "59.94df"
    case fps59_94 = "59.94"
    case fps60 = "60"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .fps23_976:  return "23.976"
        case .fps24:      return "24"
        case .fps25:      return "25"
        case .fps29_97DF: return "29.97 DF"
        case .fps29_97:   return "29.97 ND"
        case .fps30:      return "30"
        case .fps48:      return "48"
        case .fps50:      return "50"
        case .fps59_94DF: return "59.94 DF"
        case .fps59_94:   return "59.94 ND"
        case .fps60:      return "60"
        }
    }

    /// Frames counted per timecode second.
    var nominal: Int {
        switch self {
        case .fps23_976, .fps24: return 24
        case .fps25: return 25
        case .fps29_97DF, .fps29_97, .fps30: return 30
        case .fps48: return 48
        case .fps50: return 50
        case .fps59_94DF, .fps59_94, .fps60: return 60
        }
    }

    /// Real frames per second.
    var actual: Double {
        switch self {
        case .fps23_976: return 24000.0 / 1001.0
        case .fps29_97DF, .fps29_97: return 30000.0 / 1001.0
        case .fps59_94DF, .fps59_94: return 60000.0 / 1001.0
        default: return Double(nominal)
        }
    }

    var isDropFrame: Bool { self == .fps29_97DF || self == .fps59_94DF }

    /// Frames dropped at each minute start (except every tenth minute).
    var droppedPerMinute: Int { isDropFrame ? Int((Double(nominal) / 15).rounded()) : 0 }

    /// Frame labels in a 24-hour day.
    var framesPerDay: Int {
        let all = nominal * 86_400
        return isDropFrame ? all - droppedPerMinute * (1440 - 144) : all
    }

    /// Integer and drop-frame rates keep step with the wall clock; 23.976 and
    /// the non-drop fractional rates run 0.1% slow and free-run instead.
    var tracksWallClock: Bool { actual.rounded() == actual || isDropFrame }

    /// The camera rate the slate suggests for a new project.
    static let `default`: FrameRate = .fps24
}

struct Timecode: Equatable, Codable, Hashable {
    var hours: Int
    var minutes: Int
    var seconds: Int
    var frames: Int

    static let zero = Timecode(hours: 0, minutes: 0, seconds: 0, frames: 0)

    private static func wrap(_ frames: Int, _ rate: FrameRate) -> Int {
        let day = rate.framesPerDay
        return ((frames % day) + day) % day
    }

    /// A running frame count → the label on the slate.
    init(frameCount: Int, rate: FrameRate) {
        var frames = Timecode.wrap(frameCount, rate)
        let n = rate.nominal
        if rate.isDropFrame {
            let drop = rate.droppedPerMinute
            let per10Min = n * 600 - drop * 9
            let perMin = n * 60 - drop
            let tens = frames / per10Min
            let rest = frames % per10Min
            frames += drop * 9 * tens
            if rest > drop { frames += drop * ((rest - drop) / perMin) }
        }
        self.hours = (frames / (n * 3600)) % 24
        self.minutes = (frames / (n * 60)) % 60
        self.seconds = (frames / n) % 60
        self.frames = frames % n
    }

    init(hours: Int, minutes: Int, seconds: Int, frames: Int) {
        self.hours = hours
        self.minutes = minutes
        self.seconds = seconds
        self.frames = frames
    }

    /// The label on the slate → a running frame count.
    func frameCount(rate: FrameRate) -> Int {
        let n = rate.nominal
        let labelled = ((hours * 60 + minutes) * 60 + seconds) * n + frames
        guard rate.isDropFrame else { return labelled }
        let totalMinutes = hours * 60 + minutes
        return labelled - rate.droppedPerMinute * (totalMinutes - totalMinutes / 10)
    }

    /// "14:02:11:05", or "14:02:11;05" in drop-frame.
    func formatted(_ rate: FrameRate) -> String {
        String(format: "%02d:%02d:%02d%@%02d", hours, minutes, seconds, rate.isDropFrame ? ";" : ":", frames)
    }

    /// Parses what someone types: colons, dots or a semicolon between fields.
    init?(parsing text: String, rate: FrameRate) {
        let parts = text.trimmingCharacters(in: .whitespaces)
            .split(whereSeparator: { $0 == ":" || $0 == "." || $0 == ";" })
            .map(String.init)
        guard parts.count == 4,
              parts.allSatisfy({ (1...2).contains($0.count) && $0.allSatisfy(\.isNumber) }),
              let h = Int(parts[0]), let m = Int(parts[1]), let s = Int(parts[2]), let f = Int(parts[3]),
              h <= 23, m <= 59, s <= 59, f < rate.nominal
        else { return nil }
        // In drop-frame, frames 00 and 01 don't exist at most minute starts.
        if rate.isDropFrame, s == 0, f < rate.droppedPerMinute, m % 10 != 0 { return nil }
        self.init(hours: h, minutes: m, seconds: s, frames: f)
    }
}

/// Where the slate's timecode comes from.
enum TimecodeSource: String, Codable {
    /// The device clock — matches recorders set to time-of-day.
    case timeOfDay
    /// Typed in from a recorder's display.
    case manual
    /// Read from a recorder's LTC output through the audio input.
    case ltc
}

/// The slate's time base.
///
/// `CACurrentMediaTime()` (mach host time) — what audio and display timestamps
/// use — stops while the device sleeps, so a slate that locked its screen for a
/// minute would come back a minute behind. This clock keeps counting through
/// sleep; host-time readings are converted into it at the moment they're used.
enum SlateClock {
    private static let secondsPerTick: Double = {
        var info = mach_timebase_info_data_t()
        mach_timebase_info(&info)
        return Double(info.numer) / Double(info.denom) / 1_000_000_000
    }()

    /// Seconds on a monotonic clock that counts through sleep.
    static func now() -> Double {
        Double(mach_continuous_time()) * secondsPerTick
    }

    /// A host-time reading (seconds, `CACurrentMediaTime` base) on this clock.
    static func fromHostSeconds(_ host: Double) -> Double {
        now() - (CACurrentMediaTime() - host)
    }

    /// A reading on this clock in host-time seconds, for scheduling audio.
    static func toHostSeconds(_ clock: Double) -> Double {
        CACurrentMediaTime() - (now() - clock)
    }
}

/// The slate's clock: a frame count anchored at a moment, advancing at the real
/// frame rate. Jamming moves the anchor; reading it is arithmetic, so it costs
/// nothing to call every display frame.
struct TimecodeJam: Codable, Equatable {
    /// Frame count at `anchorClock`.
    var anchorFrames: Int
    /// `SlateClock.now()` the anchor refers to.
    var anchorClock: Double
    /// The same moment on the wall clock, to re-anchor after a restart (the
    /// monotonic clock starts again from zero when the device reboots).
    var anchorWall: Date
    var source: TimecodeSource
    /// When it was jammed, for "jammed 2 h ago".
    var jammedAt: Date

    func frameCount(at clock: Double, rate: FrameRate) -> Int {
        // A hair of tolerance so a time exactly on a frame boundary lands on it.
        let elapsed = Int(floor((clock - anchorClock) * rate.actual + 1e-6))
        let day = rate.framesPerDay
        return (((anchorFrames + elapsed) % day) + day) % day
    }

    func timecode(at clock: Double, rate: FrameRate) -> Timecode {
        Timecode(frameCount: frameCount(at: clock, rate: rate), rate: rate)
    }

    /// The same jam, re-anchored on this launch's clock through the wall clock.
    func rebased() -> TimecodeJam {
        var copy = self
        copy.anchorClock = SlateClock.now() - Date().timeIntervalSince(anchorWall)
        return copy
    }

    /// Jam to the device clock.
    static func timeOfDay(rate: FrameRate, now: Date = Date(), clock: Double = SlateClock.now()) -> TimecodeJam {
        let calendar = Calendar.current
        let secondsSinceMidnight = now.timeIntervalSince(calendar.startOfDay(for: now))
        if rate.tracksWallClock {
            return TimecodeJam(
                anchorFrames: 0,
                anchorClock: clock - secondsSinceMidnight,
                anchorWall: now.addingTimeInterval(-secondsSinceMidnight),
                source: .timeOfDay,
                jammedAt: now
            )
        }
        let whole = floor(secondsSinceMidnight)
        let frames = Int(whole) * rate.nominal + Int((secondsSinceMidnight - whole) * Double(rate.nominal))
        return TimecodeJam(anchorFrames: frames, anchorClock: clock, anchorWall: now, source: .timeOfDay, jammedAt: now)
    }

    /// Jam to a known timecode at a known moment (typed in, or read from LTC).
    static func jam(to timecode: Timecode, at clock: Double, rate: FrameRate, source: TimecodeSource) -> TimecodeJam {
        let now = Date()
        return TimecodeJam(
            anchorFrames: timecode.frameCount(rate: rate),
            anchorClock: clock,
            anchorWall: now.addingTimeInterval(clock - SlateClock.now()),
            source: source,
            jammedAt: now
        )
    }
}
