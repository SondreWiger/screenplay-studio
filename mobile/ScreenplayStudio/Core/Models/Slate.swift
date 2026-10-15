import Foundation

/// What a take records.
enum TakeKind: String, Codable, CaseIterable, Identifiable {
    /// Picture and sync sound — the sticks are clapped.
    case sync
    /// Picture only ("mit out sound") — no clap; sticks held closed.
    case mos
    /// Sound only — no camera.
    case wild
    /// A pickup of part of a take.
    case pickup

    var id: String { rawValue }

    /// The word on the board and in the camera report.
    var label: String {
        switch self {
        case .sync:   return "SYNC"
        case .mos:    return "MOS"
        case .wild:   return "WILD"
        case .pickup: return "PICKUP"
        }
    }

    var hasCamera: Bool { self != .wild }
    var hasSound: Bool { self != .mos }
}

/// How a take turned out.
enum TakeRating: String, Codable, CaseIterable, Identifiable {
    case none, circled, good, ng, falseStart

    var id: String { rawValue }

    var label: String {
        switch self {
        case .none:       return "Unrated"
        case .circled:    return "Circled"
        case .good:       return "Good"
        case .ng:         return "NG"
        case .falseStart: return "False start"
        }
    }

    var symbol: String {
        switch self {
        case .none:       return "circle.dashed"
        case .circled:    return "circle.circle.fill"
        case .good:       return "hand.thumbsup.fill"
        case .ng:         return "xmark.circle.fill"
        case .falseStart: return "arrow.uturn.backward.circle"
        }
    }
}

/// The state of a digital clapperboard: the marks that stay the same all day,
/// the ones that change every take, and how the slate itself is set up.
///
/// Decoding is lenient — every field has a default — so a board saved by an
/// earlier version of the app still opens.
struct SlateState: Codable, Equatable {

    // Fixed for the shoot
    var production: String = ""
    var director: String = ""
    /// Director of photography / operator, as written on the board.
    var camera: String = ""
    /// Which camera this slate is for: "A", "B"…
    var cameraLetter: String = "A"
    var frameRate: FrameRate = .default

    // Changes through the day
    var roll: String = "A001"
    var soundRoll: String = "S001"
    var scene: String = "1"
    /// The setup / shot within the scene ("A", "B", or the shot number).
    var setup: String = ""
    var take: Int = 1
    var kind: TakeKind = .sync
    var isInterior = true
    var isDay = true
    var lens: String = ""

    /// The shot and scene this slate is marking, when it came from the lists.
    var linkedShotID: String?
    var linkedSceneID: String?

    // Sync behaviour
    var beepEnabled = true
    var flashEnabled = true
    /// Moves the beep relative to the flash, to calibrate this device (ms;
    /// positive = beep later).
    var syncOffsetMs: Int = 0
    var ltcOutputEnabled = false
    /// The last jam from a recorder (LTC or typed). Time-of-day jams aren't
    /// kept — they're redone from the clock on every launch.
    var jam: TimecodeJam?

    init() {}

    var slugLine: String {
        "\(isInterior ? "INT" : "EXT") · \(isDay ? "DAY" : "NIGHT")"
    }

    /// "12A" — scene and setup as written on the board.
    var sceneAndSetup: String {
        setup.isEmpty ? scene : "\(scene)\(setup.first?.isNumber == true && scene.last?.isNumber == true ? "-" : "")\(setup)"
    }

    /// How a slate is read aloud.
    var spokenIdentifier: String {
        var parts = ["Scene \(scene)"]
        if !setup.isEmpty { parts.append(setup) }
        parts.append("take \(take)")
        if kind == .mos { parts.append("M.O.S.") }
        return parts.joined(separator: " ")
    }

