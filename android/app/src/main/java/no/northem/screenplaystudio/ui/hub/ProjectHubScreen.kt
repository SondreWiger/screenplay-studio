package no.northem.screenplaystudio.ui.hub

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.ViewList
import androidx.compose.material.icons.outlined.Article
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.BuildConfig
import no.northem.screenplaystudio.data.GearCheckout
import no.northem.screenplaystudio.data.GearItem
import no.northem.screenplaystudio.data.ProductionScene
import no.northem.screenplaystudio.data.ProjectDocument
import no.northem.screenplaystudio.data.Project
import no.northem.screenplaystudio.data.ProjectCharacter
import no.northem.screenplaystudio.data.Repository
import no.northem.screenplaystudio.data.ScheduleEvent
import no.northem.screenplaystudio.data.Script
import no.northem.screenplaystudio.data.Shot
import no.northem.screenplaystudio.data.Supabase
import no.northem.screenplaystudio.data.nonEmpty
import no.northem.screenplaystudio.ui.ProjectMemory
import no.northem.screenplaystudio.ui.SSTopBar
import no.northem.screenplaystudio.ui.components.Chip
import no.northem.screenplaystudio.ui.components.IconTile
import no.northem.screenplaystudio.ui.components.ProgressBar
import no.northem.screenplaystudio.ui.components.SSCard
import no.northem.screenplaystudio.ui.components.StatCell
import no.northem.screenplaystudio.ui.friendly
import no.northem.screenplaystudio.ui.openUrl
import no.northem.screenplaystudio.ui.schedule.timeRange
import no.northem.screenplaystudio.ui.schedule.dayLabel
import no.northem.screenplaystudio.ui.theme.SS
import java.time.Instant

data class HubState(
    val project: Project? = null,
    val scripts: List<Script> = emptyList(),
    val scenes: List<ProductionScene> = emptyList(),
    val shots: List<Shot> = emptyList(),
    val characters: List<ProjectCharacter> = emptyList(),
    val events: List<ScheduleEvent> = emptyList(),
    val documents: List<ProjectDocument> = emptyList(),
    val gear: List<GearItem> = emptyList(),
    val checkouts: List<GearCheckout> = emptyList(),
    val error: String? = null,
) {
    val activeScript get() = Repository.preferredScript(scripts)
    val nextEvent get() = events.filter { it.end > Instant.now() }.minByOrNull { it.start }
    val pages get() = scenes.sumOf { it.pageCount ?: 0.0 }
}

class HubViewModel(private val projectId: String) : ViewModel() {
    val state = MutableStateFlow(HubState(project = ProjectMemory.byId[projectId]))

    init {
        state.update {
            it.copy(
                scripts = Supabase.cached(Repository.scriptsQuery(projectId), Script.serializer()).orEmpty(),
                scenes = Supabase.cached(Repository.scenesQuery(projectId), ProductionScene.serializer()).orEmpty(),
                shots = Supabase.cached(Repository.shotsQuery(projectId), Shot.serializer()).orEmpty(),
                characters = Supabase.cached(Repository.charactersQuery(projectId), ProjectCharacter.serializer()).orEmpty(),
                events = Supabase.cached(Repository.scheduleQuery(projectId), ScheduleEvent.serializer()).orEmpty(),
                documents = Supabase.cached(Repository.documentsQuery(projectId), ProjectDocument.serializer()).orEmpty(),
                gear = Supabase.cached(Repository.gearQuery(projectId), GearItem.serializer()).orEmpty(),
                checkouts = Supabase.cached(Repository.activeCheckoutsQuery(projectId), GearCheckout.serializer()).orEmpty(),
            )
        }
        refresh()
    }

    fun refresh() = viewModelScope.launch {
        try {
            val project = async { Repository.fetchProject(projectId) }
            val scripts = async { Repository.fetchScripts(projectId) }
            val scenes = async { Repository.fetchScenes(projectId) }
            val shots = async { Repository.fetchShots(projectId) }
            val characters = async { Repository.fetchCharacters(projectId) }
            val events = async { Repository.fetchSchedule(projectId) }
            // Secondary tools: a failure here must not blank the hub.
            val documents = async { runCatching { Repository.fetchDocuments(projectId) }.getOrNull() }
            val gear = async { runCatching { Repository.fetchGear(projectId) }.getOrNull() }
            val checkouts = async { runCatching { Repository.fetchActiveCheckouts(projectId) }.getOrNull() }
            val p = project.await()
            p?.let { ProjectMemory.byId[it.id] = it }
            state.update {
                it.copy(
                    project = p ?: it.project, scripts = scripts.await(), scenes = scenes.await(),
                    shots = shots.await(), characters = characters.await(), events = events.await(),
                    documents = documents.await() ?: it.documents, gear = gear.await() ?: it.gear,
                    checkouts = checkouts.await() ?: it.checkouts, error = null,
                )
            }
        } catch (e: Exception) {
            state.update { it.copy(error = friendly(e)) }
        }
    }

