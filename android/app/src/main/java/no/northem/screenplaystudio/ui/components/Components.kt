package no.northem.screenplaystudio.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import no.northem.screenplaystudio.ui.theme.SS

/** The Screenplay Studio mark, drawn so it stays sharp at any size. */
@Composable
fun AppMark(size: Dp = 56.dp) {
    Box(
        Modifier
            .size(size)
            .clip(RoundedCornerShape(size * 0.24f))
            .background(Brush.linearGradient(listOf(SS.Brand500, SS.Brand700))),
        contentAlignment = Alignment.Center,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(size * 0.12f)) {
            listOf(0.62f, 0.5f, 0.56f).forEach { w ->
                Box(
                    Modifier
                        .size(width = size * w, height = maxOf(2.dp, size * 0.055f))
                        .clip(CircleShape)
                        .background(Color.White)
                )
            }
        }
    }
}

/** The standard raised container — one corner radius everywhere. */
@Composable
fun SSCard(
    modifier: Modifier = Modifier,
    glow: Color? = null,
    onClick: (() -> Unit)? = null,
    padding: PaddingValues = PaddingValues(14.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(SS.radius)
    var m = modifier
        .fillMaxWidth()
        .clip(shape)
        .background(SS.card)
    if (glow != null) {
        m = m.background(Brush.radialGradient(listOf(glow.copy(alpha = 0.22f), Color.Transparent), radius = 900f, center = androidx.compose.ui.geometry.Offset.Zero))
    }
    m = m.border(1.dp, SS.border, shape)
    if (onClick != null) m = m.clickable(onClick = onClick)
    Column(m.padding(padding), content = content)
}

@Composable
fun PrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, loading: Boolean = false) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.fillMaxWidth().heightIn(min = 52.dp),
        shape = RoundedCornerShape(SS.radius),
        colors = ButtonDefaults.buttonColors(containerColor = SS.accent, contentColor = Color.White, disabledContainerColor = SS.accent.copy(alpha = 0.4f)),
    ) {
        if (loading) {
            androidx.compose.material3.CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
        } else {
            Text(text, style = MaterialTheme.typography.titleMedium)
        }
    }
}

@Composable
fun SecondaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = 52.dp),
        shape = RoundedCornerShape(SS.radius),
        border = BorderStroke(1.dp, SS.border),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = SS.elevated, contentColor = SS.textPrimary),
    ) { Text(text, style = MaterialTheme.typography.titleSmall) }
}

/** A readable foreground for text drawn on top of [this]. */
val Color.readableForeground: Color get() = if (luminance() > 0.6f) SS.S950 else Color.White

@Composable
fun Chip(text: String, tint: Color = SS.textSecondary, prominent: Boolean = false, icon: ImageVector? = null) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(if (prominent) tint else tint.copy(alpha = 0.14f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        val fg = if (prominent) tint.readableForeground else tint
        if (icon != null) Icon(icon, null, Modifier.size(12.dp), tint = fg)
        Text(text, style = MaterialTheme.typography.labelMedium, color = fg, maxLines = 1)
    }
}

@Composable
fun FilterPill(text: String, selected: Boolean, tint: Color = SS.textSecondary, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = if (selected) tint else SS.card,
        border = if (selected) null else BorderStroke(1.dp, SS.border),
        modifier = Modifier.heightIn(min = 36.dp),
    ) {
        Box(Modifier.padding(horizontal = 14.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
            Text(text, style = MaterialTheme.typography.labelLarge, color = if (selected) tint.readableForeground else SS.textSecondary)
        }
    }
}

@Composable
fun SectionHeader(title: String, subtitle: String? = null, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = SS.textPrimary)
            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = SS.textTertiary)
        }
        if (action != null && onAction != null) {
            androidx.compose.material3.TextButton(onClick = onAction) { Text(action, color = SS.accent) }
        }
    }
}