    enum CodingKeys: String, CodingKey {
        case production, director, camera, cameraLetter, frameRate, roll, soundRoll, scene, setup, take
        case kind, isInterior, isDay, lens, linkedShotID, linkedSceneID
        case beepEnabled, flashEnabled, syncOffsetMs, ltcOutputEnabled, jam
        case isMOS // written by the first version
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        production = try c.decodeIfPresent(String.self, forKey: .production) ?? ""
        director = try c.decodeIfPresent(String.self, forKey: .director) ?? ""
        camera = try c.decodeIfPresent(String.self, forKey: .camera) ?? ""
        cameraLetter = try c.decodeIfPresent(String.self, forKey: .cameraLetter) ?? "A"
        frameRate = (try? c.decodeIfPresent(FrameRate.self, forKey: .frameRate)) ?? .default
        roll = try c.decodeIfPresent(String.self, forKey: .roll) ?? "A001"
        soundRoll = try c.decodeIfPresent(String.self, forKey: .soundRoll) ?? "S001"
        scene = try c.decodeIfPresent(String.self, forKey: .scene) ?? "1"
        setup = try c.decodeIfPresent(String.self, forKey: .setup) ?? ""
        take = try c.decodeIfPresent(Int.self, forKey: .take) ?? 1
        if let kind = try? c.decodeIfPresent(TakeKind.self, forKey: .kind) {
            self.kind = kind
        } else {
            kind = (try c.decodeIfPresent(Bool.self, forKey: .isMOS) ?? false) ? .mos : .sync
        }
        isInterior = try c.decodeIfPresent(Bool.self, forKey: .isInterior) ?? true
        isDay = try c.decodeIfPresent(Bool.self, forKey: .isDay) ?? true
        lens = try c.decodeIfPresent(String.self, forKey: .lens) ?? ""
        linkedShotID = try c.decodeIfPresent(String.self, forKey: .linkedShotID)
        linkedSceneID = try c.decodeIfPresent(String.self, forKey: .linkedSceneID)
        beepEnabled = try c.decodeIfPresent(Bool.self, forKey: .beepEnabled) ?? true
        flashEnabled = try c.decodeIfPresent(Bool.self, forKey: .flashEnabled) ?? true
        syncOffsetMs = try c.decodeIfPresent(Int.self, forKey: .syncOffsetMs) ?? 0
        ltcOutputEnabled = try c.decodeIfPresent(Bool.self, forKey: .ltcOutputEnabled) ?? false
        jam = try? c.decodeIfPresent(TimecodeJam.self, forKey: .jam)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(production, forKey: .production)
        try c.encode(director, forKey: .director)
        try c.encode(camera, forKey: .camera)
        try c.encode(cameraLetter, forKey: .cameraLetter)
        try c.encode(frameRate, forKey: .frameRate)
        try c.encode(roll, forKey: .roll)
        try c.encode(soundRoll, forKey: .soundRoll)
        try c.encode(scene, forKey: .scene)
        try c.encode(setup, forKey: .setup)
        try c.encode(take, forKey: .take)
        try c.encode(kind, forKey: .kind)
        try c.encode(isInterior, forKey: .isInterior)
        try c.encode(isDay, forKey: .isDay)
        try c.encode(lens, forKey: .lens)
        try c.encodeIfPresent(linkedShotID, forKey: .linkedShotID)
        try c.encodeIfPresent(linkedSceneID, forKey: .linkedSceneID)
        try c.encode(beepEnabled, forKey: .beepEnabled)
        try c.encode(flashEnabled, forKey: .flashEnabled)
        try c.encode(syncOffsetMs, forKey: .syncOffsetMs)
        try c.encode(ltcOutputEnabled, forKey: .ltcOutputEnabled)
        try c.encodeIfPresent(jam, forKey: .jam)
    }
}

/// A take that was slated: the production record of one go at a shot.
struct SlateTake: Codable, Identifiable, Equatable {
    let id: UUID
    var markedAt: Date
    /// Timecode at the clap (the flash frame), e.g. "14:02:11:05".
    var timecode: String?
    /// Timecode at a tail slate, if the take was end-boarded.
    var tailTimecode: String?
    var cutAt: Date?
    var frameRate: String

    var roll: String
    var soundRoll: String
    var cameraLetter: String
    var scene: String
    var setup: String
    var take: Int
    var kind: TakeKind
    var isTailSlate: Bool
    var rating: TakeRating
    var note: String?
    var lens: String?
    var isInterior: Bool
    var isDay: Bool

    var shotID: String?
    var sceneID: String?

    init(
        id: UUID = UUID(),
        markedAt: Date = Date(),
        timecode: String? = nil,
        state: SlateState
    ) {
        self.id = id
        self.markedAt = markedAt
        self.timecode = timecode
        self.tailTimecode = nil
        self.cutAt = nil
        self.frameRate = state.frameRate.rawValue
        self.roll = state.roll
        self.soundRoll = state.soundRoll
        self.cameraLetter = state.cameraLetter
        self.scene = state.scene
        self.setup = state.setup
        self.take = state.take
        self.kind = state.kind
        self.isTailSlate = false
        self.rating = .none
        self.note = nil
        self.lens = state.lens.nonEmpty
        self.isInterior = state.isInterior
        self.isDay = state.isDay
        self.shotID = state.linkedShotID
        self.sceneID = state.linkedSceneID
    }