    /** Opening the editor on a project with no script yet creates its first draft. */
    suspend fun scriptForEditor(): String? {
        state.value.activeScript?.let { return it.id }
        val title = state.value.project?.title ?: "Untitled"
        val created = Repository.createScript(projectId, title) ?: return null
        state.update { it.copy(scripts = listOf(created) + it.scripts) }
        return created.id
    }
}

private data class Tool(val key: String, val title: String, val subtitle: String, val icon: ImageVector, val tint: Color)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectHubScreen(
    projectId: String,
    onBack: () -> Unit,
    onOpenEditor: (String) -> Unit,
    onOpenTool: (String) -> Unit,
) {
    val vm: HubViewModel = viewModel(key = projectId) { HubViewModel(projectId) }
    val state by vm.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var opening by remember { mutableStateOf(false) }
    val context = LocalContext.current

    val tools = listOf(
        Tool("editor", "Script", state.activeScript?.let { "${it.title} · ${it.versionLabel}" } ?: "Start the first draft", Icons.Outlined.Description, SS.Brand500),
        Tool("scenes", "Scenes & breakdown", "${state.scenes.size} scenes · ${state.scenes.count { it.done }} shot", Icons.AutoMirrored.Outlined.ViewList, Color(0xFF8B5CF6)),
        Tool("shots", "Shot list", "${state.shots.size} shots · ${state.shots.count { it.done }} done", Icons.Outlined.PhotoCamera, Color(0xFF06B6D4)),
        Tool("schedule", "Schedule", "${state.events.size} events", Icons.Outlined.CalendarMonth, Color(0xFF22C55E)),
        Tool("characters", "Characters", "${state.characters.size} characters", Icons.Outlined.Groups, Color(0xFFEC4899)),
        Tool("slate", "Slate", "Clapperboard — marks takes onto the shot list", Icons.Outlined.Movie, Color(0xFFF59E0B)),
        Tool("documents", "Documents", "${state.documents.size} documents · treatments, notes, research", Icons.Outlined.Article, Color(0xFF3B82F6)),
        Tool("gear", "Gear", "${state.gear.size} items · ${state.checkouts.size} checked out", Icons.Outlined.Inventory2, Color(0xFF14B8A6)),
    )

    fun open(tool: Tool) {
        if (tool.key != "editor") return onOpenTool(tool.key)
        if (opening) return
        opening = true
        scope.launch {
            runCatching { vm.scriptForEditor() }.getOrNull()?.let(onOpenEditor)
            opening = false
        }
    }

    Scaffold(
        containerColor = SS.background,
        topBar = { SSTopBar(state.project?.title ?: "Project", onBack) },
    ) { padding ->
        PullToRefreshBox(false, onRefresh = { vm.refresh() }, modifier = Modifier.fillMaxSize().padding(padding)) {
            BoxWithConstraints(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), contentAlignment = Alignment.TopCenter) {
                val wide = maxWidth >= 840.dp
                Box(Modifier.widthIn(max = SS.wideWidth).fillMaxWidth().padding(horizontal = SS.screenPadding).padding(bottom = 40.dp)) {
                    if (wide) {
                        // Tablet: the project at a glance on the left, its tools on the right.
                        Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                            Column(Modifier.width(380.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) { Overview(state) }
                            Column(Modifier.weight(1f)) { ToolGrid(tools, columns = 2, ::open, context) }
                        }
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Overview(state)
                            ToolGrid(tools, columns = 1, ::open, context)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Overview(state: HubState) {
    val project = state.project
    val accent = project?.let { Color(Project.ACCENT_PALETTE[it.accentSeed]) } ?: SS.accent
    SSCard(glow = accent) {
        Box(Modifier.width(44.dp).height(4.dp).background(Brush.horizontalGradient(listOf(accent, accent.copy(alpha = 0.25f))), CircleShape))
        Spacer(Modifier.height(12.dp))
        Text(project?.title ?: "", style = MaterialTheme.typography.headlineSmall, color = SS.textPrimary)
        Spacer(Modifier.height(6.dp))
        if (project != null) Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Chip(project.resolvedStatus.label, project.resolvedStatus.tint)
            Chip(project.resolvedFormat.label, SS.textTertiary)
        }
        project?.logline?.nonEmpty()?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, style = MaterialTheme.typography.bodyMedium, color = SS.textSecondary)
        }
        Spacer(Modifier.height(14.dp))
        HorizontalDivider(color = SS.border)
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth()) {
            StatCell("${state.scenes.size}", "Scenes", Modifier.weight(1f))
            StatCell("${state.shots.size}", "Shots", Modifier.weight(1f))
            StatCell("${state.characters.size}", "Characters", Modifier.weight(1f))
            if (state.pages > 0) StatCell(String.format(java.util.Locale.US, "%.1f", state.pages), "Pages", Modifier.weight(1f))
        }
    }

    state.nextEvent?.let { event ->
        SSCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconTile(Icons.Outlined.Videocam, event.type.tint)
                Spacer(Modifier.width(14.dp))
                Column {
                    Text("NEXT UP · ${dayLabel(event.day).uppercase()}", style = MaterialTheme.typography.labelSmall, color = event.type.tint)
                    Text(event.title, style = MaterialTheme.typography.titleMedium, color = SS.textPrimary)
                    Text(timeRange(event), style = MaterialTheme.typography.bodySmall, color = SS.textTertiary)
                }
            }
        }
    }

    if (state.scenes.isNotEmpty() || state.shots.isNotEmpty()) {
        SSCard {
            Text("Progress", style = MaterialTheme.typography.titleMedium, color = SS.textPrimary)
            if (state.scenes.isNotEmpty()) {
                val done = state.scenes.count { it.done }
                ProgressLine("Scenes shot", "$done of ${state.scenes.size}", done.toFloat() / state.scenes.size, SS.accent)
            }
            if (state.shots.isNotEmpty()) {
                val done = state.shots.count { it.done }
                ProgressLine("Shots covered", "$done of ${state.shots.size}", done.toFloat() / state.shots.size, SS.success)
            }
        }
    }
    state.error?.let { Text(it, color = SS.warning, style = MaterialTheme.typography.bodySmall) }
}

