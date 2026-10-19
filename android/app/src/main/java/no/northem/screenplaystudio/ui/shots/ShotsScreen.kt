package no.northem.screenplaystudio.ui.shots

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.data.ProductionScene
import no.northem.screenplaystudio.data.Realtime
import no.northem.screenplaystudio.data.Repository
import no.northem.screenplaystudio.data.merged
import no.northem.screenplaystudio.data.Shot
import no.northem.screenplaystudio.data.ShotMovement
import no.northem.screenplaystudio.data.ShotType
import no.northem.screenplaystudio.data.Supabase
import no.northem.screenplaystudio.data.nonEmpty
import no.northem.screenplaystudio.ui.ProjectMemory
import no.northem.screenplaystudio.ui.SSTopBar
import no.northem.screenplaystudio.ui.components.Chip
import no.northem.screenplaystudio.ui.components.EmptyState
import no.northem.screenplaystudio.ui.components.FilterPill
import no.northem.screenplaystudio.ui.components.PrimaryButton
import no.northem.screenplaystudio.ui.components.SSCard
import no.northem.screenplaystudio.ui.components.SkeletonList
import no.northem.screenplaystudio.ui.confirm
import no.northem.screenplaystudio.ui.friendly
import no.northem.screenplaystudio.ui.projects.SSSheet
import no.northem.screenplaystudio.ui.projects.SheetField
import no.northem.screenplaystudio.ui.theme.SS
import no.northem.screenplaystudio.ui.tick

class ShotsViewModel(private val projectId: String) : ViewModel() {
    val shots = MutableStateFlow(Supabase.cached(Repository.shotsQuery(projectId), Shot.serializer()))
    val scenes = MutableStateFlow(Supabase.cached(Repository.scenesQuery(projectId), ProductionScene.serializer()).orEmpty())
    val error = MutableStateFlow<String?>(null)

    init {
        refresh()
        viewModelScope.launch {
            Realtime.changes("shots", "project_id=eq.$projectId").collect { change ->
                shots.value?.merged(change, Shot.serializer(), { it.id }, sort = compareBy { it.sortOrder ?: 0 })?.let { shots.value = it }
            }
        }
    }

    fun refresh() = viewModelScope.launch {
        runCatching {
            scenes.value = Repository.fetchScenes(projectId)
            shots.value = Repository.fetchShots(projectId)
            error.value = null
        }.onFailure { error.value = friendly(it); if (shots.value == null) shots.value = emptyList() }
    }

    private fun replace(id: String, change: (Shot) -> Shot) = shots.update { l -> l?.map { if (it.id == id) change(it) else it } }

    fun toggleDone(shot: Shot) = viewModelScope.launch {
        val before = shots.value
        replace(shot.id) { it.copy(isCompleted = !shot.done) }
        runCatching { Repository.setShotCompleted(shot.id, !shot.done) }.onFailure { shots.value = before; error.value = friendly(it) }
    }

    /** The one thing anyone does with a shot list while the camera rolls. */
    fun addTake(shot: Shot) = viewModelScope.launch {
        val current = shots.value?.firstOrNull { it.id == shot.id } ?: return@launch
        val takes = (current.takesCompleted ?: 0) + 1
        val before = shots.value
        replace(shot.id) { it.copy(takesCompleted = takes) }
        runCatching { Repository.setTakes(shot.id, takes) }.onFailure { shots.value = before; error.value = friendly(it) }
    }

    suspend fun create(sceneId: String?, number: String, type: ShotType, movement: ShotMovement, lens: String, description: String) {
        val order = (shots.value?.maxOfOrNull { it.sortOrder ?: 0 } ?: -1) + 1
        Repository.createShot(projectId, sceneId, number, type, movement, lens, description, order)?.let { s ->
            shots.update { it.orEmpty() + s }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShotsScreen(projectId: String, onBack: () -> Unit) {
    val vm: ShotsViewModel = viewModel(key = "shots-$projectId") { ShotsViewModel(projectId) }
    val shots by vm.shots.collectAsStateWithLifecycle()
    val scenes by vm.scenes.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var adding by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = SS.background,
        topBar = {
            SSTopBar("Shot list", onBack, subtitle = shots?.let { "${it.size} shots · ${it.count { s -> s.done }} done" })
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { adding = true }, containerColor = SS.accent, contentColor = Color.White) { Icon(Icons.Filled.Add, "New shot") }
        },
    ) { padding ->
        PullToRefreshBox(false, { vm.refresh() }, Modifier.fillMaxSize().padding(padding)) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                LazyVerticalGrid(
                    GridCells.Adaptive(360.dp),
                    Modifier.widthIn(max = SS.wideWidth).fillMaxSize(),
                    contentPadding = PaddingValues(start = SS.screenPadding, end = SS.screenPadding, bottom = 120.dp),
                    horizontalArrangement = Arrangement.spacedBy(SS.rowSpacing),
                    verticalArrangement = Arrangement.spacedBy(SS.rowSpacing),
                ) {
                    error?.let { item(span = { GridItemSpan(maxLineSpan) }) { Text(it, color = SS.warning, style = MaterialTheme.typography.bodySmall) } }
                    val list = shots
                    when {
                        list == null -> item(span = { GridItemSpan(maxLineSpan) }) { SkeletonList(5) }
                        list.isEmpty() -> item(span = { GridItemSpan(maxLineSpan) }) {
                            EmptyState(Icons.Outlined.PhotoCamera, "No shots yet", "Plan coverage scene by scene. Each shot gets a one-tap take counter for the shoot.")
                        }
                        else -> {
                            val byScene = list.groupBy { it.sceneId }
                            val ordered = scenes.filter { it.id in byScene } .map { it.id to it.displayHeading } +
                                byScene.keys.filter { k -> scenes.none { it.id == k } }.map { it to "Unassigned" }
                            ordered.forEach { (sceneId, heading) ->
                                item(span = { GridItemSpan(maxLineSpan) }, key = "h-$sceneId") {
                                    val number = scenes.firstOrNull { it.id == sceneId }?.sceneNumber
                                    Text(
                                        listOfNotNull(number?.let { "$it." }, heading).joinToString(" "),
                                        style = MaterialTheme.typography.titleSmall.copy(fontFamily = FontFamily.Monospace),
                                        color = SS.textSecondary, modifier = Modifier.padding(top = 14.dp),
                                    )
                                }
                                items(byScene[sceneId].orEmpty(), key = { it.id }) { shot -> ShotRow(shot, vm) }
                            }
                        }
                    }
                }
            }
        }
    }
    if (adding) NewShotSheet(scenes, { adding = false }, vm::create)
}