@Composable
fun EmptyState(icon: ImageVector, title: String, message: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Column(
        Modifier.fillMaxWidth().padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier.size(72.dp).clip(CircleShape).background(SS.accentSoft),
            contentAlignment = Alignment.Center,
        ) { Icon(icon, null, Modifier.size(34.dp), tint = SS.Brand400) }
        Text(title, style = MaterialTheme.typography.titleMedium, color = SS.textPrimary, textAlign = TextAlign.Center)
        Text(message, style = MaterialTheme.typography.bodyMedium, color = SS.textSecondary, textAlign = TextAlign.Center)
        if (action != null && onAction != null) {
            PrimaryButton(action, onAction, Modifier.widthIn(max = 260.dp).padding(top = 4.dp))
        }
    }
}

@Composable
fun ErrorState(message: String, onRetry: (() -> Unit)? = null) {
    Column(
        Modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(Icons.Outlined.WarningAmber, null, Modifier.size(32.dp), tint = SS.warning)
        Text(message, style = MaterialTheme.typography.bodyMedium, color = SS.textSecondary, textAlign = TextAlign.Center)
        if (onRetry != null) SecondaryButton("Try again", onRetry, Modifier.widthIn(max = 200.dp))
    }
}

/** Shimmering placeholder rows; the layout doesn't jump when content arrives. */
@Composable
fun SkeletonList(rows: Int = 5) {
    val t = rememberInfiniteTransition(label = "shimmer")
    val x by t.animateFloat(-600f, 1400f, infiniteRepeatable(tween(1400, easing = LinearEasing), RepeatMode.Restart), label = "x")
    Column(Modifier.semantics { contentDescription = "Loading" }, verticalArrangement = Arrangement.spacedBy(SS.rowSpacing)) {
        repeat(rows) { i ->
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(76.dp)
                    .clip(RoundedCornerShape(SS.radius))
                    .background(SS.card.copy(alpha = 1f - i * 0.12f))
                    .background(
                        Brush.linearGradient(
                            listOf(Color.Transparent, Color.White.copy(alpha = 0.05f), Color.Transparent),
                            start = androidx.compose.ui.geometry.Offset(x, 0f),
                            end = androidx.compose.ui.geometry.Offset(x + 400f, 0f),
                        )
                    )
            )
        }
    }
}

@Composable
fun ProgressBar(fraction: Float, tint: Color = SS.accent, height: Dp = 6.dp) {
    Box(Modifier.fillMaxWidth().height(height).clip(CircleShape).background(Color.White.copy(alpha = 0.08f))) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).fillMaxSize().clip(CircleShape).background(tint))
    }
}

@Composable
fun StatCell(value: String, label: String, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleLarge, color = SS.textPrimary)
        Text(label, style = MaterialTheme.typography.bodySmall, color = SS.textTertiary)
    }
}

/** A rounded tinted square holding an icon — used for tool rows. */
@Composable
fun IconTile(icon: ImageVector, tint: Color, size: Dp = 44.dp) {
    Box(
        Modifier.size(size).clip(RoundedCornerShape(12.dp)).background(tint.copy(alpha = 0.16f)),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, null, Modifier.size(size * 0.5f), tint = tint) }
}

@Composable
fun Avatar(initials: String, color: Color, size: Dp = 44.dp) {
    Box(Modifier.size(size).clip(CircleShape).background(color), contentAlignment = Alignment.Center) {
        Text(initials, style = MaterialTheme.typography.titleSmall, color = color.readableForeground, maxLines = 1, overflow = TextOverflow.Clip)
    }
}

@Composable
fun Spacer(height: Dp) = androidx.compose.foundation.layout.Spacer(Modifier.height(height))

/** Centres content within [maxWidth] on tablets and pads it on phones. */
fun Modifier.screenWidth(maxWidth: Dp = SS.readableWidth) =
    this.fillMaxWidth().widthIn(max = maxWidth).padding(horizontal = SS.screenPadding)

fun parseHexColor(hex: String?, fallback: Color = SS.accent): Color {
    var s = hex?.trim()?.removePrefix("#") ?: return fallback
    if (s.length == 3) s = s.map { "$it$it" }.joinToString("")
    if (s.length != 6) return fallback
    return s.toLongOrNull(16)?.let { Color(0xFF000000 or it) } ?: fallback
}
