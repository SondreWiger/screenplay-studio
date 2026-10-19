package no.northem.screenplaystudio.ui.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.BuildConfig
import no.northem.screenplaystudio.data.Supabase
import no.northem.screenplaystudio.ui.components.AppMark
import no.northem.screenplaystudio.ui.components.PrimaryButton
import no.northem.screenplaystudio.ui.components.SSCard
import no.northem.screenplaystudio.ui.friendly
import no.northem.screenplaystudio.ui.openUrl
import no.northem.screenplaystudio.ui.theme.SS

private enum class Mode { SIGN_IN, SIGN_UP, RESET }

@Composable
fun SignInScreen() {
    var mode by rememberSaveable { mutableStateOf(Mode.SIGN_IN) }
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val canSubmit = email.contains("@") && when (mode) {
        Mode.SIGN_IN -> password.isNotEmpty()
        Mode.SIGN_UP -> password.length >= 6
        Mode.RESET -> true
    }

    fun submit() {
        if (!canSubmit || busy) return
        busy = true; error = null; notice = null
        scope.launch {
            try {
                when (mode) {
                    Mode.SIGN_IN -> Supabase.signIn(email, password)
                    Mode.SIGN_UP -> if (!Supabase.signUp(email, password, name)) {
                        notice = "Check $email for a link to confirm your account, then sign in."
                        mode = Mode.SIGN_IN
                    }
                    Mode.RESET -> {
                        Supabase.sendPasswordReset(email)
                        notice = "If there's an account for $email, a reset link is on its way."
                        mode = Mode.SIGN_IN
                    }
                }
            } catch (e: Exception) {
                error = if (e.message?.contains("Invalid login", true) == true) "That email and password don't match an account." else friendly(e)
            } finally {
                busy = false
            }
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(SS.Brand500.copy(alpha = 0.18f), SS.background, SS.background)))
            .safeDrawingPadding()
            .imePadding(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .widthIn(max = 440.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            AppMark(72.dp)
            Text("Screenplay Studio", style = MaterialTheme.typography.headlineMedium, color = SS.textPrimary)
            Text(
                when (mode) {
                    Mode.SIGN_IN -> "Your scripts, scenes and schedule — wherever you are."
                    Mode.SIGN_UP -> "Create an account to start writing."
                    Mode.RESET -> "We'll email you a link to set a new password."
                },
                style = MaterialTheme.typography.bodyMedium, color = SS.textSecondary, textAlign = TextAlign.Center,
            )

            AnimatedVisibility(notice != null) {
                SSCard(glow = SS.success) { Text(notice.orEmpty(), color = SS.textPrimary, style = MaterialTheme.typography.bodyMedium) }
            }

            if (mode == Mode.SIGN_UP) {
                Field("Name", name, { name = it }, Icons.Outlined.Person, KeyboardType.Text)
            }
            Field("Email", email, { email = it.trim() }, Icons.Outlined.Email, KeyboardType.Email)
            if (mode != Mode.RESET) {
                Field(
                    "Password", password, { password = it }, Icons.Outlined.Lock, KeyboardType.Password,
                    secure = !showPassword,
                    imeAction = ImeAction.Go,
                    onGo = ::submit,
                    trailing = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, if (showPassword) "Hide password" else "Show password")
                        }
                    },
                )
            }

            if (error != null) Text(error.orEmpty(), color = SS.danger, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)

            PrimaryButton(
                when (mode) { Mode.SIGN_IN -> "Sign in"; Mode.SIGN_UP -> "Create account"; Mode.RESET -> "Send reset link" },
                ::submit, enabled = canSubmit, loading = busy,
            )

            when (mode) {
                Mode.SIGN_IN -> {
                    TextButton(onClick = { mode = Mode.SIGN_UP; error = null }) { Text("New here? Create an account", color = SS.accent) }
                    TextButton(onClick = { mode = Mode.RESET; error = null }) { Text("Forgot password?", color = SS.textSecondary) }
                }
                else -> TextButton(onClick = { mode = Mode.SIGN_IN; error = null }) { Text("Back to sign in", color = SS.accent) }
            }

            Text(
                if (mode == Mode.SIGN_UP) "By creating an account you agree to the Terms of use and Privacy policy." else "Privacy policy · Terms of use",
                style = MaterialTheme.typography.bodySmall, color = SS.textTertiary, textAlign = TextAlign.Center,
            )
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = { openUrl(context, "${BuildConfig.SITE_URL}/legal/privacy") }) { Text("Privacy", color = SS.textSecondary) }
                TextButton(onClick = { openUrl(context, "${BuildConfig.SITE_URL}/legal/terms") }) { Text("Terms", color = SS.textSecondary) }
            }
        }
    }
}

@Composable
private fun Field(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    icon: ImageVector,
    type: KeyboardType,
    secure: Boolean = false,
    imeAction: ImeAction = ImeAction.Next,
    onGo: () -> Unit = {},
    trailing: (@Composable () -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        leadingIcon = { Icon(icon, null) },
        trailingIcon = trailing,
        singleLine = true,
        visualTransformation = if (secure && type == KeyboardType.Password) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = type, imeAction = imeAction, autoCorrectEnabled = false),
        keyboardActions = KeyboardActions(onGo = { onGo() }),
        shape = RoundedCornerShape(SS.radius),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = SS.elevated, unfocusedContainerColor = SS.elevated,
            focusedBorderColor = SS.accent, unfocusedBorderColor = SS.border,
            focusedLeadingIconColor = SS.accent, focusedLabelColor = SS.accent,
        ),
        modifier = Modifier.fillMaxWidth(),
    )
}
