package no.northem.screenplaystudio.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.roundToInt

// Types mirroring the Postgres schema — the same tables and columns the iOS
// app (mobile/ScreenplayStudio/Core/Models) and the website read.
//
// Enum-like columns are kept as raw strings and resolved through the enums in
// Enums.kt. A value added to the database after this build shipped then
// resolves to a default instead of failing the whole row, which would blank
// the screen and look exactly like a sync failure.

@Serializable
data class Project(
    val id: String,
    val title: String,
    val logline: String? = null,
    val synopsis: String? = null,
    val genre: List<String>? = null,
    val format: String? = null,
    val status: String? = null,
    @SerialName("created_by") val createdBy: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
) {
    val resolvedStatus get() = ProjectStatus.from(status)
    val resolvedFormat get() = ProjectFormat.from(format)
    val genreSummary get() = genre?.filter { it.isNotBlank() }?.takeIf { it.isNotEmpty() }?.joinToString(" · ")

    /** FNV-1a over the id — the same stable colour the iOS app picks. */
    val accentSeed: Int
        get() {
            var hash = 2_166_136_261u
            for (byte in id.encodeToByteArray()) {
                hash = (hash xor byte.toUByte().toUInt()) * 16_777_619u
            }
            return (hash % ACCENT_PALETTE.size.toUInt()).toInt()
        }

    companion object {
        val ACCENT_PALETTE = longArrayOf(
            0xFFFF5F1F, 0xFF8B5CF6, 0xFF06B6D4, 0xFF22C55E,
            0xFFEC4899, 0xFFF59E0B, 0xFF3B82F6, 0xFFEF4444,
        )
    }
}

@Serializable
data class Profile(
    val id: String,
    val email: String? = null,
    @SerialName("full_name") val fullName: String? = null,
    @SerialName("display_name") val displayName: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
) {
    val bestName: String
        get() = displayName?.nonEmpty() ?: fullName?.nonEmpty() ?: email?.substringBefore("@") ?: "Unnamed"
    val initials: String get() = initialsOf(bestName)
}

@Serializable
data class Script(
    val id: String,
    @SerialName("project_id") val projectId: String,
    val title: String,
    val version: Int? = null,
    @SerialName("revision_color") val revisionColor: String? = null,
    @SerialName("is_active") val isActive: Boolean? = null,
    val locked: Boolean? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
) {
    val versionLabel get() = "v${version ?: 1}"
}

@Serializable
data class ScriptElement(
    val id: String,
    @SerialName("script_id") val scriptId: String,
    @SerialName("element_type") val elementType: String,
    val content: String = "",
    @SerialName("sort_order") val sortOrder: Double = 0.0,
    @SerialName("scene_number") val sceneNumber: String? = null,
) {
    val type get() = ElementType.from(elementType)
}

@Serializable
data class ProductionScene(
    val id: String,
    @SerialName("project_id") val projectId: String,
    @SerialName("script_id") val scriptId: String? = null,
    @SerialName("scene_number") val sceneNumber: String? = null,
    @SerialName("scene_heading") val sceneHeading: String? = null,
    @SerialName("location_type") val locationType: String? = null,
    @SerialName("location_name") val locationName: String? = null,
    @SerialName("time_of_day") val timeOfDay: String? = null,
    val synopsis: String? = null,
    @SerialName("page_count") val pageCount: Double? = null,
    @SerialName("cast_ids") val castIds: List<String>? = null,
    @SerialName("extras_count") val extrasCount: Int? = null,
    val props: List<String>? = null,
    val costumes: List<String>? = null,
    @SerialName("makeup_notes") val makeupNotes: String? = null,
    @SerialName("special_effects") val specialEffects: List<String>? = null,
    val stunts: String? = null,
    val vehicles: List<String>? = null,
    val animals: List<String>? = null,
    @SerialName("sound_notes") val soundNotes: String? = null,
    @SerialName("music_cues") val musicCues: List<String>? = null,
    @SerialName("vfx_notes") val vfxNotes: String? = null,
    val mood: String? = null,
    @SerialName("weather_required") val weatherRequired: String? = null,
    @SerialName("special_equipment") val specialEquipment: List<String>? = null,
    val notes: String? = null,
    @SerialName("is_completed") val isCompleted: Boolean? = null,
    @SerialName("sort_order") val sortOrder: Int? = null,
) {
    val done get() = isCompleted == true
    val location get() = SceneLocationType.from(locationType)
    val time get() = SceneTime.from(timeOfDay)

    val displayHeading: String
        get() {
            sceneHeading?.nonEmpty()?.let { return it.uppercase() }
            val head = listOfNotNull(location?.label, locationName?.nonEmpty()?.uppercase()).joinToString(" ")
            val t = time
            return when {
                t != null && head.isEmpty() -> t.label
                t != null -> "$head - ${t.label}"
                head.isEmpty() -> "Untitled scene"
                else -> head
            }
        }

    /** Page length in eighths, the way a stripboard writes it: "1 3/8". */
    val eighthsLabel: String?
        get() {
            val pages = pageCount ?: return null
            if (pages <= 0) return null
            val total = (pages * 8).roundToInt()
            val whole = total / 8
            val rem = total % 8
            return when {
                whole == 0 -> "$rem/8"
                rem == 0 -> "$whole"
                else -> "$whole $rem/8"
            }
        }

    val breakdownTallies: List<Pair<String, Int>>
        get() = listOf(
            "Cast" to (castIds?.size ?: 0),
            "Props" to (props?.size ?: 0),
            "Costumes" to (costumes?.size ?: 0),
            "SFX" to (specialEffects?.size ?: 0),
            "Vehicles" to (vehicles?.size ?: 0),
            "Animals" to (animals?.size ?: 0),
            "Music" to (musicCues?.size ?: 0),
            "Equipment" to (specialEquipment?.size ?: 0),
        ).filter { it.second > 0 }
}

