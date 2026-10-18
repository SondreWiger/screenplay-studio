package no.northem.screenplaystudio.data

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import java.io.File
import java.util.UUID

/** A write made while offline, kept exactly as it would have gone out. */
@Serializable
data class PendingMutation(
    val id: String = UUID.randomUUID().toString(),
    val createdAt: Long = System.currentTimeMillis(),
    val query: Query,
    val attempts: Int = 0,
)

/**
 * Durable FIFO queue of offline writes — the Kotlin twin of SyncQueue.swift.
 *
 * Ordering matters (an element's insert has to land before the patch that
 * edits it), so the queue drains strictly oldest-first and stops at the first
 * failure rather than skipping ahead. While anything is queued, new writes
 * queue behind it for the same reason; see [Repository.send].
 */
object SyncQueue {

    /** After this many rejections a write is dropped, so one poisoned row can't wedge the queue. */
    private const val MAX_ATTEMPTS = 5

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val lock = Mutex()
    private val drainLock = Mutex()
    private val serializer = ListSerializer(PendingMutation.serializer())
    private var file: File? = null

    private val _pending = MutableStateFlow<List<PendingMutation>>(emptyList())
    val pending: StateFlow<List<PendingMutation>> = _pending.asStateFlow()
    val count: Int get() = _pending.value.size
    val hasPending: Boolean get() = _pending.value.isNotEmpty()

    fun init(context: Context) {
        val store = File(context.filesDir, "pending-mutations.json")
        file = store
        _pending.value = runCatching { Supabase.json.decodeFromString(serializer, store.readText()) }.getOrDefault(emptyList())
    }

    suspend fun enqueue(query: Query) {
        lock.withLock {
            val list = _pending.value
            val last = list.lastOrNull()
            val merged = last?.let { coalesce(it.query, query) }
            _pending.value = if (merged != null) list.dropLast(1) + last.copy(query = merged) else list + PendingMutation(query = query)
            persist()
        }
        if (Connectivity.online.value) drainSoon()
    }

    fun drainSoon() {
        scope.launch { drain() }
    }

    /** Replays queued writes oldest-first. Returns how many landed. */
    suspend fun drain(): Int {
        if (!drainLock.tryLock()) return 0
        var succeeded = 0
        try {
            while (true) {
                val next = _pending.value.firstOrNull() ?: break
                val outcome = try {
                    Supabase.execute(next.query)
                    true
                } catch (e: SupabaseException) {
                    when {
                        // Still offline, or the session needs a fresh sign-in: keep
                        // everything and try again on the next connectivity change.
                        e.offline || e.status == 401 || e.status >= 500 || e.status == 0 -> break
                        // A replayed insert whose first attempt did land, reply lost.
                        e.status == 409 && next.query.method == "POST" -> true
                        else -> false
                    }
                }
                lock.withLock {
                    val list = _pending.value
                    _pending.value = when {
                        outcome -> list.filterNot { it.id == next.id }
                        next.attempts + 1 >= MAX_ATTEMPTS -> list.filterNot { it.id == next.id }
                        else -> list.map { if (it.id == next.id) it.copy(attempts = it.attempts + 1) else it }
                    }
                    persist()
                }
                if (outcome) succeeded++ else if (_pending.value.firstOrNull()?.id == next.id) break
            }
        } finally {
            drainLock.unlock()
        }
        return succeeded
    }

    suspend fun clear() {
        lock.withLock { _pending.value = emptyList(); persist() }
    }

    private fun persist() {
        val store = file ?: return
        runCatching {
            val tmp = File(store.parentFile, store.name + ".tmp")
            tmp.writeText(Supabase.json.encodeToString(serializer, _pending.value))
            tmp.renameTo(store)
        }
    }

    /**
     * Typing offline would otherwise queue one write per pause. Two writes in a
     * row to the same row collapse into one: patches merge their fields, and a
     * single-row upsert replaces the one before it. Only the tail is ever
     * merged, so nothing moves ahead of a write it depends on.
     */
    private fun coalesce(previous: Query, next: Query): Query? {
        if (previous.table != next.table || previous.method != next.method || previous.params != next.params) return null
        val a = previous.body?.let(::parse) ?: return null
        val b = next.body?.let(::parse) ?: return null
        return when {
            next.method == "PATCH" && a is JsonObject && b is JsonObject ->
                next.copy(body = JsonObject(a + b).toString())
            next.method == "POST" && "resolution=merge-duplicates" in next.prefer && a is JsonArray && b is JsonArray &&
                a.size == 1 && b.size == 1 && rowId(a) != null && rowId(a) == rowId(b) -> next
            else -> null
        }
    }

    private fun parse(body: String) = runCatching { Supabase.json.parseToJsonElement(body) }.getOrNull()
    private fun rowId(rows: JsonArray) = (rows.firstOrNull()?.jsonObject?.get("id") as? JsonPrimitive)?.content
}
