import SwiftUI

/// The `script_element_type` enum, plus the extra types later migrations added
/// for audio drama, stage and creator formats.
///
/// Unknown raw values decode into `.other(raw)` rather than throwing, so a
/// screenplay written on the web with a newer element type still opens on the
/// phone — it just renders with default formatting instead of blanking the page.
enum ScriptElementType: Hashable, Codable {

    // Core screenplay
    case sceneHeading
    case action
    case character
    case dialogue
    case parenthetical
    case transition
    case shot
    case note
    case pageBreak
    case titlePage
    case centered
    case lyrics
    case synopsis
    case section

    // Structure
    case act
    case sequence
    case sequenceEnd

    // Audio drama
    case actBreak
    case announcer
    case sfxCue
    case musicCue
    case ambienceCue
    case soundCue

    // Stage / musical
    case songTitle
    case lyric
    case danceDirection
    case musicalCue
    case lightingCue
    case setDirection

    // Anything the database knows about that this build does not.
    case other(String)

    // MARK: - Raw value bridging

    var rawValue: String {
        switch self {
        case .sceneHeading:   return "scene_heading"
        case .action:         return "action"
        case .character:      return "character"
        case .dialogue:       return "dialogue"
        case .parenthetical:  return "parenthetical"
        case .transition:     return "transition"
        case .shot:           return "shot"
        case .note:           return "note"
        case .pageBreak:      return "page_break"
        case .titlePage:      return "title_page"
        case .centered:       return "centered"
        case .lyrics:         return "lyrics"
        case .synopsis:       return "synopsis"
        case .section:        return "section"
        case .act:            return "act"
        case .sequence:       return "sequence"
        case .sequenceEnd:    return "sequence_end"
        case .actBreak:       return "act_break"
        case .announcer:      return "announcer"
        case .sfxCue:         return "sfx_cue"
        case .musicCue:       return "music_cue"
        case .ambienceCue:    return "ambience_cue"
        case .soundCue:       return "sound_cue"
        case .songTitle:      return "song_title"
        case .lyric:          return "lyric"
        case .danceDirection: return "dance_direction"
        case .musicalCue:     return "musical_cue"
        case .lightingCue:    return "lighting_cue"
        case .setDirection:   return "set_direction"
        case .other(let raw): return raw
        }
    }

