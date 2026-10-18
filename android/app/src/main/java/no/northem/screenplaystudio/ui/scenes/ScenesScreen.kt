package no.northem.screenplaystudio.ui.scenes

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ViewList
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import no.northem.screenplaystudio.data.ProductionScene
import no.northem.screenplaystudio.data.ProjectCharacter
import no.northem.screenplaystudio.data.Repository
import no.northem.screenplaystudio.data.SceneLocationType
import no.northem.screenplaystudio.data.SceneTime
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
import no.northem.screenplaystudio.ui.components.parseHexColor
import no.northem.screenplaystudio.ui.confirm
import no.northem.screenplaystudio.ui.friendly
import no.northem.screenplaystudio.ui.projects.SSSheet
import no.northem.screenplaystudio.ui.projects.SheetField
import no.northem.screenplaystudio.ui.theme.SS

class ScenesViewModel(private val projectId: String) : ViewModel() {
    val scenes = MutableStateFlow(Supabase.cached(Repository.scenesQuery(projectId), ProductionScene.serializer()))
    val cast = MutableStateFlow(Supabase.cached(Repository.charactersQuery(projectId), ProjectCharacter.serializer()).orEmpty())
    val error = MutableStateFlow<String?>(null)

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        runCatching {
            scenes.value = Repository.fetchScenes(projectId)
            cast.value = Repository.fetchCharacters(projectId)
            error.value = null
        }.onFailure { error.value = friendly(it); if (scenes.value == null) scenes.value = emptyList() }
    }

    private fun replace(id: String, change: (ProductionScene) -> ProductionScene) =
        scenes.update { list -> list?.map { if (it.id == id) change(it) else it } }

    fun toggleDone(scene: ProductionScene) = viewModelScope.launch {
        val before = scenes.value
        replace(scene.id) { it.copy(isCompleted = !scene.done) }
        runCatching { Repository.setSceneCompleted(scene.id, !scene.done) }.onFailure { scenes.value = before; error.value = friendly(it) }
    }

    fun setList(scene: ProductionScene, column: String, values: List<String>) = viewModelScope.launch {
        val before = scenes.value
        replace(scene.id) { s ->
            when (column) {
                "props" -> s.copy(props = values)
                "costumes" -> s.copy(costumes = values)
                "special_effects" -> s.copy(specialEffects = values)
                "vehicles" -> s.copy(vehicles = values)
                "animals" -> s.copy(animals = values)
                "music_cues" -> s.copy(musicCues = values)
                "special_equipment" -> s.copy(specialEquipment = values)
                else -> s
            }
        }
        runCatching {
            Repository.updateScene(scene.id, buildJsonObject { put(column, JsonArray(values.map(::JsonPrimitive))) })
        }.onFailure { scenes.value = before; error.value = friendly(it) }
    }

    fun setText(scene: ProductionScene, column: String, value: String) = viewModelScope.launch {
        val v = value.nonEmpty()
        replace(scene.id) { s ->
            when (column) {
                "synopsis" -> s.copy(synopsis = v)
                "notes" -> s.copy(notes = v)
                else -> s
            }
        }
        runCatching { Repository.updateScene(scene.id, buildJsonObject { put(column, JsonPrimitive(v)) }) }
            .onFailure { error.value = friendly(it) }
    }

    suspend fun create(number: String, location: SceneLocationType, name: String, time: SceneTime, synopsis: String) {
        val order = (scenes.value?.maxOfOrNull { it.sortOrder ?: 0 } ?: -1) + 1
        Repository.createScene(projectId, number, location, name, time, synopsis, order)?.let { created ->
            scenes.update { it.orEmpty() + created }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScenesScreen(projectId: String, onBack: () -> Unit) {
    val vm: ScenesViewModel = viewModel(key = "scenes-$projectId") { ScenesViewModel(projectId) }
    val scenes by vm.scenes.collectAsStateWithLifecycle()
    val cast by vm.cast.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var adding by remember { mutableStateOf(false) }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val twoPane = maxWidth >= 840.dp
        val selected = scenes?.firstOrNull { it.id == selectedId }

        if (!twoPane && selected != null) {
            BackHandler { selectedId = null }
            SceneDetail(selected, cast, vm, onBack = { selectedId = null })
            return@BoxWithConstraints
        }

        Scaffold(
            containerColor = SS.background,
            topBar = {
                SSTopBar("Scenes", onBack, subtitle = scenes?.let { list ->
                    "${list.size} scenes · ${list.count { it.done }} shot"
                })
            },
            floatingActionButton = {
                FloatingActionButton(onClick = { adding = true }, containerColor = SS.accent, contentColor = Color.White) {
                    Icon(Icons.Filled.Add, "New scene")
                }
            },
        ) { padding ->
            Row(Modifier.fillMaxSize().padding(padding)) {
                PullToRefreshBox(false, { vm.refresh() }, Modifier.then(if (twoPane) Modifier.width(420.dp) else Modifier.weight(1f)).fillMaxHeight()) {
                    SceneList(scenes, error, selectedId.takeIf { twoPane }, vm::toggleDone) { selectedId = it.id }
                }
                if (twoPane) {
                    Box(Modifier.weight(1f).fillMaxHeight().background(SS.S900.copy(alpha = 0.5f))) {
                        if (selected != null) SceneDetailBody(selected, cast, vm)
                        else EmptyState(Icons.AutoMirrored.Outlined.ViewList, "Pick a scene", "Its breakdown — cast, props, costumes, effects — opens here.")
                    }
                }
            }
        }
    }
    if (adding) NewSceneSheet(nextNumber = ((scenes?.size ?: 0) + 1).toString(), onDismiss = { adding = false }, onCreate = vm::create)
}

@Composable
private fun SceneList(
    scenes: List<ProductionScene>?,
    error: String?,
    selectedId: String?,
    onToggle: (ProductionScene) -> Unit,
    onOpen: (ProductionScene) -> Unit,
) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        LazyColumn(
            Modifier.widthIn(max = SS.readableWidth).fillMaxSize(),
            contentPadding = PaddingValues(start = SS.screenPadding, end = SS.screenPadding, top = 4.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(SS.rowSpacing),
        ) {
            error?.let { item { Text(it, color = SS.warning, style = MaterialTheme.typography.bodySmall) } }
            when {
                scenes == null -> item { SkeletonList(5) }
                scenes.isEmpty() -> item {
                    EmptyState(Icons.AutoMirrored.Outlined.ViewList, "No scenes yet", "Add scenes here, or write scene headings in the script and sync them from the web.")
                }
                else -> items(scenes, key = { it.id }) { scene -> SceneRow(scene, scene.id == selectedId, onToggle, onOpen) }
            }
        }
    }
}

