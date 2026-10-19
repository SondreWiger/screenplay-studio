package no.northem.screenplaystudio.ui.projects

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.data.Project
import no.northem.screenplaystudio.data.ProjectFormat
import no.northem.screenplaystudio.data.ProjectStatus
import no.northem.screenplaystudio.data.Repository
import no.northem.screenplaystudio.data.Supabase
import no.northem.screenplaystudio.data.nonEmpty
import no.northem.screenplaystudio.ui.ProjectMemory
import no.northem.screenplaystudio.ui.SSLargeTopBar
import no.northem.screenplaystudio.ui.components.Chip
import no.northem.screenplaystudio.ui.components.EmptyState
import no.northem.screenplaystudio.ui.components.ErrorState
import no.northem.screenplaystudio.ui.components.FilterPill
import no.northem.screenplaystudio.ui.components.SSCard
import no.northem.screenplaystudio.ui.components.SkeletonList
import no.northem.screenplaystudio.ui.friendly
import no.northem.screenplaystudio.ui.theme.SS
import no.northem.screenplaystudio.ui.tick

data class ProjectsState(
    val projects: List<Project> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
    val search: String = "",
    val filter: ProjectStatus? = null,
) {
    val filtered: List<Project>
        get() = projects.filter { p ->
            (filter == null || p.resolvedStatus == filter) &&
                (search.isBlank() || p.title.contains(search, true) || p.logline?.contains(search, true) == true)
        }
    val counts get() = projects.groupingBy { it.resolvedStatus }.eachCount()
}

class ProjectsViewModel : ViewModel() {
    val state = MutableStateFlow(ProjectsState())
    private val cacheKey = "projects-list"

    init {
        // Paint the last good list immediately; the network refresh follows.
        Supabase.cached(no.northem.screenplaystudio.data.Query(cacheKey), Project.serializer())?.let { cached ->
            state.update { it.copy(projects = cached, loading = false) }
            remember(cached)
        }
        refresh()
    }

    fun refresh() = viewModelScope.launch {
        state.update { it.copy(loading = it.projects.isEmpty()) }
        try {
            val rows = Repository.fetchProjects()
            Supabase.writeKeyed(cacheKey, rows, Project.serializer())
            remember(rows)
            state.update { it.copy(projects = rows, loading = false, error = null) }
        } catch (e: Exception) {
            state.update { it.copy(loading = false, error = friendly(e)) }
        }
    }

    private fun remember(rows: List<Project>) = rows.forEach { ProjectMemory.byId[it.id] = it }

    fun setSearch(text: String) = state.update { it.copy(search = text) }
    fun setFilter(status: ProjectStatus?) = state.update { it.copy(filter = status) }

    suspend fun create(title: String, format: ProjectFormat, logline: String?): Project? {
        val project = Repository.createProject(title, format, logline) ?: return null
        ProjectMemory.byId[project.id] = project
        state.update { it.copy(projects = listOf(project) + it.projects) }
        return project
    }

    /** Optimistic: the change shows at once and rolls back if the server refuses it. */
    fun setStatus(project: Project, status: ProjectStatus) = viewModelScope.launch {
        val before = state.value.projects
        state.update { s -> s.copy(projects = s.projects.map { if (it.id == project.id) it.copy(status = status.raw) else it }) }
        runCatching { Repository.setProjectStatus(project.id, status) }.onFailure { e ->
            state.update { it.copy(projects = before, error = friendly(e)) }
        }
    }

