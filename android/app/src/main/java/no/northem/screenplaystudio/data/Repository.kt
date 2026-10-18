package no.northem.screenplaystudio.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import java.util.UUID

/**
 * Per-table reads and writes. Mirrors Core/Services on iOS query for query,
 * so both apps see the same rows in the same order.
 */
object Repository {

    private val db = Supabase
    private fun now() = PostgresDate.format(Instant.now())
    private fun me() = db.userId

    // region Projects

    @Serializable
    private data class Membership(val project_id: String)

    suspend fun projectsQuery(): Query {
        val uid = me() ?: return Query("projects").select().eq("id", "none")
        // Projects the user owns, plus any they're a member of.
        val memberIds = runCatching {
            db.select(Query("project_members").select("project_id").eq("user_id", uid), Membership.serializer(), cache = false)
                .map { it.project_id }
        }.getOrDefault(emptyList())
        var filter = "created_by.eq.$uid"
        if (memberIds.isNotEmpty()) filter += ",id.in.(${memberIds.joinToString(",")})"
        return Query("projects").select().or(filter).order("updated_at", ascending = false)
    }

    suspend fun fetchProjects(): List<Project> = db.select(projectsQuery(), Project.serializer())

    suspend fun fetchProject(id: String): Project? =
        db.select(Query("projects").select().eq("id", id).limit(1), Project.serializer()).firstOrNull()

    suspend fun createProject(title: String, format: ProjectFormat, logline: String?): Project? {
        val uid = me() ?: return null
        val body = jsonArrayOf(buildJsonObject {
            put("title", title.trim())
            logline?.nonEmpty()?.let { put("logline", it) }
            put("format", format.raw)
            put("status", ProjectStatus.DEVELOPMENT.raw)
            put("created_by", uid)
        })
        return db.decodeList(db.execute(Query("projects").insert(body)), Project.serializer()).firstOrNull()
    }

    suspend fun setProjectStatus(id: String, status: ProjectStatus) = patch("projects", id) {
        put("status", status.raw); put("updated_at", now())
    }

    suspend fun deleteProject(id: String) = delete("projects", id)

    suspend fun fetchProfile(): Profile? {
        val uid = me() ?: return null
        return db.select(Query("profiles").select().eq("id", uid).limit(1), Profile.serializer()).firstOrNull()
    }

    // endregion

    // region Scripts

    fun scriptsQuery(projectId: String) = Query("scripts").select().eq("project_id", projectId).order("version", ascending = false)

    suspend fun fetchScripts(projectId: String) = db.select(scriptsQuery(projectId), Script.serializer())

    fun preferredScript(scripts: List<Script>): Script? = scripts.firstOrNull { it.isActive == true } ?: scripts.firstOrNull()

    suspend fun createScript(projectId: String, title: String): Script? {
        val uid = me() ?: return null
        val body = jsonArrayOf(buildJsonObject {
            put("project_id", projectId); put("title", title); put("created_by", uid); put("is_active", true)
        })
        return db.decodeList(db.execute(Query("scripts").insert(body)), Script.serializer()).firstOrNull()
    }

    fun elementsQuery(scriptId: String) =
        Query("script_elements").select().eq("script_id", scriptId).order("sort_order").order("id")

    /** Pages through PostgREST's 1,000-row cap — a feature script runs to ~2,500 elements. */
    suspend fun fetchElements(scriptId: String): List<ScriptElement> {
        val pageSize = 1000
        val rows = mutableListOf<ScriptElement>()
        while (true) {
            val page = db.select(
                elementsQuery(scriptId).range(rows.size, rows.size + pageSize - 1),
                ScriptElement.serializer(),
                cache = false,
            )
            rows += page
            if (page.size < pageSize) return rows
        }
    }

    fun newElementId(): String = UUID.randomUUID().toString()

    suspend fun upsertElement(element: ScriptElement) {
        val body = jsonArrayOf(buildJsonObject {
            put("id", element.id)
            put("script_id", element.scriptId)
            put("element_type", element.elementType)
            put("content", element.content)
            put("sort_order", element.sortOrder)
            me()?.let { put("created_by", it) }
        })
        db.execute(Query("script_elements").upsert(body))
    }

    suspend fun updateElement(id: String, content: String? = null, type: String? = null, sortOrder: Double? = null) =
        patch("script_elements", id) {
            content?.let { put("content", it) }
            type?.let { put("element_type", it) }
            sortOrder?.let { put("sort_order", it) }
            put("updated_at", now())
        }

    suspend fun deleteElement(id: String) = delete("script_elements", id)

    // endregion

    // region Scenes

    fun scenesQuery(projectId: String) = Query("scenes").select().eq("project_id", projectId).order("sort_order")
    suspend fun fetchScenes(projectId: String) = db.select(scenesQuery(projectId), ProductionScene.serializer())