@Composable
private fun SceneRow(scene: ProductionScene, selected: Boolean, onToggle: (ProductionScene) -> Unit, onOpen: (ProductionScene) -> Unit) {
    val view = LocalView.current
    val night = scene.time?.isNight == true
    SSCard(
        modifier = if (selected) Modifier.border(1.5.dp, SS.accent, RoundedCornerShape(SS.radius)) else Modifier,
        onClick = { onOpen(scene) },
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Box(
                Modifier.size(40.dp).background(if (scene.done) SS.success.copy(alpha = 0.16f) else SS.elevated, RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(scene.sceneNumber ?: "–", style = MaterialTheme.typography.titleSmall, color = if (scene.done) SS.success else SS.textPrimary)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    scene.displayHeading, style = MaterialTheme.typography.titleSmall.copy(fontFamily = FontFamily.Monospace),
                    color = SS.textPrimary, maxLines = 2, overflow = TextOverflow.Ellipsis,
                )
                scene.synopsis?.nonEmpty()?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = SS.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    scene.time?.let {
                        Chip(it.label, if (night) Color(0xFF818CF8) else SS.warning, icon = if (night) Icons.Outlined.DarkMode else Icons.Outlined.LightMode)
                    }
                    scene.eighthsLabel?.let { Chip("$it pg", SS.textTertiary) }
                    val count = scene.breakdownTallies.sumOf { it.second }
                    if (count > 0) Text("$count items", style = MaterialTheme.typography.bodySmall, color = SS.textTertiary)
                }
            }
            IconButton(onClick = { view.confirm(); onToggle(scene) }) {
                Icon(
                    Icons.Filled.CheckCircle,
                    if (scene.done) "Shot — tap to mark not shot" else "Not shot — tap to mark shot",
                    tint = if (scene.done) SS.success else SS.S600,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SceneDetail(scene: ProductionScene, cast: List<ProjectCharacter>, vm: ScenesViewModel, onBack: () -> Unit) {
    Scaffold(containerColor = SS.background, topBar = { SSTopBar("Scene ${scene.sceneNumber ?: ""}".trim(), onBack) }) { padding ->
        Box(Modifier.padding(padding)) { SceneDetailBody(scene, cast, vm) }
    }
}

private val LIST_FIELDS = listOf(
    Triple("Props", "props", ProductionScene::props),
    Triple("Costumes", "costumes", ProductionScene::costumes),
    Triple("Special effects", "special_effects", ProductionScene::specialEffects),
    Triple("Vehicles", "vehicles", ProductionScene::vehicles),
    Triple("Animals", "animals", ProductionScene::animals),
    Triple("Music cues", "music_cues", ProductionScene::musicCues),
    Triple("Special equipment", "special_equipment", ProductionScene::specialEquipment),
)

@Composable
private fun SceneDetailBody(scene: ProductionScene, cast: List<ProjectCharacter>, vm: ScenesViewModel) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier.widthIn(max = SS.readableWidth).fillMaxSize().verticalScroll(rememberScrollState()).padding(SS.screenPadding),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            SSCard {
                Text(scene.displayHeading, style = MaterialTheme.typography.titleMedium.copy(fontFamily = FontFamily.Monospace), color = SS.textPrimary)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    scene.location?.let { Chip(it.shortLabel, SS.textSecondary) }
                    scene.time?.let { Chip(it.label, if (it.isNight) Color(0xFF818CF8) else SS.warning) }
                    scene.eighthsLabel?.let { Chip("$it pages", SS.textTertiary) }
                }
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Shot", style = MaterialTheme.typography.bodyMedium, color = SS.textSecondary, modifier = Modifier.weight(1f))
                    Switch(
                        checked = scene.done, onCheckedChange = { vm.toggleDone(scene) },
                        colors = SwitchDefaults.colors(checkedTrackColor = SS.success),
                    )
                }
            }

            EditableText("Synopsis", scene.synopsis.orEmpty()) { vm.setText(scene, "synopsis", it) }

            val sceneCast = cast.filter { it.id in scene.castIds.orEmpty() }
            if (sceneCast.isNotEmpty()) {
                SSCard {
                    Text("Cast", style = MaterialTheme.typography.titleSmall, color = SS.textPrimary)
                    Spacer(Modifier.height(8.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        sceneCast.forEach { Chip(it.name, parseHexColor(it.color)) }
                    }
                }
            }

            LIST_FIELDS.forEach { (label, column, getter) ->
                ListField(label, getter(scene).orEmpty()) { vm.setList(scene, column, it) }
            }

            listOfNotNull(
                scene.makeupNotes?.nonEmpty()?.let { "Hair & makeup" to it },
                scene.stunts?.nonEmpty()?.let { "Stunts" to it },
                scene.soundNotes?.nonEmpty()?.let { "Sound" to it },
                scene.vfxNotes?.nonEmpty()?.let { "VFX" to it },
                scene.mood?.nonEmpty()?.let { "Mood" to it },
                scene.weatherRequired?.nonEmpty()?.let { "Weather" to it },
            ).forEach { (label, text) ->
                SSCard {
                    Text(label, style = MaterialTheme.typography.labelSmall, color = SS.textTertiary)
                    Text(text, style = MaterialTheme.typography.bodyMedium, color = SS.textPrimary)
                }
            }

            EditableText("Notes", scene.notes.orEmpty()) { vm.setText(scene, "notes", it) }
            Spacer(Modifier.height(60.dp))
        }
    }
}

