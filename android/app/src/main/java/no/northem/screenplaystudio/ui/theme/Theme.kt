package no.northem.screenplaystudio.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Design tokens mirrored from the web app's CSS custom properties
 * (src/app/globals.css) and Theme.swift, so Android, iOS and the website read
 * as one product.
 */
object SS {
    val S50 = Color(0xFFF4F4FC)
    val S300 = Color(0xFFB0B0CC)
    val S400 = Color(0xFF8888AA)
    val S600 = Color(0xFF3A3A56)
    val S700 = Color(0xFF24243A)
    val S800 = Color(0xFF181828)
    val S900 = Color(0xFF0F0F1C)
    val S950 = Color(0xFF070710)

    val Brand300 = Color(0xFFFCBA64)
    val Brand400 = Color(0xFFFF8C46)
    val Brand500 = Color(0xFFFF5F1F)
    val Brand600 = Color(0xFFE54E15)
    val Brand700 = Color(0xFFCC4312)

    val background = S950
    val card = S900
    val elevated = S800
    val border = Color.White.copy(alpha = 0.08f)
    val borderStrong = Color.White.copy(alpha = 0.16f)

    val accent = Brand500
    val accentSoft = Brand500.copy(alpha = 0.16f)

    val textPrimary = S50
    val textSecondary = S300
    val textTertiary = S400

    val success = Color(0xFF10B981)
    val warning = Color(0xFFF59E0B)
    val danger = Color(0xFFEF4444)

    val radius = 14.dp
    val radiusSmall = 10.dp
    val rowSpacing = 10.dp
    val screenPadding = 16.dp
    /** Widest a column of text or cards gets on a tablet. */
    val readableWidth = 820.dp
    val wideWidth = 1180.dp
    val minTouch = 48.dp
}

private val colors: ColorScheme = darkColorScheme(
    primary = SS.Brand500,
    onPrimary = Color.White,
    primaryContainer = SS.accentSoft,
    onPrimaryContainer = SS.Brand300,
    secondary = SS.Brand400,
    onSecondary = Color.White,
    background = SS.background,
    onBackground = SS.textPrimary,
    surface = SS.background,
    onSurface = SS.textPrimary,
    surfaceVariant = SS.card,
    onSurfaceVariant = SS.textSecondary,
    surfaceContainerLowest = SS.S950,
    surfaceContainerLow = SS.S900,
    surfaceContainer = SS.S900,
    surfaceContainerHigh = SS.S800,
    surfaceContainerHighest = SS.S700,
    secondaryContainer = SS.accentSoft,
    onSecondaryContainer = SS.Brand300,
    outline = SS.borderStrong,
    outlineVariant = SS.border,
    error = SS.danger,
    onError = Color.White,
)

private val base = Typography()
private val typography = Typography(
    displaySmall = base.displaySmall.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp),
    headlineLarge = base.headlineLarge.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp),
    headlineMedium = base.headlineMedium.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.25).sp),
    headlineSmall = base.headlineSmall.copy(fontWeight = FontWeight.Bold),
    titleLarge = base.titleLarge.copy(fontWeight = FontWeight.SemiBold),
    titleMedium = base.titleMedium.copy(fontWeight = FontWeight.SemiBold),
    titleSmall = base.titleSmall.copy(fontWeight = FontWeight.SemiBold),
    labelSmall = base.labelSmall.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp),
)

/** The script page font: Courier, as on every screenplay ever printed. */
val ScriptText = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 15.sp, lineHeight = 22.sp)

@Composable
fun ScreenplayTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = colors,
        typography = typography,
        shapes = Shapes(
            small = RoundedCornerShape(SS.radiusSmall),
            medium = RoundedCornerShape(SS.radius),
            large = RoundedCornerShape(20.dp),
            extraLarge = RoundedCornerShape(28.dp),
        ),
        content = content,
    )
}
