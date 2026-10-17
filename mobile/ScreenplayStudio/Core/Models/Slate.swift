import Foundation

/// The state of a digital clapperboard.
///
/// Modelled on a production slate: the marks a camera assistant writes on the
/// board, the ones that change every take, and the timecode settings a smart
/// slate carries. Decoding tolerates missing keys, so a board saved by an
/// older build restores rather than resetting.
struct SlateState: Codable, Equatable {

    // Fixed for the shoot
    var production: String = ""
    var director: String = ""
    var camera: String = ""
    /// Which camera this board is slating — A, B, C on a multicam day.
    var cameraUnit: String = "A"

    // Changes through the day
    var roll: String = "A001"
    var scene: String = "1"
    /// The setup within the scene — "A" in 12A.
    var shot: String = ""
    var take: Int = 1

    // Conditions
    var isInterior = true
    var isDay = true
    /// Shot without sync sound — the sticks stay closed for this on set.
    var isMOS = false
    /// The next mark is a tail slate: board upside down, at the end of the take.
    var isTail = false

    /// The shot this slate is currently marking, if it came from the shot list.
    var linkedShotID: String?
    var linkedSceneID: String?

    // Timecode
    var frameRate: FrameRate = .regionalDefault
    var timecodeSource: TimecodeSource = .timeOfDay
    var jam: JamReference?

    // Behaviour
    /// How long the board holds the clap frame before running again.
    var holdSeconds: Double = 1.5
    var flashOnClap = true
    var maxBrightness = true
    var autoAdvanceTake = true
    var logToCameraReport = true

    init() {}

    var slugLine: String {
        "\(isInterior ? "INT" : "EXT") · \(isDay ? "DAY" : "NIGHT")"
    }

    /// "12A" — scene and setup as written on the board.
    var sceneAndShot: String {
        scene + shot
    }

    /// How a slate is read aloud: "Scene 12A, take 3".
    var spokenIdentifier: String {
        "Roll \(roll), scene \(sceneAndShot), take \(take)"
    }

    var clock: TimecodeClock {
        TimecodeClock(source: timecodeSource, rate: frameRate, jam: jam)
    }

    // MARK: - Lenient decoding

    private enum CodingKeys: String, CodingKey {
        case production, director, camera, cameraUnit, roll, scene, shot, take
        case isInterior, isDay, isMOS, isTail, linkedShotID, linkedSceneID
        case frameRate, timecodeSource, jam
        case holdSeconds, flashOnClap, maxBrightness, autoAdvanceTake, logToCameraReport
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func value<T: Decodable>(_ key: CodingKeys, _ fallback: T) -> T {
            (try? c.decodeIfPresent(T.self, forKey: key)) ?? fallback
        }
        let defaults = SlateState()
        production = value(.production, defaults.production)
        director = value(.director, defaults.director)
        camera = value(.camera, defaults.camera)
        cameraUnit = value(.cameraUnit, defaults.cameraUnit)
        roll = value(.roll, defaults.roll)
        scene = value(.scene, defaults.scene)
        shot = value(.shot, defaults.shot)
        take = value(.take, defaults.take)
        isInterior = value(.isInterior, defaults.isInterior)
        isDay = value(.isDay, defaults.isDay)
        isMOS = value(.isMOS, defaults.isMOS)
        isTail = value(.isTail, defaults.isTail)
        linkedShotID = try? c.decodeIfPresent(String.self, forKey: .linkedShotID)
        linkedSceneID = try? c.decodeIfPresent(String.self, forKey: .linkedSceneID)
        frameRate = value(.frameRate, defaults.frameRate)
        timecodeSource = value(.timecodeSource, defaults.timecodeSource)
        jam = (try? c.decodeIfPresent(JamReference.self, forKey: .jam))?.restored()
        holdSeconds = value(.holdSeconds, defaults.holdSeconds)
        flashOnClap = value(.flashOnClap, defaults.flashOnClap)
        maxBrightness = value(.maxBrightness, defaults.maxBrightness)
        autoAdvanceTake = value(.autoAdvanceTake, defaults.autoAdvanceTake)
        logToCameraReport = value(.logToCameraReport, defaults.logToCameraReport)
    }
}

