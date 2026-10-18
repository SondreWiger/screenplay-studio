package no.northem.screenplaystudio.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.RowScope
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.TopAppBarScrollBehavior
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.ui.text.style.TextOverflow
import no.northem.screenplaystudio.data.Project
import no.northem.screenplaystudio.data.SupabaseException
import no.northem.screenplaystudio.ui.theme.SS

/** Projects already loaded by the list, so a hub opens without a spinner. */
object ProjectMemory {
    val byId = mutableStateMapOf<String, Project>()
}

fun friendly(e: Throwable): String = when {
    e is SupabaseException && e.offline -> "You're offline. Showing what's saved on this device."
    e is SupabaseException && e.status == 401 -> "Your session expired. Sign in again."
    e is SupabaseException && e.message?.contains("row-level security", true) == true ->
        "You don't have permission to change this."
    else -> e.message ?: "Something went wrong."
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SSTopBar(
    title: String,
    onBack: (() -> Unit)? = null,
    subtitle: String? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    CenterAlignedTopAppBar(
        title = {
            androidx.compose.foundation.layout.Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
                Text(title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.labelSmall, color = SS.textTertiary, maxLines = 1)
            }
        },
        navigationIcon = {
            if (onBack != null) IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
        },
        actions = actions,
        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = SS.background, scrolledContainerColor = SS.S900),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SSLargeTopBar(title: String, scroll: TopAppBarScrollBehavior, actions: @Composable RowScope.() -> Unit = {}) {
    LargeTopAppBar(
        title = { Text(title) },
        actions = actions,
        scrollBehavior = scroll,
        colors = TopAppBarDefaults.largeTopAppBarColors(containerColor = SS.background, scrolledContainerColor = SS.S900),
    )
}

/** "just now", "12 min ago", "3 h ago", "yesterday", then a date — for "edited" and "out since" lines. */
fun relativeTime(instant: java.time.Instant?, now: java.time.Instant = java.time.Instant.now()): String {
    if (instant == null) return ""
    val minutes = java.time.Duration.between(instant, now).toMinutes()
    return when {
        minutes < 1 -> "just now"
        minutes < 60 -> "$minutes min ago"
        minutes < 24 * 60 -> "${minutes / 60} h ago"
        minutes < 48 * 60 -> "yesterday"
        minutes < 7 * 24 * 60 -> "${minutes / (24 * 60)} days ago"
        else -> java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy")
            .format(instant.atZone(java.time.ZoneId.systemDefault()))
    }
}

fun View.tick() = performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
fun View.confirm() = performHapticFeedback(HapticFeedbackConstants.CONFIRM)

fun openUrl(context: Context, url: String) {
    if (url.startsWith("mailto:")) {
        context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse(url)))
        return
    }
    CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url))
}