    suspend fun createScene(
        projectId: String,
        number: String?,
        location: SceneLocationType,
        locationName: String,
        time: SceneTime,
        synopsis: String?,
        sortOrder: Int,
    ): ProductionScene? {
        val heading = "${location.label} ${locationName.trim().uppercase()} - ${time.label}"
        val body = jsonArrayOf(buildJsonObject {
            put("project_id", projectId)
            number?.nonEmpty()?.let { put("scene_number", it) }
            put("scene_heading", heading)
            put("location_type", location.raw)
            put("location_name", locationName.trim().uppercase())
            put("time_of_day", time.raw)
            synopsis?.nonEmpty()?.let { put("synopsis", it) }
            put("sort_order", sortOrder)
            me()?.let { put("created_by", it) }
        })
        return db.decodeList(db.execute(Query("scenes").insert(body)), ProductionScene.serializer()).firstOrNull()
    }

    suspend fun setSceneCompleted(id: String, done: Boolean) = patch("scenes", id) {
        put("is_completed", done); put("updated_at", now())
    }

    suspend fun updateScene(id: String, fields: JsonObject) = patch("scenes", id) {
        fields.forEach { (k, v) -> put(k, v) }
        put("updated_at", now())
    }

    suspend fun deleteScene(id: String) = delete("scenes", id)

    // endregion

    // region Shots

    fun shotsQuery(projectId: String) = Query("shots").select().eq("project_id", projectId).order("sort_order")
    suspend fun fetchShots(projectId: String) = db.select(shotsQuery(projectId), Shot.serializer())

    suspend fun createShot(
        projectId: String,
        sceneId: String?,
        number: String?,
        type: ShotType,
        movement: ShotMovement,
        lens: String?,
        description: String?,
        sortOrder: Int,
    ): Shot? {
        val body = jsonArrayOf(buildJsonObject {
            put("project_id", projectId)
            sceneId?.let { put("scene_id", it) }
            number?.nonEmpty()?.let { put("shot_number", it) }
            put("shot_type", type.raw)
            put("shot_movement", movement.raw)
            lens?.nonEmpty()?.let { put("lens", it) }
            description?.nonEmpty()?.let { put("description", it) }
            put("sort_order", sortOrder)
            me()?.let { put("created_by", it) }
        })
        return db.decodeList(db.execute(Query("shots").insert(body)), Shot.serializer()).firstOrNull()
    }

    suspend fun setShotCompleted(id: String, done: Boolean) = patch("shots", id) {
        put("is_completed", done); put("updated_at", now())
    }

    suspend fun setTakes(id: String, takes: Int) = patch("shots", id) {
        put("takes_completed", takes); put("updated_at", now())
    }

    suspend fun deleteShot(id: String) = delete("shots", id)

    // endregion

    // region Characters

    fun charactersQuery(projectId: String) = Query("characters").select().eq("project_id", projectId).order("sort_order")
    suspend fun fetchCharacters(projectId: String) = db.select(charactersQuery(projectId), ProjectCharacter.serializer())

    suspend fun createCharacter(projectId: String, name: String, description: String?, lead: Boolean, color: String, sortOrder: Int): ProjectCharacter? {
        val body = jsonArrayOf(buildJsonObject {
            put("project_id", projectId)
            put("name", name.trim().uppercase())
            description?.nonEmpty()?.let { put("description", it) }
            put("is_main", lead)
            put("color", color)
            put("sort_order", sortOrder)
            me()?.let { put("created_by", it) }
        })
        return db.decodeList(db.execute(Query("characters").insert(body)), ProjectCharacter.serializer()).firstOrNull()
    }

    suspend fun deleteCharacter(id: String) = delete("characters", id)

    // endregion

    // region Schedule

    fun scheduleQuery(projectId: String) = Query("production_schedule").select().eq("project_id", projectId).order("start_time")
    suspend fun fetchSchedule(projectId: String) = db.select(scheduleQuery(projectId), ScheduleEvent.serializer())

    fun scheduleWindowQuery(projectIds: List<String>, from: Instant, to: Instant) =
        Query("production_schedule").select()
            .inList("project_id", projectIds)
            .gte("start_time", PostgresDate.format(from))
            .lte("start_time", PostgresDate.format(to))
            .order("start_time")

    suspend fun createEvent(projectId: String, title: String, type: ScheduleEventType, start: Instant, end: Instant, notes: String?): ScheduleEvent? {
        val body = jsonArrayOf(buildJsonObject {
            put("project_id", projectId)
            put("title", title.trim())
            put("event_type", type.raw)
            put("start_time", PostgresDate.format(start))
            put("end_time", PostgresDate.format(end))
            put("all_day", false)
            notes?.nonEmpty()?.let { put("notes", it) }
            me()?.let { put("created_by", it) }
        })
        return db.decodeList(db.execute(Query("production_schedule").insert(body)), ScheduleEvent.serializer()).firstOrNull()
    }

    suspend fun setEventConfirmed(id: String, confirmed: Boolean) = patch("production_schedule", id) {
        put("is_confirmed", confirmed)
    }

    suspend fun deleteEvent(id: String) = delete("production_schedule", id)

    // endregion

    private suspend fun patch(table: String, id: String, build: kotlinx.serialization.json.JsonObjectBuilder.() -> Unit) {
        db.execute(Query(table).eq("id", id).update(buildJsonObject(build).toString()))
    }

    private suspend fun delete(table: String, id: String) {
        db.execute(Query(table).eq("id", id).delete())
    }
}