    fun delete(project: Project) = viewModelScope.launch {
        val before = state.value.projects
        state.update { s -> s.copy(projects = s.projects.filterNot { it.id == project.id }) }
        runCatching { Repository.deleteProject(project.id) }.onFailure { e ->
            state.update { it.copy(projects = before, error = friendly(e)) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectsScreen(onOpen: (Project) -> Unit, vm: ProjectsViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    var creating by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<Project?>(null) }
    val snackbar = remember { SnackbarHostState() }
    val view = LocalView.current

    LifecycleResumeEffect(Unit) {
        vm.refresh()
        onPauseOrDispose { }
    }
    LaunchedEffect(state.error) {
        if (state.error != null && state.projects.isNotEmpty()) snackbar.showSnackbar(state.error!!)
    }

    Scaffold(
        modifier = Modifier.nestedScroll(scroll.nestedScrollConnection),
        containerColor = SS.background,
        topBar = { SSLargeTopBar("Projects", scroll) },
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { view.tick(); creating = true },
                icon = { Icon(Icons.Filled.Add, null) },
                text = { Text("New project") },
                containerColor = SS.accent,
                contentColor = Color.White,
            )
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = false,
            onRefresh = { vm.refresh() },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(340.dp),
                    modifier = Modifier.widthIn(max = SS.wideWidth).fillMaxSize(),
                    contentPadding = PaddingValues(start = SS.screenPadding, end = SS.screenPadding, top = 4.dp, bottom = 120.dp),
                    horizontalArrangement = Arrangement.spacedBy(SS.rowSpacing),
                    verticalArrangement = Arrangement.spacedBy(SS.rowSpacing),
                ) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        SearchField(state.search, vm::setSearch)
                    }
                    if (state.projects.isNotEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            StatusFilters(state.filter, state.counts) { view.tick(); vm.setFilter(it) }
                        }
                    }
                    when {
                        state.loading && state.projects.isEmpty() -> item(span = { GridItemSpan(maxLineSpan) }) { SkeletonList(4) }
                        state.error != null && state.projects.isEmpty() -> item(span = { GridItemSpan(maxLineSpan) }) {
                            ErrorState(state.error!!) { vm.refresh() }
                        }
                        state.projects.isEmpty() -> item(span = { GridItemSpan(maxLineSpan) }) {
                            EmptyState(
                                Icons.Outlined.Movie, "No projects yet",
                                "Start a feature, a short, or a series. Everything else — scenes, shots, schedule — hangs off it.",
                                "New project",
                            ) { creating = true }
                        }
                        state.filtered.isEmpty() -> item(span = { GridItemSpan(maxLineSpan) }) {
                            EmptyState(Icons.Outlined.Search, "Nothing matches", "Try a different search, or clear the status filter.")
                        }
                        else -> items(state.filtered, key = { it.id }) { project ->
                            ProjectRow(
                                project,
                                onClick = { onOpen(project) },
                                onStatus = { vm.setStatus(project, it) },
                                onDelete = { pendingDelete = project },
                            )
                        }
                    }
                }
            }
        }
    }

    if (creating) {
        NewProjectSheet(
            onDismiss = { creating = false },
            onCreate = { title, format, logline -> vm.create(title, format, logline)?.also(onOpen) },
        )
    }
    pendingDelete?.let { project ->
        ConfirmDialog(
            title = "Delete “${project.title}”?",
            message = "This deletes the project and everything in it — scripts, scenes, shots and schedule — for everyone on the team. It can't be undone.",
            confirm = "Delete project",
            onConfirm = { vm.delete(project); pendingDelete = null },
            onDismiss = { pendingDelete = null },
        )
    }
}

@Composable
fun SearchField(text: String, onChange: (String) -> Unit, placeholder: String = "Search projects") {
    OutlinedTextField(
        value = text,
        onValueChange = onChange,
        placeholder = { Text(placeholder) },
        leadingIcon = { Icon(Icons.Outlined.Search, null) },
        singleLine = true,
        shape = RoundedCornerShape(SS.radius),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = SS.card, unfocusedContainerColor = SS.card,
            focusedBorderColor = SS.accent, unfocusedBorderColor = SS.border,
        ),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun StatusFilters(selected: ProjectStatus?, counts: Map<ProjectStatus, Int>, onSelect: (ProjectStatus?) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item { FilterPill("All", selected == null) { onSelect(null) } }
        items(ProjectStatus.entries.filter { (counts[it] ?: 0) > 0 }) { status ->
            FilterPill("${status.label} ${counts[status]}", selected == status, status.tint) {
                onSelect(if (selected == status) null else status)
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ProjectRow(project: Project, onClick: () -> Unit, onStatus: (ProjectStatus) -> Unit, onDelete: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    val accent = Color(Project.ACCENT_PALETTE[project.accentSeed])
    val view = LocalView.current
    Box {
        SSCard(
            modifier = Modifier.combinedClickable(onClick = onClick, onLongClick = { view.tick(); menu = true }),
            glow = accent.copy(alpha = 0.6f),
        ) {
            Row(Modifier.heightIn(min = 64.dp), verticalAlignment = Alignment.CenterVertically) {
                // Colour spine, so a long list is scannable at a glance.
                Box(
                    Modifier.width(4.dp).height(56.dp)
                        .background(Brush.verticalGradient(listOf(accent, accent.copy(alpha = 0.3f))), RoundedCornerShape(3.dp))
                )
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(project.title, style = MaterialTheme.typography.titleMedium, color = SS.textPrimary, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    project.logline?.nonEmpty()?.let {
                        Text(it, style = MaterialTheme.typography.bodyMedium, color = SS.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Chip(project.resolvedStatus.label, project.resolvedStatus.tint)
                        Chip(project.resolvedFormat.label, SS.textTertiary)
                        project.genreSummary?.let {
                            Text(it, style = MaterialTheme.typography.bodySmall, color = SS.textTertiary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = SS.textTertiary)
            }
        }
        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
            Text("Change status", style = MaterialTheme.typography.labelSmall, color = SS.textTertiary, modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp))
            ProjectStatus.entries.forEach { status ->
                DropdownMenuItem(
                    text = { Text(status.label) },
                    enabled = status != project.resolvedStatus,
                    onClick = { menu = false; onStatus(status) },
                )
            }
            HorizontalDivider()
            DropdownMenuItem(text = { Text("Delete project", color = SS.danger) }, onClick = { menu = false; onDelete() })
        }
    }
}

@Composable
fun ConfirmDialog(title: String, message: String, confirm: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = { androidx.compose.material3.TextButton(onClick = onConfirm) { Text(confirm, color = SS.danger) } },
        dismissButton = { androidx.compose.material3.TextButton(onClick = onDismiss) { Text("Cancel") } },
        containerColor = SS.elevated,
    )
}
