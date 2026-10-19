package no.northem.screenplaystudio.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.CleaningServices
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.MailOutline
import androidx.compose.material.icons.outlined.PrivacyTip
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.BuildConfig
import no.northem.screenplaystudio.data.Profile
import no.northem.screenplaystudio.data.Repository
import no.northem.screenplaystudio.data.Supabase
import no.northem.screenplaystudio.data.SyncQueue
import no.northem.screenplaystudio.ui.SSLargeTopBar
import no.northem.screenplaystudio.ui.components.AppMark
import no.northem.screenplaystudio.ui.components.Avatar
import no.northem.screenplaystudio.ui.components.SSCard
import no.northem.screenplaystudio.ui.friendly
import no.northem.screenplaystudio.ui.openUrl
import no.northem.screenplaystudio.ui.theme.SS

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen() {
    val session by Supabase.session.collectAsStateWithLifecycle()
    var profile by remember { mutableStateOf<Profile?>(null) }
    var confirmSignOut by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var cacheCleared by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    val pending by SyncQueue.pending.collectAsStateWithLifecycle()
    val syncScope = rememberCoroutineScope()

    LaunchedEffect(Unit) { profile = runCatching { Repository.fetchProfile() }.getOrNull() }

    Scaffold(
        modifier = Modifier.nestedScroll(scroll.nestedScrollConnection),
        containerColor = SS.background,
        topBar = { SSLargeTopBar("Settings", scroll) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
            Column(
                Modifier.widthIn(max = 720.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = SS.screenPadding),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                SSCard(glow = SS.accent) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(profile?.initials ?: "?", SS.accent, 52.dp)
                        Spacer(Modifier.width(14.dp))
                        Column {
                            Text(profile?.bestName ?: "Signed in", style = MaterialTheme.typography.titleMedium, color = SS.textPrimary)
                            Text(session?.user?.email ?: "", style = MaterialTheme.typography.bodySmall, color = SS.textTertiary)
                        }
                    }
                }

                Group("On the web") {
                    LinkRow("Open Screenplay Studio", Icons.Outlined.Language) { openUrl(context, BuildConfig.SITE_URL) }
                    LinkRow("Contact support", Icons.Outlined.MailOutline) { openUrl(context, "mailto:support@screenplaystudio.fun") }
                }

                Group("Data") {
                    // Writes made offline wait here until the device is back online.
                    LinkRow(
                        when (pending.size) {
                            0 -> "All changes synced"
                            1 -> "1 change waiting to sync — sync now"
                            else -> "${pending.size} changes waiting to sync — sync now"
                        },
                        if (pending.isEmpty()) Icons.Outlined.CloudDone else Icons.Outlined.CloudUpload,
                        tint = if (pending.isEmpty()) SS.textPrimary else SS.warning,
                        external = false,
                    ) { syncScope.launch { SyncQueue.drain() } }
                    LinkRow(if (cacheCleared) "Cache cleared" else "Clear cached data", Icons.Outlined.CleaningServices, external = false) {
                        Supabase.clearCache(); cacheCleared = true
                    }
                }

                Group("Legal") {
                    LinkRow("Privacy policy", Icons.Outlined.PrivacyTip) { openUrl(context, "${BuildConfig.SITE_URL}/legal/privacy") }
                    LinkRow("Terms of use", Icons.Outlined.Description) { openUrl(context, "${BuildConfig.SITE_URL}/legal/terms") }
                }

                Group("Account") {
                    LinkRow("Sign out", Icons.AutoMirrored.Outlined.Logout, external = false) { confirmSignOut = true }
                    LinkRow("Delete account", Icons.Outlined.DeleteForever, tint = SS.danger, external = false) { confirmDelete = true }
                }

                Column(Modifier.fillMaxWidth().padding(vertical = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    AppMark(36.dp)
                    Spacer(Modifier.size(8.dp))
                    Text("Screenplay Studio ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.bodySmall, color = SS.textTertiary)
                    Text("Northem Development · Oslo", style = MaterialTheme.typography.bodySmall, color = SS.textTertiary)
                }
                Spacer(Modifier.size(40.dp))
            }
        }
    }

    val scope = rememberCoroutineScope()
    if (confirmSignOut) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Sign out of Screenplay Studio?") },
            text = { Text("Cached projects on this device will be cleared.") },
            confirmButton = { TextButton(onClick = { confirmSignOut = false; scope.launch { Supabase.signOut() } }) { Text("Sign out", color = SS.danger) } },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancel") } },
            containerColor = SS.elevated,
        )
    }
    if (confirmDelete) DeleteAccountDialog(onDismiss = { confirmDelete = false })
}

/**
 * Required by both stores: an account made in the app can be deleted in the
 * app. Typing DELETE is the speed bump — this removes every project the user
 * owns, for every collaborator, and can't be undone.
 */
@Composable
private fun DeleteAccountDialog(onDismiss: () -> Unit) {
    var typed by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    androidx.compose.material3.AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Delete your account?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("This permanently deletes your account, your profile and every project you own — including scripts, scenes and schedules shared with your team. It can't be undone.")
                Text("Type DELETE to confirm.", color = SS.textSecondary)
                OutlinedTextField(typed, { typed = it }, singleLine = true, modifier = Modifier.fillMaxWidth())
                error?.let { Text(it, color = SS.danger) }
            }
        },
        confirmButton = {
            TextButton(
                enabled = typed.trim() == "DELETE" && !busy,
                onClick = {
                    busy = true
                    scope.launch {
                        try { Supabase.deleteAccount() } catch (e: Exception) { error = friendly(e); busy = false }
                    }
                },
            ) { Text(if (busy) "Deleting…" else "Delete account", color = SS.danger) }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !busy) { Text("Cancel") } },
        containerColor = SS.elevated,
    )
}

@Composable
private fun Group(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title.uppercase(), style = MaterialTheme.typography.labelSmall, color = SS.textTertiary, modifier = Modifier.padding(start = 4.dp))
        SSCard(padding = PaddingValues(vertical = 4.dp)) { content() }
    }
}

@Composable
private fun LinkRow(title: String, icon: ImageVector, tint: Color = SS.textPrimary, external: Boolean = true, onClick: () -> Unit) {
    TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = androidx.compose.foundation.shape.RoundedCornerShape(0.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = if (tint == SS.textPrimary) SS.textSecondary else tint)
            Spacer(Modifier.width(14.dp))
            Text(title, color = tint, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            if (external) Icon(Icons.AutoMirrored.Outlined.OpenInNew, null, Modifier.size(16.dp), tint = SS.textTertiary)
        }
    }
}
