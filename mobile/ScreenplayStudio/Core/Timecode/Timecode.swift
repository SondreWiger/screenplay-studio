import Foundation

/// The SMPTE frame rates a production actually shoots at.
///
/// Raw values are what gets persisted and exported, so they are written the
/// way a camera menu or a sound report writes them.
enum FrameRate: String, Codable, CaseIterable, Identifiable, Sendable {
    case fps23_976 = "23.976"
    case fps24 = "24"
    case fps25 = "25"
    case fps29_97DF = "29.97DF"
    case fps29_97 = "29.97"
    case fps30 = "30"
    case fps48 = "48"
    case fps50 = "50"
    case fps59_94DF = "59.94DF"
    case fps59_94 = "59.94"
    case fps60 = "60"

    var id: String { rawValue }

    /// Frame labels per timecode second — what the frames field counts to.
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

    var isDropFrame: Bool { self == .fps29_97DF || self == .fps59_94DF }

    /// NTSC-family rates run at 1000/1001 of their nominal speed.
    var isPulldown: Bool {
        switch self {
        case .fps23_976, .fps29_97DF, .fps29_97, .fps59_94DF, .fps59_94: return true
        default: return false
        }
    }

    /// Real frames per second.
    var actual: Double {
        isPulldown ? Double(nominal) * 1000 / 1001 : Double(nominal)
    }

    /// Labels skipped at the top of every minute except each tenth.
    var dropCount: Int { isDropFrame ? nominal / 15 : 0 }

    var framesPerMinute: Int { nominal * 60 - dropCount }

    var framesPerTenMinutes: Int { nominal * 600 - dropCount * 9 }

    /// Distinct labels in 24 hours, after which timecode wraps to midnight.
    var framesPerDay: Int { framesPerTenMinutes * 144 }

    var label: String {
        switch self {
        case .fps23_976:  return "23.976"
        case .fps24:      return "24"
        case .fps25:      return "25"
        case .fps29_97DF: return "29.97 DF"
        case .fps29_97:   return "29.97 NDF"
        case .fps30:      return "30"
        case .fps48:      return "48"
        case .fps50:      return "50"
        case .fps59_94DF: return "59.94 DF"
        case .fps59_94:   return "59.94 NDF"
        case .fps60:      return "60"
        }
    }

    /// The closest rate in the 23.976–30 range that LTC is transmitted at.
    /// High-frame-rate productions carry half-rate LTC.
    static func ltcRate(nominal: Int, isPulldown: Bool, isDropFrame: Bool) -> FrameRate? {
        switch (nominal, isPulldown, isDropFrame) {
        case (24, true, _):      return .fps23_976
        case (24, false, _):     return .fps24
        case (25, _, _):         return .fps25
        case (30, _, true):      return .fps29_97DF
        case (30, true, false):  return .fps29_97
        case (30, false, false): return .fps30
        default:                 return nil
        }
    }
}

/// A SMPTE timecode label: hours, minutes, seconds and frames at a given rate.
///
/// Converting between a label and a running frame count is where drop-frame
/// gets everyone: 29.97 DF skips labels ;00 and ;01 at the start of every
/// minute except minutes divisible by ten, so the count and the label drift
/// apart by 18 frames every ten minutes. All of that lives here.
struct Timecode: Equatable, Hashable, Codable, Sendable, CustomStringConvertible {

    var hours: Int
    var minutes: Int
    var seconds: Int
    var frames: Int
    var rate: FrameRate

    init(hours: Int, minutes: Int, seconds: Int, frames: Int, rate: FrameRate) {
        self.hours = hours
        self.minutes = minutes
        self.seconds = seconds
        self.frames = frames
        self.rate = rate
    }

    /// The label for a frame count since 00:00:00:00, wrapping at 24 hours.
    init(frameIndex: Int, rate: FrameRate) {
        let perDay = rate.framesPerDay
        var index = frameIndex % perDay
        if index < 0 { index += perDay }

        if rate.isDropFrame {
            let drop = rate.dropCount
            let tens = index / rate.framesPerTenMinutes
            let remainder = index % rate.framesPerTenMinutes
            index += drop * 9 * tens
            if remainder > drop {
                index += drop * ((remainder - drop) / rate.framesPerMinute)
            }
        }

        let nominal = rate.nominal
        self.rate = rate
        frames = index % nominal
        seconds = (index / nominal) % 60
        minutes = (index / (nominal * 60)) % 60
        hours = (index / (nominal * 3600)) % 24
    }

    /// Frames since 00:00:00:00.
    var frameIndex: Int {
        let nominal = rate.nominal
        let labels = ((hours * 60 + minutes) * 60 + seconds) * nominal + frames
        guard rate.isDropFrame else { return labels }
        let totalMinutes = hours * 60 + minutes
        return labels - rate.dropCount * (totalMinutes - totalMinutes / 10)
    }

    /// False for labels that cannot exist — frames past the rate, or one of the
    /// labels drop-frame skips.
    var isValid: Bool {
        guard (0..<24).contains(hours), (0..<60).contains(minutes),
              (0..<60).contains(seconds), (0..<rate.nominal).contains(frames) else { return false }
        if rate.isDropFrame, seconds == 0, minutes % 10 != 0, frames < rate.dropCount {
            return false
        }
        return true
    }

    /// `HH:MM:SS:FF`, or `HH:MM:SS;FF` for drop-frame — the separator is how
    /// everyone on set tells the two apart at a glance.
    var description: String {
        String(format: "%02d:%02d:%02d%@%02d", hours, minutes, seconds, rate.isDropFrame ? ";" : ":", frames)
    }

    /// Eight digits with no separators, for the segment display.
    var digits: String {
        String(format: "%02d%02d%02d%02d", hours, minutes, seconds, frames)
    }

    /// Parses `10:00:00:00`, `10:00:00;00`, `10.00.00.00` or bare digits
    /// (`1000000` reads as 01:00:00:00). Drop-frame labels that don't exist are
    /// rounded forward to the first one that does.
    static func parse(_ string: String, rate: FrameRate) -> Timecode? {
        let digits = string.filter(\.isNumber)
        guard !digits.isEmpty, digits.count <= 8 else { return nil }
        let padded = String(repeating: "0", count: 8 - digits.count) + digits
        let values = stride(from: 0, to: 8, by: 2).map { offset -> Int in
            let start = padded.index(padded.startIndex, offsetBy: offset)
            return Int(padded[start..<padded.index(start, offsetBy: 2)]) ?? 0
        }
        var timecode = Timecode(hours: values[0], minutes: values[1], seconds: values[2], frames: values[3], rate: rate)
        if rate.isDropFrame, timecode.seconds == 0, timecode.minutes % 10 != 0, timecode.frames < rate.dropCount {
            timecode.frames = rate.dropCount
        }
        return timecode.isValid ? timecode : nil
    }

    /// The same moment expressed at another rate: hours, minutes and seconds
    /// carry over, frames are rescaled by their position within the second.
    func converted(to target: FrameRate, subframe: Double = 0) -> Timecode {
        guard target != rate else { return self }
        let position = (Double(frames) + subframe) / Double(rate.nominal)
        var converted = Timecode(
            hours: hours,
            minutes: minutes,
            seconds: seconds,
            frames: min(target.nominal - 1, Int((position * Double(target.nominal)).rounded(.down))),
            rate: target
        )
        if target.isDropFrame, converted.seconds == 0, converted.minutes % 10 != 0,
           converted.frames < target.dropCount {
            converted.frames = target.dropCount
        }
        return converted
    }
}