extension FrameRate {
    /// 23.976 where television grew up on NTSC, 25 everywhere else — what a
    /// camera ships set to in that market.
    static var regionalDefault: FrameRate {
        let ntsc: Set<String> = ["US", "CA", "MX", "JP", "KR", "TW", "PH", "BR", "CO", "PE", "CL", "EC", "VE", "BO", "GT", "HN", "SV", "NI", "CR", "PA", "DO", "PR", "CU"]
        let region = Locale.current.region?.identifier ?? "US"
        return ntsc.contains(region) ? .fps23_976 : .fps25
    }
}

/// A take that was actually marked, kept so the slate has a history and the
/// camera report has something to be built from.
struct SlateTake: Codable, Identifiable, Equatable {
    let id: UUID
    let markedAt: Date
    var roll: String
    var scene: String
    var shot: String
    var take: Int
    var cameraUnit: String
    /// The frame the sticks closed on, as written on the board.
    var timecode: String?
    var frameRate: FrameRate?
    var timecodeSource: TimecodeSource?
    var isInterior: Bool
    var isDay: Bool
    var isMOS: Bool
    var isTail: Bool
    var isCircled: Bool
    var note: String?
    /// The shot-list row this take was counted against.
    var shotID: String?

    init(
        id: UUID = UUID(),
        markedAt: Date = Date(),
        state: SlateState,
        timecode: Timecode?
    ) {
        self.id = id
        self.markedAt = markedAt
        roll = state.roll
        scene = state.scene
        shot = state.shot
        take = state.take
        cameraUnit = state.cameraUnit
        self.timecode = timecode?.description
        frameRate = timecode?.rate
        timecodeSource = state.timecodeSource
        isInterior = state.isInterior
        isDay = state.isDay
        isMOS = state.isMOS
        isTail = state.isTail
        isCircled = false
        note = nil
        shotID = state.linkedShotID
    }

    private enum CodingKeys: String, CodingKey {
        case id, markedAt, roll, scene, shot, take, cameraUnit, timecode, frameRate, timecodeSource
        case isInterior, isDay, isMOS, isTail, isCircled, note, shotID
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        markedAt = try c.decode(Date.self, forKey: .markedAt)
        roll = try c.decodeIfPresent(String.self, forKey: .roll) ?? ""
        scene = try c.decodeIfPresent(String.self, forKey: .scene) ?? ""
        shot = try c.decodeIfPresent(String.self, forKey: .shot) ?? ""
        take = try c.decodeIfPresent(Int.self, forKey: .take) ?? 1
        cameraUnit = try c.decodeIfPresent(String.self, forKey: .cameraUnit) ?? "A"
        timecode = try c.decodeIfPresent(String.self, forKey: .timecode)
        frameRate = try? c.decodeIfPresent(FrameRate.self, forKey: .frameRate)
        timecodeSource = try? c.decodeIfPresent(TimecodeSource.self, forKey: .timecodeSource)
        isInterior = try c.decodeIfPresent(Bool.self, forKey: .isInterior) ?? true
        isDay = try c.decodeIfPresent(Bool.self, forKey: .isDay) ?? true
        isMOS = try c.decodeIfPresent(Bool.self, forKey: .isMOS) ?? false
        isTail = try c.decodeIfPresent(Bool.self, forKey: .isTail) ?? false
        isCircled = try c.decodeIfPresent(Bool.self, forKey: .isCircled) ?? false
        note = try c.decodeIfPresent(String.self, forKey: .note)
        shotID = try c.decodeIfPresent(String.self, forKey: .shotID)
    }

    var timeLabel: String {
        Self.timeFormatter.string(from: markedAt)
    }

    /// "A001 / 12A / 3" — roll, scene, take.
    var label: String { "\(roll) / \(scene)\(shot) / \(take)" }

    /// The local calendar day the take belongs to, as Postgres writes a DATE.
    var reportDate: String { Self.dayFormatter.string(from: markedAt) }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter
    }()

    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
