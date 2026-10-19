package no.northem.screenplaystudio.data

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import java.util.UUID

/**
 * Per-table reads and writes. Mirrors Core/Services on iOS query for query,
 * so both apps see the same rows in the same order.
 *
 * Every write goes through [send]: offline, it lands in the [SyncQueue] and
 * replays in order on reconnect, so callers' optimistic updates stand. Rows
 * are created with a client-made id for the same reason — the screen can show
 * a new shot or document before the server has ever seen it.
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
        return insert("scripts", Script.serializer()) {
            put("project_id", projectId); put("title", title); put("created_by", uid); put("is_active", true)
        }
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

    /** True when it reached the server, false when it was queued offline. */
    suspend fun upsertElement(element: ScriptElement): Boolean {
        val body = jsonArrayOf(buildJsonObject {
            put("id", element.id)
            put("script_id", element.scriptId)
            put("element_type", element.elementType)
            put("content", element.content)
            put("sort_order", element.sortOrder)
            me()?.let { put("created_by", it) }
        })
        return send(Query("script_elements").upsert(body)) != null
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
        return insert("scenes", ProductionScene.serializer()) {
            put("project_id", projectId)
            number?.nonEmpty()?.let { put("scene_number", it) }
            put("scene_heading", heading)
            put("location_type", location.raw)
            put("location_name", locationName.trim().uppercase())
            put("time_of_day", time.raw)
            synopsis?.nonEmpty()?.let { put("synopsis", it) }
            put("sort_order", sortOrder)
            me()?.let { put("created_by", it) }
        }
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
        return insert("shots", Shot.serializer()) {
            put("project_id", projectId)
            sceneId?.let { put("scene_id", it) }
            number?.nonEmpty()?.let { put("shot_number", it) }
            put("shot_type", type.raw)
            put("shot_movement", movement.raw)
            lens?.nonEmpty()?.let { put("lens", it) }
            description?.nonEmpty()?.let { put("description", it) }
            put("sort_order", sortOrder)
            me()?.let { put("created_by", it) }
        }
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
        return insert("characters", ProjectCharacter.serializer()) {
            put("project_id", projectId)
            put("name", name.trim().uppercase())
            description?.nonEmpty()?.let { put("description", it) }
            put("is_main", lead)
            put("color", color)
            put("sort_order", sortOrder)
            me()?.let { put("created_by", it) }
        }
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
        return insert("production_schedule", ScheduleEvent.serializer()) {
            put("project_id", projectId)
            put("title", title.trim())
            put("event_type", type.raw)
            put("start_time", PostgresDate.format(start))
            put("end_time", PostgresDate.format(end))
            put("all_day", false)
            notes?.nonEmpty()?.let { put("notes", it) }
            me()?.let { put("created_by", it) }
        }
    }

    suspend fun setEventConfirmed(id: String, confirmed: Boolean) = patch("production_schedule", id) {
        put("is_confirmed", confirmed)
    }

    suspend fun deleteEvent(id: String) = delete("production_schedule", id)

    // endregion

    // region Documents

    fun documentsQuery(projectId: String) =
        Query("project_documents").select().eq("project_id", projectId).order("updated_at", ascending = false)
    fun foldersQuery(projectId: String) = Query("project_folders").select().eq("project_id", projectId).order("sort_order")

    suspend fun fetchDocuments(projectId: String) = db.select(documentsQuery(projectId), ProjectDocument.serializer())
    suspend fun fetchFolders(projectId: String) = db.select(foldersQuery(projectId), ProjectFolder.serializer())

    suspend fun createDocument(projectId: String, title: String, type: DocumentType, folderId: String?): ProjectDocument? =
        insert("project_documents", ProjectDocument.serializer()) {
            put("project_id", projectId)
            put("title", title.trim().ifEmpty { "Untitled" })
            put("content", "")
            put("document_type", type.raw)
            folderId?.let { put("folder_id", it) }
            put("is_pinned", false)
            me()?.let { put("created_by", it); put("last_edited_by", it) }
            put("updated_at", now())
        }

    suspend fun saveDocument(id: String, title: String? = null, content: String? = null) = patch("project_documents", id) {
        title?.let { put("title", it) }
        content?.let { put("content", it) }
        me()?.let { put("last_edited_by", it) }
        put("updated_at", now())
    }

    suspend fun setDocumentPinned(id: String, pinned: Boolean) = patch("project_documents", id) { put("is_pinned", pinned) }

    suspend fun moveDocument(id: String, folderId: String?) = patch("project_documents", id) {
        put("folder_id", folderId); put("updated_at", now())
    }

    suspend fun deleteDocument(id: String) = delete("project_documents", id)

    suspend fun createFolder(projectId: String, name: String, sortOrder: Int): ProjectFolder? =
        insert("project_folders", ProjectFolder.serializer()) {
            put("project_id", projectId)
            put("name", name.trim())
            put("sort_order", sortOrder)
            me()?.let { put("created_by", it) }
        }

    suspend fun deleteFolder(id: String) = delete("project_folders", id)

    // endregion

    // region Gear

    fun gearQuery(projectId: String) = Query("shoot_gear").select().eq("project_id", projectId).order("category").order("name")
    fun activeCheckoutsQuery(projectId: String) =
        Query("gear_checkouts").select().eq("project_id", projectId).isNull("returned_at").order("checked_out_at", ascending = false)
    fun checkoutHistoryQuery(gearId: String) =
        Query("gear_checkouts").select().eq("gear_id", gearId).order("checked_out_at", ascending = false)

    suspend fun fetchGear(projectId: String) = db.select(gearQuery(projectId), GearItem.serializer())
    suspend fun fetchActiveCheckouts(projectId: String) = db.select(activeCheckoutsQuery(projectId), GearCheckout.serializer())
    suspend fun fetchCheckoutHistory(gearId: String) = db.select(checkoutHistoryQuery(gearId), GearCheckout.serializer())

    suspend fun createGear(
        projectId: String,
        name: String,
        category: GearCategory,
        quantity: Int,
        unit: String,
        ownership: GearOwnership,
        vendor: String?,
        dailyRate: Double?,
        notes: String?,
    ): GearItem? = insert("shoot_gear", GearItem.serializer()) {
        put("project_id", projectId)
        put("name", name.trim())
        put("category", category.raw)
        put("quantity", quantity)
        put("unit", unit.trim().ifEmpty { "unit" })
        put("ownership", ownership.raw)
        vendor?.nonEmpty()?.let { put("vendor", it) }
        dailyRate?.let { put("daily_rate", it) }
        notes?.nonEmpty()?.let { put("notes", it) }
        put("status", GearStatus.PENDING.raw)
        me()?.let { put("created_by", it) }
    }

    suspend fun setGearStatus(id: String, status: GearStatus) = patch("shoot_gear", id) {
        put("status", status.raw); put("updated_at", now())
    }

    suspend fun deleteGear(id: String) = delete("shoot_gear", id)

    suspend fun checkOutGear(projectId: String, gearId: String, name: String, notes: String?): GearCheckout? {
        val uid = me() ?: return null
        return insert("gear_checkouts", GearCheckout.serializer()) {
            put("gear_id", gearId)
            put("project_id", projectId)
            put("checked_out_by", uid)
            put("checked_out_by_name", name.trim())
            put("checked_out_at", now())
            notes?.nonEmpty()?.let { put("notes", it) }
        }
    }

    suspend fun returnGear(checkoutId: String) = patch("gear_checkouts", checkoutId) { put("returned_at", now()) }

    // endregion

    // region Writes

    /**
     * Sends a write, or parks it in the [SyncQueue] when the device is offline.
     * While older writes are still queued a new one queues behind them, so a
     * patch can never land before the insert it edits. Returns the response
     * body, or null when the write was queued.
     */
    private suspend fun send(query: Query): String? {
        if (!db.demo && SyncQueue.hasPending) {
            SyncQueue.enqueue(query)
            return null
        }
        return try {
            db.execute(query)
        } catch (e: SupabaseException) {
            if (!e.offline) throw e
            SyncQueue.enqueue(query)
            null
        }
    }

    /** Inserts one row with a client-made id; offline, the row itself stands in for the reply. */
    private suspend fun <T> insert(table: String, serializer: KSerializer<T>, build: JsonObjectBuilder.() -> Unit): T? {
        val row = buildJsonObject { put("id", newElementId()); build() }
        val raw = send(Query(table).insert(jsonArrayOf(row))) ?: return db.json.decodeFromJsonElement(serializer, row)
        return db.decodeList(raw, serializer).firstOrNull()
    }

    /** True when the change reached the server, false when it was queued offline. */
    private suspend fun patch(table: String, id: String, build: JsonObjectBuilder.() -> Unit): Boolean =
        send(Query(table).eq("id", id).update(buildJsonObject(build).toString())) != null

    private suspend fun delete(table: String, id: String): Boolean =
        send(Query(table).eq("id", id).delete()) != null

    // endregion
}
