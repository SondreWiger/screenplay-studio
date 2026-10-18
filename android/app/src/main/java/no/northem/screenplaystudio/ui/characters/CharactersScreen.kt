package no.northem.screenplaystudio.ui.characters

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.data.ProjectCharacter
import no.northem.screenplaystudio.data.Repository
import no.northem.screenplaystudio.data.Supabase
import no.northem.screenplaystudio.ui.SSTopBar
import no.northem.screenplaystudio.ui.components.Avatar
import no.northem.screenplaystudio.ui.components.Chip
import no.northem.screenplaystudio.ui.components.EmptyState
import no.northem.screenplaystudio.ui.components.PrimaryButton
import no.northem.screenplaystudio.ui.components.SSCard
import no.northem.screenplaystudio.ui.components.SkeletonList
import no.northem.screenplaystudio.ui.components.parseHexColor
import no.northem.screenplaystudio.ui.friendly
import no.northem.screenplaystudio.ui.projects.SSSheet
import no.northem.screenplaystudio.ui.projects.SheetField
import no.northem.screenplaystudio.ui.theme.SS

class CharactersViewModel(private val projectId: String) : ViewModel() {
    val characters = MutableStateFlow(Supabase.cached(Repository.charactersQuery(projectId), ProjectCharacter.serializer()))
    val error = MutableStateFlow<String?>(null)

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        runCatching { characters.value = Repository.fetchCharacters(projectId); error.value = null }
            .onFailure { error.value = friendly(it); if (characters.value == null) characters.value = emptyList() }
    }

    suspend fun create(name: String, description: String, lead: Boolean, color: String) {
        val order = (characters.value?.maxOfOrNull { it.sortOrder ?: 0 } ?: -1) + 1
        Repository.createCharacter(projectId, name, description, lead, color, order)?.let { c -> characters.update { it.orEmpty() + c } }
    }
}

private val SWATCHES = listOf("#FF5F1F", "#8B5CF6", "#06B6D4", "#22C55E", "#EC4899", "#F59E0B", "#3B82F6", "#EF4444")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CharactersScreen(projectId: String, onBack: () -> Unit) {
    val vm: CharactersViewModel = viewModel(key = "chars-$projectId") { CharactersViewModel(projectId) }
    val characters by vm.characters.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var adding by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = SS.background,
        topBar = { SSTopBar("Characters", onBack, subtitle = characters?.let { "${it.size} characters · ${it.count { c -> c.lead }} leads" }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { adding = true }, containerColor = SS.accent, contentColor = Color.White) { Icon(Icons.Filled.Add, "New character") }
        },
    ) { padding ->
        PullToRefreshBox(false, { vm.refresh() }, Modifier.fillMaxSize().padding(padding)) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                LazyVerticalGrid(
                    GridCells.Adaptive(340.dp),
                    Modifier.widthIn(max = SS.wideWidth).fillMaxSize(),
                    contentPadding = PaddingValues(start = SS.screenPadding, end = SS.screenPadding, top = 4.dp, bottom = 120.dp),
                    horizontalArrangement = Arrangement.spacedBy(SS.rowSpacing),
                    verticalArrangement = Arrangement.spacedBy(SS.rowSpacing),
                ) {
                    error?.let { item(span = { GridItemSpan(maxLineSpan) }) { Text(it, color = SS.warning) } }
                    val list = characters
                    when {
                        list == null -> item(span = { GridItemSpan(maxLineSpan) }) { SkeletonList(4) }
                        list.isEmpty() -> item(span = { GridItemSpan(maxLineSpan) }) {
                            EmptyState(Icons.Outlined.Groups, "No characters yet", "Add the people in your story. Leads, casting and colours carry through to the script and breakdown.")
                        }
                        else -> items(list.sortedByDescending { it.lead }, key = { it.id }) { c ->
                            SSCard(glow = parseHexColor(c.color).copy(alpha = 0.5f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Avatar(c.initials, parseHexColor(c.color), 48.dp)
                                    Spacer(Modifier.width(14.dp))
                                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Text(c.name, style = MaterialTheme.typography.titleMedium, color = SS.textPrimary)
                                            if (c.lead) Chip("Lead", SS.Brand400, icon = Icons.Filled.Star)
                                        }
                                        c.fullName?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = SS.textTertiary) }
                                        c.subtitle?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = SS.textSecondary, maxLines = 2) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (adding) {
        var name by remember { mutableStateOf("") }
        var description by remember { mutableStateOf("") }
        var lead by remember { mutableStateOf(false) }
        var color by remember { mutableStateOf(SWATCHES.first()) }
        var busy by remember { mutableStateOf(false) }
        var err by remember { mutableStateOf<String?>(null) }
        val scope = rememberCoroutineScope()
        SSSheet("New character", { adding = false }) {
            SheetField("Name", name, { name = it }, placeholder = "MAREN")
            SheetField("Description", description, { description = it }, singleLine = false)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Lead character", color = SS.textPrimary, modifier = Modifier.weight(1f))
                Switch(lead, { lead = it })
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SWATCHES.forEach { hex ->
                    Box(
                        Modifier.size(36.dp).background(parseHexColor(hex), CircleShape)
                            .then(if (hex == color) Modifier.border(3.dp, Color.White, CircleShape) else Modifier)
                            .clickable { color = hex }
                    )
                }
            }
            err?.let { Text(it, color = SS.danger) }
            PrimaryButton("Add character", {
                busy = true
                scope.launch {
                    try { vm.create(name, description, lead, color); adding = false } catch (e: Exception) { err = friendly(e) } finally { busy = false }
                }
            }, enabled = name.isNotBlank(), loading = busy)
        }
    }
}