@Composable
private fun ShotRow(shot: Shot, vm: ShotsViewModel) {
    val view = LocalView.current
    SSCard {
        Row(verticalAlignment = Alignment.Top) {
            Box(
                Modifier.size(46.dp).padding(0.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(shot.displayNumber, style = MaterialTheme.typography.titleMedium, color = if (shot.done) SS.success else SS.Brand300)
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (shot.techSummary.isNotBlank()) Text(shot.techSummary, style = MaterialTheme.typography.labelLarge, color = SS.textSecondary)
                shot.description?.nonEmpty()?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = SS.textPrimary, maxLines = 3) }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    shot.takesLabel?.let { Chip(it, if (shot.done) SS.success else SS.textTertiary) }
                    if (shot.vfxRequired == true) Chip("VFX", Color(0xFF06B6D4))
                }
            }
            IconButton(onClick = { view.confirm(); vm.toggleDone(shot) }) {
                Icon(Icons.Filled.CheckCircle, if (shot.done) "Done — tap to reopen" else "Mark done", tint = if (shot.done) SS.success else SS.S600)
            }
        }
        Spacer(Modifier.size(8.dp))
        // Sized for cold hands.
        Button(
            onClick = { view.tick(); vm.addTake(shot) },
            modifier = Modifier.heightIn(min = 48.dp).padding(start = 56.dp),
            shape = RoundedCornerShape(SS.radiusSmall),
            colors = ButtonDefaults.buttonColors(containerColor = SS.accentSoft, contentColor = SS.Brand300),
        ) { Text("+1 take  ·  ${shot.takesCompleted ?: 0}") }
    }
}

@Composable
private fun NewShotSheet(scenes: List<ProductionScene>, onDismiss: () -> Unit, onCreate: suspend (String?, String, ShotType, ShotMovement, String, String) -> Unit) {
    var sceneId by remember { mutableStateOf(scenes.firstOrNull()?.id) }
    var number by remember { mutableStateOf("") }
    var type by remember { mutableStateOf(ShotType.MEDIUM) }
    var movement by remember { mutableStateOf(ShotMovement.STATIC) }
    var lens by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    SSSheet("New shot", onDismiss) {
        if (scenes.isNotEmpty()) {
            Text("Scene", style = MaterialTheme.typography.labelSmall, color = SS.textTertiary)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                scenes.forEach { s -> FilterPill(s.sceneNumber ?: s.displayHeading.take(14), sceneId == s.id, SS.accent) { sceneId = s.id } }
            }
        }
        SheetField("Shot number", number, { number = it }, placeholder = "1A")
        Text("Size", style = MaterialTheme.typography.labelSmall, color = SS.textTertiary)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(ShotType.WIDE, ShotType.MEDIUM_WIDE, ShotType.MEDIUM, ShotType.MEDIUM_CLOSE, ShotType.CLOSE_UP, ShotType.EXTREME_CLOSE, ShotType.OVER_SHOULDER, ShotType.TWO_SHOT, ShotType.INSERT, ShotType.POV, ShotType.ESTABLISHING)
                .forEach { FilterPill(it.abbreviation, type == it, SS.accent) { type = it } }
        }
        Text("Movement", style = MaterialTheme.typography.labelSmall, color = SS.textTertiary)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(ShotMovement.STATIC, ShotMovement.PAN_LEFT, ShotMovement.PAN_RIGHT, ShotMovement.DOLLY_IN, ShotMovement.DOLLY_OUT, ShotMovement.FOLLOW, ShotMovement.CRANE_UP, ShotMovement.RACK_FOCUS)
                .forEach { FilterPill(it.label, movement == it, SS.accent) { movement = it } }
        }
        SheetField("Lens", lens, { lens = it }, placeholder = "35mm")
        SheetField("Description", description, { description = it }, singleLine = false)
        error?.let { Text(it, color = SS.danger) }
        PrimaryButton("Add shot", {
            busy = true
            scope.launch {
                try { onCreate(sceneId, number, type, movement, lens, description); onDismiss() } catch (e: Exception) { error = friendly(e) } finally { busy = false }
            }
        }, loading = busy)
    }
}