    init(rawValue: String) {
        switch rawValue {
        case "scene_heading":   self = .sceneHeading
        case "action":          self = .action
        case "character":       self = .character
        case "dialogue":        self = .dialogue
        case "parenthetical":   self = .parenthetical
        case "transition":      self = .transition
        case "shot":            self = .shot
        case "note":            self = .note
        case "page_break":      self = .pageBreak
        case "title_page":      self = .titlePage
        case "centered":        self = .centered
        case "lyrics":          self = .lyrics
        case "synopsis":        self = .synopsis
        case "section":         self = .section
        case "act":             self = .act
        case "sequence":        self = .sequence
        case "sequence_end":    self = .sequenceEnd
        case "act_break":       self = .actBreak
        case "announcer":       self = .announcer
        case "sfx_cue":         self = .sfxCue
        case "music_cue":       self = .musicCue
        case "ambience_cue":    self = .ambienceCue
        case "sound_cue":       self = .soundCue
        case "song_title":      self = .songTitle
        case "lyric":           self = .lyric
        case "dance_direction": self = .danceDirection
        case "musical_cue":     self = .musicalCue
        case "lighting_cue":    self = .lightingCue
        case "set_direction":   self = .setDirection
        default:                self = .other(rawValue)
        }
    }

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ScriptElementType(rawValue: raw)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(rawValue)
    }

    // MARK: - Presentation

    var label: String {
        switch self {
        case .sceneHeading:   return "Scene heading"
        case .action:         return "Action"
        case .character:      return "Character"
        case .dialogue:       return "Dialogue"
        case .parenthetical:  return "Parenthetical"
        case .transition:     return "Transition"
        case .shot:           return "Shot"
        case .note:           return "Note"
        case .pageBreak:      return "Page break"
        case .titlePage:      return "Title page"
        case .centered:       return "Centered"
        case .lyrics:         return "Lyrics"
        case .synopsis:       return "Synopsis"
        case .section:        return "Section"
        case .act:            return "Act"
        case .sequence:       return "Sequence"
        case .sequenceEnd:    return "Sequence end"
        case .actBreak:       return "Act break"
        case .announcer:      return "Announcer"
        case .sfxCue:         return "SFX cue"
        case .musicCue:       return "Music cue"
        case .ambienceCue:    return "Ambience cue"
        case .soundCue:       return "Sound cue"
        case .songTitle:      return "Song title"
        case .lyric:          return "Lyric"
        case .danceDirection: return "Dance direction"
        case .musicalCue:     return "Musical cue"
        case .lightingCue:    return "Lighting cue"
        case .setDirection:   return "Set direction"
        case .other(let raw): return raw.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    /// Compact label for the keyboard accessory bar, where width is scarce.
    var shortLabel: String {
        switch self {
        case .sceneHeading:  return "Scene"
        case .action:        return "Action"
        case .character:     return "Char"
        case .dialogue:      return "Dialog"
        case .parenthetical: return "(Paren)"
        case .transition:    return "Trans"
        case .shot:          return "Shot"
        case .note:          return "Note"
        default:             return label
        }
    }

    var symbol: String {
        switch self {
        case .sceneHeading:   return "mappin.and.ellipse"
        case .action:         return "text.alignleft"
        case .character:      return "person.fill"
        case .dialogue:       return "quote.bubble"
        case .parenthetical:  return "parentheses"
        case .transition:     return "arrow.right.to.line"
        case .shot:           return "camera"
        case .note:           return "note.text"
        case .pageBreak:      return "doc.on.doc"
        case .centered:       return "text.aligncenter"
        case .lyrics, .lyric, .songTitle: return "music.note"
        case .synopsis:       return "list.bullet.rectangle"
        case .section, .act, .sequence, .sequenceEnd, .actBreak: return "square.stack"
        case .announcer:      return "megaphone"
        case .sfxCue, .soundCue: return "waveform"
        case .musicCue, .musicalCue: return "music.quarternote.3"
        case .ambienceCue:    return "wind"
        case .danceDirection: return "figure.dance"
        case .lightingCue:    return "lightbulb"
        case .setDirection:   return "theatermasks"
        default:              return "text.alignleft"
        }
    }

    // MARK: - Screenplay layout
    //
    // Margins are expressed as fractions of the page width so they scale to any
    // phone. They come from `.screenplay-*` in `src/app/globals.css`, converted
    // from the 8.5in page with 1in margins (6.5in of live area):
    //   character     margin-left 2.2in  →  2.2 / 6.5
    //   dialogue      margin-left 1.0in, margin-right 1.5in
    //   parenthetical margin-left 1.6in, margin-right 2.0in

    var leadingFraction: CGFloat {
        switch self {
        case .character, .announcer: return 2.2 / 6.5
        case .parenthetical:         return 1.6 / 6.5
        case .dialogue, .lyric, .lyrics: return 1.0 / 6.5
        default: return 0
        }
    }

    var trailingFraction: CGFloat {
        switch self {
        case .parenthetical:             return 2.0 / 6.5
        case .dialogue, .lyric, .lyrics: return 1.5 / 6.5
        default: return 0
        }
    }

    var alignment: TextAlignment {
        switch self {
        case .transition: return .trailing
        case .centered, .titlePage, .songTitle, .actBreak: return .center
        default: return .leading
        }
    }

    var isUppercased: Bool {
        switch self {
        case .sceneHeading, .character, .transition, .shot, .act, .actBreak, .announcer:
            return true
        default:
            return false
        }
    }

    var isBold: Bool {
        switch self {
        case .sceneHeading, .act, .actBreak, .section, .songTitle: return true
        default: return false
        }
    }

    var isItalic: Bool {
        switch self {
        case .parenthetical, .note, .synopsis: return true
        default: return false
        }
    }

    // MARK: - Editor colouring (mirrors .sp-dark in globals.css)

    /// Per-element text colour for the dark-mode editor, matching the web app's
    /// `.sp-dark` CSS selectors in `src/app/globals.css`.
    var textColor: Color {
        switch self {
        case .sceneHeading:   return Theme.textPrimary           // bold white stands out
        case .action:         return Theme.textSecondary          // slightly dimmer than headings
        case .character:      return Color(hex: 0xFCBA64)        // warm amber — brand 300
        case .dialogue:       return Color(hex: 0xE0E0E0)        // soft white
        case .parenthetical:  return Color(hex: 0xB0B0CC)        // companion to dialogue
        case .transition:     return Theme.textTertiary           // right-aligned, muted
        case .shot:           return Color(hex: 0x06B6D4)        // cyan-500
        case .note:           return Color(hex: 0x8888AA)        // muted, styled with left border
        case .act, .actBreak: return Color(hex: 0xFBBF24)        // amber-400
        case .sfxCue:         return Color(hex: 0x38BDF8)        // sky-400
        case .musicCue:       return Color(hex: 0xA78BFA)        // violet-400
        case .ambienceCue:    return Color(hex: 0x34D399)        // emerald-400
        case .soundCue:       return Color(hex: 0x38BDF8)        // sky-400
        case .announcer:      return Color(hex: 0xE0E0E0)
        case .lyrics, .lyric: return Color(hex: 0xA78BFA)        // violet-400
        case .songTitle:      return Color(hex: 0xFBBF24)        // amber-400
        case .section:        return Theme.textPrimary
        case .synopsis:       return Theme.textTertiary
        default:              return Theme.textPrimary
        }
    }

    /// An optional accent bar drawn on the left edge of the element row,
    /// matching the web's `border-left` styling for notes and similar types.
    var leftAccentColor: Color? {
        switch self {
        case .note:     return Color(hex: 0x555555)
        case .synopsis: return Color(hex: 0x3B82F6).opacity(0.5)
        default:        return nil
        }
    }

    /// Space above the element, in points at the base 12pt Courier size.
    var spacingAbove: CGFloat {
        switch self {
        case .sceneHeading, .act, .actBreak: return 20
        case .action, .transition, .character, .announcer: return 12
        case .dialogue, .parenthetical, .lyric: return 0
        default: return 10
        }
    }

    /// Elements whose content is always a single short line get a compact field.
    var isSingleLine: Bool {
        switch self {
        case .sceneHeading, .character, .transition, .announcer, .songTitle: return true
        default: return false
        }
    }

    var placeholder: String {
        switch self {
        case .sceneHeading:  return "INT. LOCATION - DAY"
        case .action:        return "Describe the action…"
        case .character:     return "CHARACTER NAME"
        case .dialogue:      return "What they say…"
        case .parenthetical: return "(beat)"
        case .transition:    return "CUT TO:"
        case .shot:          return "ANGLE ON —"
        case .note:          return "Note to self…"
        case .sfxCue:        return "SFX: …"
        case .musicCue:      return "MUSIC: …"
        default:             return label
        }
    }

    var keyboardCapitalisation: TextInputAutocapitalization {
        isUppercased ? .characters : .sentences
    }

    // MARK: - Editing behaviour
    //
    // Mirrors `getNextElementType` in `src/app/projects/[id]/script/page.tsx`
    // so a script written on the phone flows the same way as on the web.

    /// What pressing return at the end of this element creates next.
    var nextOnReturn: ScriptElementType {
        switch self {
        case .sceneHeading:   return .action
        case .action:         return .action
        case .character:      return .dialogue
        case .dialogue:       return .character
        case .parenthetical:  return .dialogue
        case .transition:     return .sceneHeading
        case .act:            return .sceneHeading
        case .sequence:       return .action
        case .sequenceEnd:    return .action
        case .actBreak:       return .action
        case .announcer:      return .dialogue
        case .sfxCue, .musicCue, .ambienceCue, .soundCue: return .action
        case .songTitle:      return .lyric
        case .lyric:          return .lyric
        case .danceDirection, .musicalCue, .lightingCue, .setDirection: return .action
        default:              return .action
        }
    }

    /// The order the type picker and the tab-cycle walk through.
    static let standardCycle: [ScriptElementType] = [
        .sceneHeading, .action, .character, .dialogue,
        .parenthetical, .transition, .shot, .note,
    ]

    /// Next type when cycling with the toolbar's cycle button.
    var nextInCycle: ScriptElementType {
        let cycle = Self.standardCycle
        guard let index = cycle.firstIndex(of: self) else { return .action }
        return cycle[(index + 1) % cycle.count]
    }
}
