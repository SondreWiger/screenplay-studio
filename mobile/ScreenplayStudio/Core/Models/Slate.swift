import Foundation

/// The state of a digital clapperboard.
///
/// Modelled on a standard production slate: the identifying marks a camera
/// assistant writes on the board, plus the three that change every take.
struct SlateState: Codable, Equatable {

    // Fixed for the shoot
    var production: String = ""
    var director: String = ""
    var camera: String = ""

    // Changes through the day
    var roll: String = "A001"
    var scene: String = "1"
    var take: Int = 1

    // Conditions
    var isInterior = true
    var isDay = true
    /// Shot without sync sound — the board is held upside down for this on set.
    var isMOS = false

    /// The shot this slate is currently marking, if it came from the shot list.
    var linkedShotID: String?
    var linkedSceneID: String?

    var slugLine: String {
        "\(isInterior ? "INT" : "EXT") · \(isDay ? "DAY" : "NIGHT")"
    }

    /// "A001 / 12 / 3" — how a slate is read aloud.
    var spokenIdentifier: String {
        "Roll \(roll), scene \(scene), take \(take)"
    }
}

/// A take that was actually marked, kept so the slate has a history.
struct SlateTake: Codable, Identifiable, Equatable {
    let id: UUID
    let markedAt: Date
    let roll: String
    let scene: String
    let take: Int
    let isMOS: Bool
    var isCircled: Bool
    var note: String?

    init(
        id: UUID = UUID(),
        markedAt: Date = Date(),
        roll: String,
        scene: String,
        take: Int,
        isMOS: Bool,
        isCircled: Bool = false,
        note: String? = nil
    ) {
        self.id = id
        self.markedAt = markedAt
        self.roll = roll
        self.scene = scene
        self.take = take
        self.isMOS = isMOS
        self.isCircled = isCircled
        self.note = note
    }

    var timeLabel: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: markedAt)
    }

    var label: String { "\(roll) / \(scene) / \(take)" }
}
