package no.northem.screenplaystudio.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@Serializable
data class AuthUser(
    val id: String,
    val email: String? = null,
)

@Serializable
data class AuthSession(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_at") val expiresAt: Long? = null,
    @SerialName("expires_in") val expiresIn: Long? = null,
    val user: AuthUser,
) {
    /** Treat the token as expired a minute early so a request never races it. */
    val isExpired: Boolean
        get() = (expiresAt ?: 0L) - 60 <= System.currentTimeMillis() / 1000

    /** GoTrue sometimes omits `expires_at`; derive it from `expires_in`. */
    fun normalised(): AuthSession =
        if (expiresAt != null) this
        else copy(expiresAt = System.currentTimeMillis() / 1000 + (expiresIn ?: 3600))
}

/**
 * Keeps the auth session in SharedPreferences, encrypted with an AES-GCM key
 * that lives in the Android Keystore and never leaves it. The file is excluded
 * from backups (res/xml/backup_rules.xml) because a restored copy could not be
 * decrypted on another device anyway.
 */
class SessionStore(context: Context) {

    private val prefs = context.getSharedPreferences("ss_session", Context.MODE_PRIVATE)

    fun load(): AuthSession? {
        val stored = prefs.getString(KEY, null) ?: return null
        return runCatching {
            val bytes = Base64.decode(stored, Base64.NO_WRAP)
            val iv = bytes.copyOfRange(0, 12)
            val cipher = Cipher.getInstance(TRANSFORM)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            val json = String(cipher.doFinal(bytes, 12, bytes.size - 12))
            Supabase.json.decodeFromString(AuthSession.serializer(), json)
        }.getOrElse {
            // A key invalidated by a lock-screen change, or a corrupt file:
            // either way the only safe move is to ask for a fresh sign-in.
            clear()
            null
        }
    }

    fun save(session: AuthSession) {
        val json = Supabase.json.encodeToString(AuthSession.serializer(), session)
        val cipher = Cipher.getInstance(TRANSFORM)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val sealed = cipher.iv + cipher.doFinal(json.toByteArray())
        prefs.edit().putString(KEY, Base64.encodeToString(sealed, Base64.NO_WRAP)).apply()
    }

    fun clear() {
        prefs.edit().remove(KEY).apply()
    }

    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    private companion object {
        const val KEY = "session"
        const val ALIAS = "ss.session.key"
        const val TRANSFORM = "AES/GCM/NoPadding"
    }
}
