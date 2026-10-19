package no.northem.screenplaystudio.ui.slate

import android.view.WindowManager
import androidx.activity.compose.LocalActivity
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.ui.ProjectMemory
import no.northem.screenplaystudio.ui.components.FilterPill
import no.northem.screenplaystudio.ui.confirm
import no.northem.screenplaystudio.ui.shots.ShotsViewModel
import no.northem.screenplaystudio.ui.theme.SS
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

/**
 * A working clapperboard. Pick the shot, hold it up to the lens, tap CLAP —
 * the sticks come down, the board flashes, and the take is logged onto the
 * shot list. Time-of-day timecode runs at 25 fps.
 */
@Composable
fun SlateScreen(projectId: String, onBack: () -> Unit) {
    val shotsVm: ShotsViewModel = viewModel(key = "shots-$projectId") { ShotsViewModel(projectId) }
    val shots by shotsVm.shots.collectAsStateWithLifecycle()
    val scenes by shotsVm.scenes.collectAsStateWithLifecycle()
    var shotId by remember { mutableStateOf<String?>(null) }
    var roll by remember { mutableIntStateOf(1) }
    val shot = shots?.firstOrNull { it.id == shotId } ?: shots?.firstOrNull { !it.done } ?: shots?.firstOrNull()
    val scene = scenes.firstOrNull { it.id == shot?.sceneId }
    val take = (shot?.takesCompleted ?: 0) + 1
    val project = ProjectMemory.byId[projectId]
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    val sticks = remember { Animatable(-12f) }
    val flash = remember { Animatable(0f) }

    // Keep the screen awake and bright while the board is up.
    val activity = LocalActivity.current
    DisposableEffect(Unit) {
        val window = activity?.window
        window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val before = window?.attributes?.screenBrightness
        window?.attributes = window?.attributes?.apply { screenBrightness = 1f }
        onDispose {
            window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            window?.attributes = window?.attributes?.apply { screenBrightness = before ?: -1f }
        }
    }

    var timecode by remember { mutableStateOf("00:00:00:00") }
    LaunchedEffect(Unit) {
        while (true) {
            withFrameMillis { }
            val now = LocalTime.now()
            val frames = now.nano / 40_000_000
            timecode = "%02d:%02d:%02d:%02d".format(now.hour, now.minute, now.second, frames)
        }
    }

    fun clap() {
        view.confirm()
        scope.launch {
            sticks.animateTo(0f, tween(90))
            flash.snapTo(1f)
            launch { flash.animateTo(0f, tween(450)) }
            shot?.let { shotsVm.addTake(it) }
            kotlinx.coroutines.delay(600)
            sticks.animateTo(-12f, tween(250))
        }
    }

    Box(Modifier.fillMaxSize().background(Color.Black).safeDrawingPadding()) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Color.White) }
                Text("Slate", style = MaterialTheme.typography.titleMedium, color = Color.White, modifier = Modifier.weight(1f))
                Text(LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy")), color = SS.textTertiary)
            }
            Spacer(Modifier.height(12.dp))

            BoxWithConstraints(Modifier.widthIn(max = 720.dp).fillMaxWidth()) {
                val w = maxWidth
                Column {
                    // Headroom for the open sticks, which rise ~21% of the width at 12°.
                    Spacer(Modifier.height(w * 0.22f))
                    // The sticks: black and white diagonals, hinged at the left.
                    Canvas(
                        Modifier.fillMaxWidth().height(w * 0.11f).graphicsLayer {
                            rotationZ = sticks.value
                            transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0f, 1f)
                        }
                    ) {
                        drawRect(Color.White)
                        val stripe = size.width / 9
                        for (i in 0..10 step 2) {
                            val x = i * stripe
                            drawPath(Path().apply {
                                moveTo(x, 0f); lineTo(x + stripe, 0f); lineTo(x + stripe * 0.4f, size.height); lineTo(x - stripe * 0.6f, size.height); close()
                            }, Color.Black)
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Column(
                        Modifier.fillMaxWidth()
                            .background(Color(0xFF111114), RoundedCornerShape(6.dp))
                            .border(2.dp, Color.White.copy(alpha = 0.85f), RoundedCornerShape(6.dp))
                            .padding(16.dp),
                    ) {
                        Text(project?.title?.uppercase() ?: "PRODUCTION", color = Color.White, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Spacer(Modifier.height(12.dp))
                        Row(Modifier.fillMaxWidth()) {
                            Cell("SCENE", scene?.sceneNumber ?: "–", Modifier.weight(1f))
                            Cell("SHOT", shot?.displayNumber ?: "–", Modifier.weight(1f))
                            Cell("TAKE", "$take", Modifier.weight(1f), SS.Brand400)
                            Cell("ROLL", "A%03d".format(roll), Modifier.weight(1f))
                        }
                        Spacer(Modifier.height(14.dp))
                        Text(timecode, color = Color(0xFFFF3B30), fontFamily = FontFamily.Monospace, fontSize = 40.sp, fontWeight = FontWeight.Bold, modifier = Modifier.align(Alignment.CenterHorizontally))
                    }
                }
                Box(Modifier.matchParentSize().background(Color.White.copy(alpha = flash.value * 0.85f)))
            }

            Spacer(Modifier.height(20.dp))
            Button(
                onClick = ::clap,
                enabled = shot != null,
                modifier = Modifier.widthIn(max = 720.dp).fillMaxWidth().heightIn(min = 72.dp),
                shape = RoundedCornerShape(SS.radius),
                colors = ButtonDefaults.buttonColors(containerColor = SS.accent, contentColor = Color.White),
            ) { Text(if (shot == null) "Add a shot to slate it" else "CLAP · log take $take", style = MaterialTheme.typography.titleLarge) }

            Spacer(Modifier.height(16.dp))
            Row(Modifier.widthIn(max = 720.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Roll", color = SS.textTertiary, modifier = Modifier.weight(1f))
                IconButton(onClick = { if (roll > 1) roll-- }) { Text("−", color = Color.White, fontSize = 22.sp) }
                IconButton(onClick = { roll++ }) { Text("+", color = Color.White, fontSize = 22.sp) }
            }
            Text("Shot", color = SS.textTertiary, modifier = Modifier.widthIn(max = 720.dp).fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            FlowRow(Modifier.widthIn(max = 720.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                shots.orEmpty().forEach { s -> FilterPill(s.displayNumber, s.id == shot?.id, SS.accent) { shotId = s.id } }
            }
        }
    }
}

@Composable
private fun Cell(label: String, value: String, modifier: Modifier, tint: Color = Color.White) {
    Column(modifier.padding(end = 6.dp)) {
        Text(label, color = SS.textTertiary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        Text(value, color = tint, fontFamily = FontFamily.Monospace, fontSize = 30.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}
