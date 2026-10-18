package no.northem.screenplaystudio.data

import androidx.compose.ui.graphics.Color

// Mirrors mobile/ScreenplayStudio/Core/Models/Enums.swift — same raw values,
// labels and tints, so the two apps read as one product.

private val Brand400 = Color(0xFFFF8C46)
private val Brand500 = Color(0xFFFF5F1F)
private val Success = Color(0xFF10B981)
private val Warning = Color(0xFFF59E0B)
private val Tertiary = Color(0xFF8888AA)
private val Secondary = Color(0xFFB0B0CC)

enum class ProjectStatus(val raw: String, val label: String, val tint: Color) {
    DEVELOPMENT("development", "Development", Brand400),
    PRE_PRODUCTION("pre_production", "Pre-production", Color(0xFF8B5CF6)),
    PRODUCTION("production", "Production", Success),
    POST_PRODUCTION("post_production", "Post-production", Color(0xFF06B6D4)),
    COMPLETED("completed", "Completed", Color(0xFF22C55E)),
    ARCHIVED("archived", "Archived", Tertiary);

    companion object {
        fun from(raw: String?) = entries.firstOrNull { it.raw == raw } ?: DEVELOPMENT
    }
}

enum class ProjectFormat(val raw: String, val label: String) {
    FEATURE("feature", "Feature"),
    SHORT("short", "Short"),
    SERIES("series", "Series"),
    PILOT("pilot", "Pilot"),
    WEBSERIES("webseries", "Web series");

    companion object {
        fun from(raw: String?) = entries.firstOrNull { it.raw == raw } ?: FEATURE
    }
}

enum class SceneLocationType(val raw: String, val label: String, val shortLabel: String) {
    INT("INT", "INT.", "INT"),
    EXT("EXT", "EXT.", "EXT"),
    INT_EXT("INT_EXT", "INT./EXT.", "I/E"),
    EXT_INT("EXT_INT", "EXT./INT.", "E/I");

    companion object {
        fun from(raw: String?) = entries.firstOrNull { it.raw == raw }
    }
}

enum class SceneTime(val raw: String) {
    DAY("DAY"), NIGHT("NIGHT"), DAWN("DAWN"), DUSK("DUSK"), MORNING("MORNING"),
    AFTERNOON("AFTERNOON"), EVENING("EVENING"), CONTINUOUS("CONTINUOUS"),
    LATER("LATER"), MOMENTS_LATER("MOMENTS_LATER");

    val label get() = raw.replace('_', ' ')
    val isNight get() = this == NIGHT || this == DUSK || this == EVENING

    companion object {
        fun from(raw: String?) = entries.firstOrNull { it.raw == raw }
    }
}

enum class ShotType(val raw: String, val abbreviation: String, val label: String) {
    WIDE("wide", "WS", "Wide"),
    FULL("full", "FS", "Full"),
    MEDIUM_WIDE("medium_wide", "MWS", "Medium wide"),
    MEDIUM("medium", "MS", "Medium"),
    MEDIUM_CLOSE("medium_close", "MCU", "Medium close"),
    CLOSE_UP("close_up", "CU", "Close-up"),
    EXTREME_CLOSE("extreme_close", "ECU", "Extreme close-up"),
    OVER_SHOULDER("over_shoulder", "OTS", "Over the shoulder"),
    TWO_SHOT("two_shot", "2S", "Two shot"),
    POV("pov", "POV", "POV"),
    AERIAL("aerial", "AER", "Aerial"),
    INSERT("insert", "INS", "Insert"),
    CUTAWAY("cutaway", "CA", "Cutaway"),
    ESTABLISHING("establishing", "EST", "Establishing"),
    TRACKING("tracking", "TRK", "Tracking"),
    DOLLY("dolly", "DOL", "Dolly"),
    CRANE("crane", "CRN", "Crane"),
    STEADICAM("steadicam", "STE", "Steadicam"),
    HANDHELD("handheld", "HH", "Handheld"),
    STATIC("static", "STA", "Static"),
    DUTCH("dutch_angle", "DUT", "Dutch angle");

    companion object {
        fun from(raw: String?) = entries.firstOrNull { it.raw == raw }
    }
}

