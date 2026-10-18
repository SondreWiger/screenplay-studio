package no.northem.screenplaystudio.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import no.northem.screenplaystudio.BuildConfig
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.IOException
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit
import kotlin.math.pow

class SupabaseException(
    message: String,
    val status: Int = 0,
    val offline: Boolean = false,
) : Exception(message)

/**
 * The slice of GoTrue and PostgREST the app uses, over OkHttp — the same
 * shape as Core/Networking/Supabase.swift on iOS. No Supabase SDK: it keeps
 * the APK small and the behaviour identical across both apps.
 */
object Supabase {

    val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
        isLenient = true
    }

    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
    private val anonKey = BuildConfig.SUPABASE_ANON_KEY
    private val jsonType = "application/json".toMediaType()

    private lateinit var store: SessionStore
    private lateinit var cacheDir: File
    private val refreshLock = Mutex()

    private val _session = MutableStateFlow<AuthSession?>(null)
    val session: StateFlow<AuthSession?> = _session.asStateFlow()
    val userId: String? get() = _session.value?.user?.id

    /** DEBUG builds only: canned data, no network. See DemoData.kt. */
    var demo = false
        private set

    fun init(context: Context, demoMode: Boolean) {
        store = SessionStore(context)
        cacheDir = File(context.cacheDir, "supabase").apply { mkdirs() }
        demo = demoMode && BuildConfig.DEBUG
        _session.value = if (demo) DemoData.session else store.load()
    }

    // region Auth

    suspend fun signIn(email: String, password: String) {
        val body = buildJsonObject {
            put("email", email.trim())
            put("password", password)
        }
        val raw = auth("token?grant_type=password", body)
        setSession(json.decodeFromString(AuthSession.serializer(), raw).normalised())
    }

    /** Returns false when the project requires the email to be confirmed first. */
    suspend fun signUp(email: String, password: String, fullName: String): Boolean {
        val body = buildJsonObject {
            put("email", email.trim())
            put("password", password)
            if (fullName.isNotBlank()) putJsonObject("data") { put("full_name", fullName.trim()) }
        }
        val raw = auth("signup", body)
        val session = runCatching { json.decodeFromString(AuthSession.serializer(), raw).normalised() }.getOrNull()
        session?.let(::setSession)
        return session != null
    }

    suspend fun sendPasswordReset(email: String) {
        auth("recover", buildJsonObject { put("email", email.trim()) })
    }

    suspend fun signOut() {
        val token = _session.value?.accessToken
        if (!demo && token != null) {
            // Best effort: a failed server-side revoke must never trap the
            // user in a signed-in state on the device.
            runCatching {
                send(
                    Request.Builder().url("$baseUrl/auth/v1/logout")
                        .header("apikey", anonKey).header("Authorization", "Bearer $token")
                        .post(ByteArray(0).toRequestBody()).build()
                )
            }
        }
        setSession(null)
        clearCache()
    }

    /** Permanently deletes the account through the website's API route. */
    suspend fun deleteAccount() {
        if (!demo) {
            val token = validAccessToken()
            send(
                Request.Builder().url("${BuildConfig.SITE_URL}/api/user/delete-account")
                    .header("Authorization", "Bearer $token")
                    .post("{}".toRequestBody(jsonType)).build()
            )
        }
        setSession(null)
        clearCache()
    }

    suspend fun validAccessToken(): String {
        if (demo) return "demo"
        val current = _session.value ?: throw SupabaseException("Sign in to continue.", 401)
        if (!current.isExpired) return current.accessToken
        return refreshLock.withLock {
            // Another caller may have refreshed while this one waited.
            _session.value?.takeIf { !it.isExpired }?.let { return@withLock it.accessToken }
            try {
                val raw = auth(
                    "token?grant_type=refresh_token",
                    buildJsonObject { put("refresh_token", current.refreshToken) },
                )
                val refreshed = json.decodeFromString(AuthSession.serializer(), raw).normalised()
                setSession(refreshed)
                refreshed.accessToken
            } catch (e: SupabaseException) {
                if (e.status == 400 || e.status == 401) {
                    setSession(null)
                    throw SupabaseException("Your session expired. Sign in again.", 401)
                }
                throw e
            }
        }
    }

    private fun setSession(session: AuthSession?) {
        _session.value = session
        if (demo) return
        if (session != null) store.save(session) else store.clear()
    }

    private suspend fun auth(path: String, body: JsonObject): String {
        if (demo) return json.encodeToString(AuthSession.serializer(), DemoData.session)
        return send(
            Request.Builder().url("$baseUrl/auth/v1/$path")
                .header("apikey", anonKey)
                .post(body.toString().toRequestBody(jsonType)).build()
        )
    }

    // endregion

    // region PostgREST

    /**
     * Runs a read and decodes it. A row that fails to decode is skipped rather
     * than failing the whole list — one odd row must not blank a screen.
     */
    suspend fun <T> select(query: Query, serializer: KSerializer<T>, cache: Boolean = true): List<T> {
        val raw = execute(query)
        if (cache) writeCache(query, raw)
        return decodeList(raw, serializer)
    }

    /** The last good response for this exact query, for painting before the network answers. */
    fun <T> cached(query: Query, serializer: KSerializer<T>): List<T>? {
        val file = cacheFile(query)
        if (!file.exists()) return null
        return runCatching { decodeList(file.readText(), serializer) }.getOrNull()
    }

    fun <T> decodeList(raw: String, serializer: KSerializer<T>): List<T> {
        if (raw.isBlank()) return emptyList()
        return runCatching { json.decodeFromString(ListSerializer(serializer), raw) }.getOrElse {
            json.parseToJsonElement(raw).jsonArray.mapNotNull { element ->
                runCatching { json.decodeFromJsonElement(serializer, element) }.getOrNull()
            }
        }
    }

    suspend fun execute(query: Query): String {
        if (demo) return DemoData.respond(query)
        val token = validAccessToken()
        val url = "$baseUrl/rest/v1/${query.table}".toHttpUrl().newBuilder().apply {
            query.params.forEach { (k, v) -> addQueryParameter(k, v) }
        }.build()
        val builder = Request.Builder().url(url)
            .header("apikey", anonKey)
            .header("Authorization", "Bearer $token")
            .header("Content-Type", "application/json")
        val prefer = query.prefer.toMutableList()
        if (query.method == "GET" && query.range != null) {
            builder.header("Range", query.range)
            prefer += "count=exact"
        }
        if (prefer.isNotEmpty()) builder.header("Prefer", prefer.joinToString(","))
        val body = query.body?.toRequestBody(jsonType)
        builder.method(query.method, body ?: if (query.method == "GET") null else ByteArray(0).toRequestBody())
        return send(builder.build())
    }

    // endregion

    // region Transport

    /** Sends with up to two retries on transient failures (0.4s, 1.2s). */
    private suspend fun send(request: Request): String = withContext(Dispatchers.IO) {
        var last: SupabaseException = SupabaseException("Request failed.")
        repeat(3) { attempt ->
            if (attempt > 0) delay((400 * 3.0.pow(attempt - 1)).toLong())
            try {
                http.newCall(request).execute().use { response ->
                    val text = response.body.string()
                    if (response.isSuccessful) return@withContext text
                    val error = SupabaseException(errorMessage(text, response.code), response.code)
                    if (response.code < 500 && response.code != 408 && response.code != 429) throw error
                    last = error
                }
            } catch (e: UnknownHostException) {
                throw SupabaseException("You're offline.", offline = true)
            } catch (e: SupabaseException) {
                throw e
            } catch (e: IOException) {
                last = SupabaseException(e.message ?: "Network error.", offline = true)
            }
        }
        throw last
    }

    private fun errorMessage(body: String, status: Int): String {
        val obj = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull()
        if (obj != null) {
            for (key in listOf("message", "error_description", "msg", "hint", "details", "error")) {
                val value = (obj[key] as? JsonPrimitive)?.takeIf { it.isString }?.content
                if (!value.isNullOrBlank()) return value
            }
        }
        return if (status == 401) "Your session expired. Sign in again." else "Something went wrong (HTTP $status)."
    }

    // endregion

    // region Cache

    private fun cacheFile(query: Query): File {
        val key = (query.table + query.params.joinToString("&") { "${it.first}=${it.second}" })
            .hashCode().toUInt().toString(16)
        return File(cacheDir, "${query.table}-$key.json")
    }

    private fun writeCache(query: Query, raw: String) {
        if (query.method != "GET") return
        runCatching { cacheFile(query).writeText(raw) }
    }

    /** For lists whose query isn't stable (the project list depends on memberships). */
    fun <T> writeKeyed(key: String, rows: List<T>, serializer: KSerializer<T>) {
        runCatching { cacheFile(Query(key)).writeText(json.encodeToString(ListSerializer(serializer), rows)) }
    }

    fun clearCache() {
        runCatching { cacheDir.listFiles()?.forEach(File::delete) }
    }

    // endregion
}

/** Builds a JSON array body from objects — PostgREST inserts take arrays. */
fun jsonArrayOf(vararg objects: JsonObject): String = JsonArray(objects.toList()).toString()