    /// "12A / 3" — scene, setup and take, the way it's logged.
    var label: String {
        let sceneSetup = setup.isEmpty ? scene : "\(scene)\(setup.first?.isNumber == true ? "-" : "")\(setup)"
        return "\(sceneSetup) / \(take)"
    }

    var timeLabel: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: markedAt)
    }

    /// Seconds from the clap to "cut", when both are known.
    var duration: TimeInterval? {
        cutAt.map { $0.timeIntervalSince(markedAt) }
    }

    /// Day the take belongs to, as reports file it.
    var reportDate: String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: markedAt)
    }

    // MARK: - Lenient decoding (takes saved by the first version)

    enum CodingKeys: String, CodingKey {
        case id, markedAt, timecode, tailTimecode, cutAt, frameRate, roll, soundRoll, cameraLetter
        case scene, setup, take, kind, isTailSlate, rating, note, lens, isInterior, isDay, shotID, sceneID
        case isMOS, isCircled
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        markedAt = try c.decodeIfPresent(Date.self, forKey: .markedAt) ?? Date()
        timecode = try c.decodeIfPresent(String.self, forKey: .timecode)
        tailTimecode = try c.decodeIfPresent(String.self, forKey: .tailTimecode)
        cutAt = try c.decodeIfPresent(Date.self, forKey: .cutAt)
        frameRate = try c.decodeIfPresent(String.self, forKey: .frameRate) ?? FrameRate.default.rawValue
        roll = try c.decodeIfPresent(String.self, forKey: .roll) ?? ""
        soundRoll = try c.decodeIfPresent(String.self, forKey: .soundRoll) ?? ""
        cameraLetter = try c.decodeIfPresent(String.self, forKey: .cameraLetter) ?? "A"
        scene = try c.decodeIfPresent(String.self, forKey: .scene) ?? ""
        setup = try c.decodeIfPresent(String.self, forKey: .setup) ?? ""
        take = try c.decodeIfPresent(Int.self, forKey: .take) ?? 1
        if let kind = try? c.decodeIfPresent(TakeKind.self, forKey: .kind) {
            self.kind = kind
        } else {
            kind = (try c.decodeIfPresent(Bool.self, forKey: .isMOS) ?? false) ? .mos : .sync
        }
        isTailSlate = try c.decodeIfPresent(Bool.self, forKey: .isTailSlate) ?? false
        if let rating = try? c.decodeIfPresent(TakeRating.self, forKey: .rating) {
            self.rating = rating
        } else {
            rating = (try c.decodeIfPresent(Bool.self, forKey: .isCircled) ?? false) ? .circled : .none
        }
        note = try c.decodeIfPresent(String.self, forKey: .note)
        lens = try c.decodeIfPresent(String.self, forKey: .lens)
        isInterior = try c.decodeIfPresent(Bool.self, forKey: .isInterior) ?? true
        isDay = try c.decodeIfPresent(Bool.self, forKey: .isDay) ?? true
        shotID = try c.decodeIfPresent(String.self, forKey: .shotID)
        sceneID = try c.decodeIfPresent(String.self, forKey: .sceneID)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(markedAt, forKey: .markedAt)
        try c.encodeIfPresent(timecode, forKey: .timecode)
        try c.encodeIfPresent(tailTimecode, forKey: .tailTimecode)
        try c.encodeIfPresent(cutAt, forKey: .cutAt)
        try c.encode(frameRate, forKey: .frameRate)
        try c.encode(roll, forKey: .roll)
        try c.encode(soundRoll, forKey: .soundRoll)
        try c.encode(cameraLetter, forKey: .cameraLetter)
        try c.encode(scene, forKey: .scene)
        try c.encode(setup, forKey: .setup)
        try c.encode(take, forKey: .take)
        try c.encode(kind, forKey: .kind)
        try c.encode(isTailSlate, forKey: .isTailSlate)
        try c.encode(rating, forKey: .rating)
        try c.encodeIfPresent(note, forKey: .note)
        try c.encodeIfPresent(lens, forKey: .lens)
        try c.encode(isInterior, forKey: .isInterior)
        try c.encode(isDay, forKey: .isDay)
        try c.encodeIfPresent(shotID, forKey: .shotID)
        try c.encodeIfPresent(sceneID, forKey: .sceneID)
    }
}