enum class ShotMovement(val raw: String, val label: String) {
    STATIC("static", "Static"),
    PAN_LEFT("pan_left", "Pan left"),
    PAN_RIGHT("pan_right", "Pan right"),
    TILT_UP("tilt_up", "Tilt up"),
    TILT_DOWN("tilt_down", "Tilt down"),
    DOLLY_IN("dolly_in", "Dolly in"),
    DOLLY_OUT("dolly_out", "Dolly out"),
    TRUCK_LEFT("truck_left", "Truck left"),
    TRUCK_RIGHT("truck_right", "Truck right"),
    CRANE_UP("crane_up", "Crane up"),
    CRANE_DOWN("crane_down", "Crane down"),
    ZOOM_IN("zoom_in", "Zoom in"),
    ZOOM_OUT("zoom_out", "Zoom out"),
    FOLLOW("follow", "Follow"),
    ORBIT("orbit", "Orbit"),
    WHIP_PAN("whip_pan", "Whip pan"),
    RACK_FOCUS("rack_focus", "Rack focus");

    companion object {
        fun from(raw: String?) = entries.firstOrNull { it.raw == raw }
    }
}

enum class ScheduleEventType(val raw: String, val label: String, val tint: Color) {
    SHOOTING("shooting", "Shooting", Brand500),
    REHEARSAL("rehearsal", "Rehearsal", Color(0xFF8B5CF6)),
    LOCATION_SCOUT("location_scout", "Location scout", Color(0xFF06B6D4)),
    MEETING("meeting", "Meeting", Color(0xFF3B82F6)),
    SETUP("setup", "Setup", Warning),
    WRAP("wrap", "Wrap", Success),
    TRAVEL("travel", "Travel", Color(0xFFEC4899)),
    BREAK("break", "Break", Tertiary),
    OTHER("other", "Other", Secondary);

    companion object {
        fun from(raw: String?) = entries.firstOrNull { it.raw == raw } ?: OTHER
    }
}

/**
 * Screenplay element types and their page layout. Margins are fractions of the
 * 6.5in live area of a US Letter page, from `.screenplay-*` in
 * src/app/globals.css — identical to ScriptElementType.swift.
 */
enum class ElementType(
    val raw: String,
    val label: String,
    val placeholder: String,
    val color: Color,
    val leading: Float = 0f,
    val trailing: Float = 0f,
    val uppercase: Boolean = false,
    val bold: Boolean = false,
    val italic: Boolean = false,
    val align: Align = Align.START,
    val spacingAbove: Int = 10,
) {
    SCENE_HEADING("scene_heading", "Scene heading", "INT. LOCATION - DAY", Color(0xFFF4F4FC), uppercase = true, bold = true, spacingAbove = 22),
    ACTION("action", "Action", "Describe the action…", Color(0xFFB0B0CC), spacingAbove = 12),
    CHARACTER("character", "Character", "CHARACTER NAME", Color(0xFFFCBA64), leading = 2.2f / 6.5f, uppercase = true, spacingAbove = 12),
    DIALOGUE("dialogue", "Dialogue", "What they say…", Color(0xFFE0E0E0), leading = 1.0f / 6.5f, trailing = 1.5f / 6.5f, spacingAbove = 0),
    PARENTHETICAL("parenthetical", "Parenthetical", "(beat)", Color(0xFFB0B0CC), leading = 1.6f / 6.5f, trailing = 2.0f / 6.5f, italic = true, spacingAbove = 0),
    TRANSITION("transition", "Transition", "CUT TO:", Color(0xFF8888AA), uppercase = true, align = Align.END, spacingAbove = 12),
    SHOT("shot", "Shot", "ANGLE ON —", Color(0xFF06B6D4), uppercase = true),
    NOTE("note", "Note", "Note to self…", Color(0xFF8888AA), italic = true),
    CENTERED("centered", "Centered", "Centered", Color(0xFFF4F4FC), align = Align.CENTER),
    SECTION("section", "Section", "Section", Color(0xFFF4F4FC), bold = true),
    SYNOPSIS("synopsis", "Synopsis", "Synopsis", Color(0xFF8888AA), italic = true),
    ACT("act", "Act", "ACT ONE", Color(0xFFFBBF24), uppercase = true, bold = true, align = Align.CENTER, spacingAbove = 22),
    LYRICS("lyrics", "Lyrics", "Lyrics", Color(0xFFA78BFA), leading = 1.0f / 6.5f, trailing = 1.5f / 6.5f, italic = true),
    OTHER("other", "Text", "", Color(0xFFF4F4FC));

    enum class Align { START, CENTER, END }

    /** What Return creates next — `getNextElementType` in the web editor. */
    val nextOnReturn: ElementType
        get() = when (this) {
            SCENE_HEADING -> ACTION
            ACTION -> ACTION
            CHARACTER -> DIALOGUE
            DIALOGUE -> CHARACTER
            PARENTHETICAL -> DIALOGUE
            TRANSITION -> SCENE_HEADING
            ACT -> SCENE_HEADING
            LYRICS -> LYRICS
            else -> ACTION
        }

    val singleLine get() = this == SCENE_HEADING || this == CHARACTER || this == TRANSITION

    companion object {
        /** The element bar above the keyboard, in the order a scene is written. */
        val STANDARD = listOf(SCENE_HEADING, ACTION, CHARACTER, DIALOGUE, PARENTHETICAL, TRANSITION, SHOT, NOTE)

        fun from(raw: String?) = entries.firstOrNull { it.raw == raw } ?: OTHER
    }
}