@Composable
private fun ProgressLine(title: String, detail: String, fraction: Float, tint: Color) {
    Spacer(Modifier.height(12.dp))
    Row(Modifier.fillMaxWidth()) {
        Text(title, style = MaterialTheme.typography.bodyMedium, color = SS.textSecondary, modifier = Modifier.weight(1f))
        Text(detail, style = MaterialTheme.typography.bodyMedium, color = SS.textPrimary)
    }
    Spacer(Modifier.height(6.dp))
    ProgressBar(fraction, tint)
}

@Composable
private fun ToolGrid(tools: List<Tool>, columns: Int, onOpen: (Tool) -> Unit, context: android.content.Context) {
    Text("Tools", style = MaterialTheme.typography.titleMedium, color = SS.textPrimary, modifier = Modifier.padding(bottom = 10.dp, top = 4.dp))
    Column(verticalArrangement = Arrangement.spacedBy(SS.rowSpacing)) {
        tools.chunked(columns).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(SS.rowSpacing)) {
                row.forEach { tool ->
                    Box(Modifier.weight(1f)) { ToolRow(tool.title, tool.subtitle, tool.icon, tool.tint) { onOpen(tool) } }
                }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
        // Budget, call sheets, storyboards and the broadcast suites need a big
        // screen; they stay on the web, one tap away.
        ToolRow("More on the web", "Budget, call sheets, storyboards and more", Icons.Outlined.Language, SS.textSecondary) {
            openUrl(context, BuildConfig.SITE_URL)
        }
    }
}

@Composable
private fun ToolRow(title: String, subtitle: String, icon: ImageVector, tint: Color, onClick: () -> Unit) {
    SSCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconTile(icon, tint)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium, color = SS.textPrimary)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = SS.textTertiary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = SS.textTertiary, modifier = Modifier.size(22.dp))
        }
    }
}