@Composable
private fun EditableText(label: String, value: String, onSave: (String) -> Unit) {
    var editing by remember(value) { mutableStateOf(false) }
    var draft by remember(value) { mutableStateOf(value) }
    SSCard(onClick = if (editing) null else ({ editing = true })) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = MaterialTheme.typography.titleSmall, color = SS.textPrimary, modifier = Modifier.weight(1f))
            if (editing) TextButton(onClick = { editing = false; onSave(draft) }) { Text("Save", color = SS.accent) }
        }
        if (editing) {
            SheetField(label, draft, { draft = it }, singleLine = false)
        } else {
            Text(value.ifBlank { "Tap to add" }, style = MaterialTheme.typography.bodyMedium, color = if (value.isBlank()) SS.textTertiary else SS.textSecondary)
        }
    }
}

@Composable
private fun ListField(label: String, items: List<String>, onChange: (List<String>) -> Unit) {
    var adding by remember { mutableStateOf(false) }
    var draft by remember { mutableStateOf("") }
    SSCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = MaterialTheme.typography.titleSmall, color = SS.textPrimary, modifier = Modifier.weight(1f))
            Text("${items.size}", style = MaterialTheme.typography.labelLarge, color = SS.textTertiary)
            IconButton(onClick = { adding = !adding }) { Icon(Icons.Filled.Add, "Add to $label", tint = SS.accent) }
        }
        if (items.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                items.forEach { item ->
                    Row(
                        Modifier.background(SS.elevated, CircleShape).padding(start = 12.dp, end = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(item, style = MaterialTheme.typography.bodySmall, color = SS.textPrimary)
                        IconButton(onClick = { onChange(items - item) }, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Filled.Close, "Remove $item", Modifier.size(14.dp), tint = SS.textTertiary)
                        }
                    }
                }
            }
        }
        if (adding) {
            Spacer(Modifier.height(8.dp))
            SheetField("New item", draft, { draft = it })
            TextButton(onClick = {
                draft.nonEmpty()?.let { onChange(items + it) }
                draft = ""; adding = false
            }) { Text("Add", color = SS.accent) }
        }
    }
}