enum class DocumentType(val raw: String, val label: String) {
    DOCUMENT("document", "Document"),
    SCRIPT_NOTES("script_notes", "Script notes"),
    TREATMENT("treatment", "Treatment"),
    OUTLINE("outline", "Outline"),
    RESEARCH("research", "Research"),
    MEETING_NOTES("meeting_notes", "Meeting notes"),
    CALL_SHEET("call_sheet", "Call sheet"),
    SHOT_LIST("shot_list", "Shot list"),
    SCHEDULE("schedule", "Schedule");

    companion object {
        fun from(raw: String?) = entries.firstOrNull { it.raw == raw } ?: DOCUMENT
    }
}

private val Danger = Color(0xFFEF4444)

enum class GearCategory(val raw: String, val tint: Color) {
    CAMERA("Camera", Brand500),
    LENSES("Lenses", Color(0xFF8B5CF6)),
    LIGHTING("Lighting", Color(0xFFFBBF24)),
    GRIP("Grip", Color(0xFF78716C)),
    SOUND("Sound", Color(0xFF06B6D4)),
    ART_DEPT("Art Dept", Color(0xFFEC4899)),
    COSTUME("Costume", Color(0xFFA78BFA)),
    HAIR_MAKEUP("Hair & Makeup", Color(0xFFF472B6)),
    LOCATIONS("Locations", Color(0xFF22C55E)),
    TRANSPORT("Transport", Color(0xFF3B82F6)),
    POST_DIT("Post / DIT", Color(0xFF14B8A6)),
    OTHER("Other", Tertiary);

    val label get() = raw

    companion object {
        fun from(raw: String?) = entries.firstOrNull { it.raw == raw } ?: OTHER
    }
}

enum class GearOwnership(val raw: String, val label: String, val tint: Color) {
    OWNED("owned", "Owned", Success),
    RENTED("rented", "Rented", Color(0xFF3B82F6)),
    PROVIDED("provided", "Provided", Color(0xFF8B5CF6)),
    TBC("tbc", "TBC", Tertiary);

    companion object {
        fun from(raw: String?) = entries.firstOrNull { it.raw == raw } ?: TBC
    }
}

enum class GearStatus(val raw: String, val label: String, val tint: Color) {
    CONFIRMED("confirmed", "Confirmed", Success),
    PENDING("pending", "Pending", Warning),
    CANCELLED("cancelled", "Cancelled", Danger);

    /** Tapping the status chip walks pending → confirmed → cancelled → pending, as on iOS. */
    val next: GearStatus
        get() = when (this) {
            PENDING -> CONFIRMED
            CONFIRMED -> CANCELLED
            CANCELLED -> PENDING
        }

    companion object {
        fun from(raw: String?) = entries.firstOrNull { it.raw == raw } ?: PENDING
    }
}
