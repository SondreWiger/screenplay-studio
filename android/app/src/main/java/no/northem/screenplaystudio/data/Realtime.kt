package no.northem.screenplaystudio.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.SendChannel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.buffer
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import no.northem.screenplaystudio.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.math.min
import kotlin.math.pow

/** One row-level change delivered by Supabase Realtime. */
data class RealtimeChange(
    val kind: Kind,
    val table: String,
    /** The new row. Absent on delete. */
    val record: JsonObject?,
    /** The previous row; on delete just the primary key unless REPLICA IDENTITY FULL. */
    val oldRecord: JsonObject?,
) {
    enum class Kind { INSERT, UPDATE, DELETE }

    fun <T> decoded(serializer: KSerializer<T>): T? =
        record?.let { runCatching { Supabase.json.decodeFromJsonElement(serializer, it) }.getOrNull() }

    val recordId: String?
        get() = listOf(record, oldRecord).firstNotNullOfOrNull { (it?.get("id") as? JsonPrimitive)?.content }
}

/**
 * A live connection to Supabase Realtime — the Kotlin twin of
 * RealtimeClient.swift. Speaks the Phoenix channel protocol over an OkHttp
 * WebSocket: one socket, a topic per subscription, heartbeats every 25s and
 * reconnection with backoff (1s, 2s, 4s … capped at a minute).
 *
 * Screens collect [changes] from their ViewModel scope; cancelling the
 * collection leaves the channel, and the socket closes with the last one.
 */
@OptIn(ExperimentalCoroutinesApi::class)
object Realtime {

    private class Subscription(val topic: String, val table: String, val filter: String?, val sink: SendChannel<RealtimeChange>)

    // Every bit of socket state is touched on this one serial dispatcher.
    private val serial = Dispatchers.IO.limitedParallelism(1)
    private val scope = CoroutineScope(SupervisorJob() + serial)

    private val http = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    private val subscriptions = mutableMapOf<String, Subscription>()
    private var socket: WebSocket? = null
    private var heartbeat: Job? = null
    private var reconnect: Job? = null
    private var attempt = 0
    private var ref = 0
    private var tokenWatcher: Job? = null

    /** Changes to one table, optionally narrowed by a filter such as `project_id=eq.<uuid>`. */
    fun changes(table: String, filter: String? = null): Flow<RealtimeChange> {
        if (Supabase.demo) return emptyFlow()
        return callbackFlow {
            val topic = "realtime:android-$table-${UUID.randomUUID().toString().take(8)}"
            val subscription = Subscription(topic, table, filter, channel)
            scope.launch {
                subscriptions[topic] = subscription
                if (socket == null) connect() else join(subscription)
            }
            awaitClose { scope.launch { leave(topic) } }
        }.buffer(Channel.UNLIMITED)
    }

    /** Back online: skip the rest of the backoff. */
    fun reconnectNow() {
        scope.launch {
            if (socket != null || subscriptions.isEmpty()) return@launch
            reconnect?.cancel()
            attempt = 0
            connect()
        }
    }

    private fun connect() {
        val base = BuildConfig.SUPABASE_URL.trimEnd('/').replaceFirst("https://", "wss://").replaceFirst("http://", "ws://")
        val url = "$base/realtime/v1/websocket?apikey=${BuildConfig.SUPABASE_ANON_KEY}&vsn=1.0.0"
        socket = http.newWebSocket(Request.Builder().url(url).build(), Listener())
        watchToken()
        startHeartbeat()
        // Joins queue in OkHttp until the socket opens, so they go out at once.
        subscriptions.values.forEach { join(it) }
    }

    private fun join(subscription: Subscription) = scope.launch {
        // Row-level security evaluates the user's JWT; fall back to the anon key
        // so the channel still joins while a refresh is in flight.
        val token = runCatching { Supabase.validAccessToken() }.getOrDefault(BuildConfig.SUPABASE_ANON_KEY)
        val r = nextRef()
        send(buildJsonObject {
            put("topic", subscription.topic)
            put("event", "phx_join")
            put("ref", r)
            put("join_ref", r)
            putJsonObject("payload") {
                putJsonObject("config") {
                    putJsonObject("broadcast") { put("self", false) }
                    putJsonObject("presence") { put("key", "") }
                    put("postgres_changes", JsonArray(listOf(buildJsonObject {
                        put("event", "*")
                        put("schema", "public")
                        put("table", subscription.table)
                        subscription.filter?.let { put("filter", it) }
                    })))
                }
                put("access_token", token)
            }
        })
    }