@Composable
private fun NewSceneSheet(nextNumber: String, onDismiss: () -> Unit, onCreate: suspend (String, SceneLocationType, String, SceneTime, String) -> Unit) {
    var number by remember { mutableStateOf(nextNumber) }
    var location by remember { mutableStateOf(SceneLocationType.INT) }
    var name by remember { mutableStateOf("") }
    var time by remember { mutableStateOf(SceneTime.DAY) }
    var synopsis by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    SSSheet("New scene", onDismiss) {
        SheetField("Scene number", number, { number = it })
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SceneLocationType.entries.forEach { FilterPill(it.label, location == it, SS.accent) { location = it } }
        }
        SheetField("Location", name, { name = it }, placeholder = "KITCHEN")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SceneTime.entries.take(7).forEach { FilterPill(it.label, time == it, SS.accent) { time = it } }
        }
        SheetField("Synopsis", synopsis, { synopsis = it }, singleLine = false)
        Text("${location.label} ${name.uppercase().ifBlank { "LOCATION" }} - ${time.label}", fontFamily = FontFamily.Monospace, color = SS.textSecondary)
        error?.let { Text(it, color = SS.danger) }
        PrimaryButton("Add scene", {
            busy = true
            scope.launch {
                try { onCreate(number, location, name, time, synopsis); onDismiss() } catch (e: Exception) { error = friendly(e) } finally { busy = false }
            }
        }, enabled = name.isNotBlank(), loading = busy)
    }
}