@Serializable
data class Shot(
    val id: String,
    @SerialName("project_id") val projectId: String,
    @SerialName("scene_id") val sceneId: String? = null,
    @SerialName("shot_number") val shotNumber: String? = null,
    @SerialName("shot_type") val shotType: String? = null,
    @SerialName("shot_movement") val shotMovement: String? = null,
    val lens: String? = null,
    val description: String? = null,
    @SerialName("duration_seconds") val durationSeconds: Int? = null,
    @SerialName("camera_notes") val cameraNotes: String? = null,
    @SerialName("vfx_required") val vfxRequired: Boolean? = null,
    @SerialName("is_completed") val isCompleted: Boolean? = null,
    @SerialName("takes_needed") val takesNeeded: Int? = null,
    @SerialName("takes_completed") val takesCompleted: Int? = null,
    @SerialName("sort_order") val sortOrder: Int? = null,
) {
    val done get() = isCompleted == true
    val displayNumber get() = shotNumber?.nonEmpty() ?: "—"
    val type get() = ShotType.from(shotType)
    val movement get() = ShotMovement.from(shotMovement)

    val techSummary: String
        get() = listOfNotNull(
            type?.abbreviation,
            movement?.takeIf { it != ShotMovement.STATIC }?.label,
            lens?.nonEmpty(),
        ).joinToString(" · ")

    val takesLabel: String?
        get() {
            val needed = takesNeeded ?: 0
            val completed = takesCompleted ?: 0
            if (needed == 0 && completed == 0) return null
            return "$completed/${maxOf(needed, completed)} takes"
        }
}

@Serializable
data class ScheduleEvent(
    val id: String,
    @SerialName("project_id") val projectId: String,
    val title: String,
    @SerialName("event_type") val eventType: String? = null,
    @SerialName("start_time") val startTime: String,
    @SerialName("end_time") val endTime: String,
    @SerialName("all_day") val allDay: Boolean? = null,
    @SerialName("scene_ids") val sceneIds: List<String>? = null,
    @SerialName("call_time") val callTime: String? = null,
    val notes: String? = null,
    @SerialName("is_confirmed") val isConfirmed: Boolean? = null,
) {
    val type get() = ScheduleEventType.from(eventType)
    val confirmed get() = isConfirmed == true
    val start: Instant get() = PostgresDate.parse(startTime) ?: Instant.EPOCH
    val end: Instant get() = PostgresDate.parse(endTime) ?: start
    val day: LocalDate get() = start.atZone(ZoneId.systemDefault()).toLocalDate()
    val call: Instant? get() = callTime?.let(PostgresDate::parse)
}

@Serializable
data class ProjectCharacter(
    val id: String,
    @SerialName("project_id") val projectId: String,
    val name: String,
    @SerialName("full_name") val fullName: String? = null,
    val age: String? = null,
    val gender: String? = null,
    val description: String? = null,
    val color: String? = null,
    @SerialName("is_main") val isMain: Boolean? = null,
    @SerialName("cast_actor") val castActor: String? = null,
    @SerialName("sort_order") val sortOrder: Int? = null,
) {
    val lead get() = isMain == true
    val initials get() = initialsOf(name)
    val subtitle: String?
        get() {
            val parts = listOfNotNull(
                age?.nonEmpty(),
                gender?.nonEmpty(),
                castActor?.nonEmpty()?.let { "Cast: $it" },
            )
            return if (parts.isEmpty()) description?.nonEmpty() else parts.joinToString(" · ")
        }
}

fun String.nonEmpty(): String? = trim().takeIf { it.isNotEmpty() }

fun initialsOf(name: String): String =
    name.split(" ").filter { it.isNotBlank() }.take(2).mapNotNull { it.firstOrNull()?.toString() }
        .joinToString("").uppercase().ifEmpty { "?" }