    private fun leave(topic: String) {
        subscriptions.remove(topic) ?: return
        send(buildJsonObject {
            put("topic", topic); put("event", "phx_leave"); put("payload", JsonObject(emptyMap())); put("ref", nextRef())
        })
        // Nothing left to listen for: drop the socket rather than hold it open.
        if (subscriptions.isEmpty()) disconnect()
    }

    private fun disconnect() {
        heartbeat?.cancel(); heartbeat = null
        reconnect?.cancel(); reconnect = null
        tokenWatcher?.cancel(); tokenWatcher = null
        socket?.close(1000, null)
        socket = null
    }

    private fun startHeartbeat() {
        heartbeat?.cancel()
        heartbeat = scope.launch {
            while (true) {
                delay(25_000)
                send(buildJsonObject {
                    put("topic", "phoenix"); put("event", "heartbeat"); put("payload", JsonObject(emptyMap())); put("ref", nextRef())
                })
            }
        }
    }

    /** A refreshed token is pushed to every channel so the server keeps authorising it. */
    private fun watchToken() {
        if (tokenWatcher != null) return
        tokenWatcher = scope.launch {
            var first = true
            Supabase.session.map { it?.accessToken }.distinctUntilChanged().collect { token ->
                if (first) { first = false; return@collect }
                if (token == null || socket == null) return@collect
                subscriptions.values.forEach { s ->
                    send(buildJsonObject {
                        put("topic", s.topic); put("event", "access_token"); put("ref", nextRef())
                        putJsonObject("payload") { put("access_token", token) }
                    })
                }
            }
        }
    }

    private fun dropped(from: WebSocket) {
        if (from !== socket) return
        heartbeat?.cancel(); heartbeat = null
        socket = null
        if (subscriptions.isEmpty()) return
        attempt = min(attempt + 1, 7)
        val wait = min(2.0.pow(attempt - 1), 60.0)
        reconnect?.cancel()
        reconnect = scope.launch {
            delay((wait * 1000).toLong())
            if (socket == null && subscriptions.isNotEmpty()) connect()
        }
    }

    private fun handle(text: String) {
        val envelope = runCatching { Supabase.json.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
        if ((envelope["event"] as? JsonPrimitive)?.content != "postgres_changes") return
        val topic = (envelope["topic"] as? JsonPrimitive)?.content ?: return
        val data = (envelope["payload"] as? JsonObject)?.get("data") as? JsonObject ?: return
        val kind = runCatching { RealtimeChange.Kind.valueOf((data["type"] as JsonPrimitive).content) }.getOrNull() ?: return
        val table = (data["table"] as? JsonPrimitive)?.content ?: return
        val change = RealtimeChange(kind, table, data["record"] as? JsonObject, data["old_record"] as? JsonObject)
        subscriptions[topic]?.sink?.trySend(change)
    }

    private fun send(message: JsonObject) {
        socket?.send(message.toString())
    }

    private fun nextRef(): String = (++ref).toString()

    private class Listener : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            scope.launch { if (webSocket === socket) attempt = 0 }
        }
        override fun onMessage(webSocket: WebSocket, text: String) {
            scope.launch { handle(text) }
        }
        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            scope.launch { dropped(webSocket) }
        }
        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            scope.launch { dropped(webSocket) }
        }
    }
}

/**
 * Applies a realtime change to a list — LiveMerge.swift. The server is right
 * about rows the user isn't editing; [skip] names the ones they are, so a
 * remote update can't overwrite something still being typed. Returns null
 * when nothing changed, so callers don't redraw for their own echoes.
 */
fun <T> List<T>.merged(
    change: RealtimeChange,
    serializer: KSerializer<T>,
    id: (T) -> String,
    skip: (String) -> Boolean = { false },
    sort: Comparator<T>? = null,
): List<T>? {
    val result: List<T> = when (change.kind) {
        RealtimeChange.Kind.INSERT -> {
            val row = change.decoded(serializer) ?: return null
            if (any { id(it) == id(row) }) return null
            this + row
        }
        RealtimeChange.Kind.UPDATE -> {
            val row = change.decoded(serializer) ?: return null
            if (skip(id(row))) return null
            val index = indexOfFirst { id(it) == id(row) }
            when {
                index < 0 -> this + row // Just became visible to this user.
                this[index] == row -> return null
                else -> toMutableList().also { it[index] = row }
            }
        }
        RealtimeChange.Kind.DELETE -> {
            val gone = change.recordId ?: return null
            if (skip(gone) || none { id(it) == gone }) return null
            filterNot { id(it) == gone }
        }
    }
    return if (sort != null) result.sortedWith(sort) else result
}
