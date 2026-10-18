package no.northem.screenplaystudio.ui.gear

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridItemSpanScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Login
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.outlined.Brush
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Checkroom
import androidx.compose.material.icons.outlined.ContentCut
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Lens
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.data.GearCategory
import no.northem.screenplaystudio.data.GearCheckout
import no.northem.screenplaystudio.data.GearItem
import no.northem.screenplaystudio.data.GearOwnership
import no.northem.screenplaystudio.data.GearStatus
import no.northem.screenplaystudio.data.PostgresDate
import no.northem.screenplaystudio.data.Repository
import no.northem.screenplaystudio.data.Supabase
import no.northem.screenplaystudio.data.nonEmpty
import no.northem.screenplaystudio.ui.ProjectMemory
import no.northem.screenplaystudio.ui.SSTopBar
import no.northem.screenplaystudio.ui.components.Chip
import no.northem.screenplaystudio.ui.components.EmptyState
import no.northem.screenplaystudio.ui.components.FilterPill
import no.northem.screenplaystudio.ui.components.IconTile
import no.northem.screenplaystudio.ui.components.PrimaryButton
import no.northem.screenplaystudio.ui.components.SSCard
import no.northem.screenplaystudio.ui.components.SkeletonList
import no.northem.screenplaystudio.ui.components.StatCell
import no.northem.screenplaystudio.ui.confirm
import no.northem.screenplaystudio.ui.friendly
import no.northem.screenplaystudio.ui.projects.ConfirmDialog
import no.northem.screenplaystudio.ui.projects.SSSheet
import no.northem.screenplaystudio.ui.projects.SearchField
import no.northem.screenplaystudio.ui.projects.SheetField
import no.northem.screenplaystudio.ui.relativeTime
import no.northem.screenplaystudio.ui.theme.SS
import no.northem.screenplaystudio.ui.tick
import java.time.Instant

/** Gear and who has it — GearViewModel.swift. */
class GearViewModel(private val projectId: String) : ViewModel() {
    val items = MutableStateFlow(Supabase.cached(Repository.gearQuery(projectId), GearItem.serializer()))
    val checkouts = MutableStateFlow(Supabase.cached(Repository.activeCheckoutsQuery(projectId), GearCheckout.serializer()).orEmpty())
    val error = MutableStateFlow<String?>(null)

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        runCatching {
            items.value = Repository.fetchGear(projectId)
            checkouts.value = Repository.fetchActiveCheckouts(projectId)
            error.value = null
        }.onFailure { error.value = friendly(it); if (items.value == null) items.value = emptyList() }
    }

    fun activeCheckout(gearId: String) = checkouts.value.firstOrNull { it.gearId == gearId && it.active }

    fun cycleStatus(item: GearItem) = viewModelScope.launch {
        val next = item.resolvedStatus.next
        val before = items.value
        items.update { list -> list?.map { if (it.id == item.id) it.copy(status = next.raw) else it } }
        runCatching { Repository.setGearStatus(item.id, next) }.onFailure { items.value = before; error.value = friendly(it) }
    }

    fun delete(item: GearItem) = viewModelScope.launch {
        val before = items.value
        items.update { list -> list?.filterNot { it.id == item.id } }
        runCatching { Repository.deleteGear(item.id) }.onFailure { items.value = before; error.value = friendly(it) }
    }

    suspend fun create(
        name: String, category: GearCategory, quantity: Int, unit: String,
        ownership: GearOwnership, vendor: String?, dailyRate: Double?, notes: String?,
    ) {
        Repository.createGear(projectId, name, category, quantity, unit, ownership, vendor, dailyRate, notes)?.let { created ->
            items.update { (it.orEmpty() + created).sortedWith(compareBy({ g -> g.resolvedCategory.raw }, { g -> g.name })) }
        }
    }

    suspend fun checkOut(item: GearItem, name: String, notes: String?) {
        Repository.checkOutGear(projectId, item.id, name, notes)?.let { c -> checkouts.update { listOf(c) + it } }
    }

    fun giveBack(checkout: GearCheckout) = viewModelScope.launch {
        val before = checkouts.value
        checkouts.update { list -> list.filterNot { it.id == checkout.id } }
        runCatching { Repository.returnGear(checkout.id) }.onFailure { checkouts.value = before; error.value = friendly(it) }
    }

    /** Past checkouts for one item. The just-returned one is stamped locally so history reads right offline. */
    suspend fun history(gearId: String): List<GearCheckout> {
        val active = checkouts.value.filter { it.gearId == gearId }
        val remote = runCatching { Repository.fetchCheckoutHistory(gearId) }.getOrDefault(emptyList())
        return (active + remote.filterNot { r -> active.any { it.id == r.id } })
            .map { r -> if (r.active && active.none { it.id == r.id }) r.copy(returnedAt = PostgresDate.format(Instant.now())) else r }
            .sortedByDescending { it.outAt }
    }
}

val GearCategory.icon: ImageVector
    get() = when (this) {
        GearCategory.CAMERA -> Icons.Outlined.CameraAlt
        GearCategory.LENSES -> Icons.Outlined.Lens
        GearCategory.LIGHTING -> Icons.Outlined.Lightbulb
        GearCategory.GRIP -> Icons.Outlined.Build
        GearCategory.SOUND -> Icons.Outlined.GraphicEq
        GearCategory.ART_DEPT -> Icons.Outlined.Brush
        GearCategory.COSTUME -> Icons.Outlined.Checkroom
        GearCategory.HAIR_MAKEUP -> Icons.Outlined.ContentCut
        GearCategory.LOCATIONS -> Icons.Outlined.Map
        GearCategory.TRANSPORT -> Icons.Outlined.DirectionsCar
        GearCategory.POST_DIT -> Icons.Outlined.Storage
        GearCategory.OTHER -> Icons.Outlined.Inventory2
    }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GearScreen(projectId: String, onBack: () -> Unit) {
    val vm: GearViewModel = viewModel(key = "gear-$projectId") { GearViewModel(projectId) }
    val items by vm.items.collectAsStateWithLifecycle()
    val checkouts by vm.checkouts.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    var status by rememberSaveable { mutableStateOf<String?>(null) }
    var search by rememberSaveable { mutableStateOf("") }
    var adding by remember { mutableStateOf(false) }
    var checkoutFor by remember { mutableStateOf<GearItem?>(null) }
    var deleting by remember { mutableStateOf<GearItem?>(null) }

    Scaffold(
        containerColor = SS.background,
        topBar = {
            SSTopBar("Gear", onBack, subtitle = items?.let { "${it.size} items · ${checkouts.size} checked out" } ?: ProjectMemory.byId[projectId]?.title)
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { adding = true }, containerColor = SS.accent, contentColor = Color.White) { Icon(Icons.Filled.Add, "Add gear") }
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
                    val full: LazyGridItemSpanScope.() -> GridItemSpan = { GridItemSpan(maxLineSpan) }
                    error?.let { item(span = full) { Text(it, color = SS.warning, style = MaterialTheme.typography.bodySmall) } }
                    val list = items
                    if (list == null) {
                        item(span = full) { SkeletonList(5) }
                        return@LazyVerticalGrid
                    }
                    if (list.isNotEmpty()) {
                        item(span = full) { Summary(list, checkouts) }
                        item(span = full) { SearchField(search, { search = it }, placeholder = "Search gear") }
                        item(span = full) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    FilterPill("All", category == null, SS.accent) { category = null }
                                    list.map { it.resolvedCategory }.distinct().sortedBy { it.raw }.forEach { c ->
                                        FilterPill(c.label, category == c.raw, c.tint) { category = c.raw }
                                    }
                                }
                                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    FilterPill("Any status", status == null, SS.accent) { status = null }
                                    GearStatus.entries.forEach { s -> FilterPill(s.label, status == s.raw, s.tint) { status = s.raw } }
                                }
                            }
                        }
                    }
                    val term = search.trim().lowercase()
                    val filtered = list.filter { g ->
                        (category == null || g.resolvedCategory.raw == category) &&
                            (status == null || g.resolvedStatus.raw == status) &&
                            (term.isEmpty() || g.name.lowercase().contains(term) || g.resolvedCategory.raw.lowercase().contains(term) ||
                                g.vendor?.lowercase()?.contains(term) == true)
                    }
                    if (filtered.isEmpty()) {
                        item(span = full) {
                            if (list.isEmpty()) EmptyState(Icons.Outlined.Inventory2, "No gear yet", "Add cameras, lenses, lights and more — then check them in and out of video village.", "Add gear") { adding = true }
                            else EmptyState(Icons.Outlined.Inventory2, "No matching items", "Try a different filter or search.")
                        }
                    }
                    filtered.groupBy { it.resolvedCategory }.toSortedMap(compareBy { it.raw }).forEach { (cat, group) ->
                        item(span = full, key = "h-${cat.raw}") {
                            Text(
                                "${cat.label} · ${group.size}", style = MaterialTheme.typography.titleSmall,
                                color = SS.textSecondary, modifier = Modifier.padding(top = 10.dp),
                            )
                        }
                        items(group, key = { it.id }) { item ->
                            GearRow(item, checkouts.firstOrNull { it.gearId == item.id }, { checkoutFor = item }, { vm.cycleStatus(item) }, { deleting = item })
                        }
                    }
                }
            }
        }
    }

    if (adding) NewGearSheet({ adding = false }, vm::create)
    checkoutFor?.let { item -> CheckoutSheet(item, vm, checkouts.firstOrNull { it.gearId == item.id }) { checkoutFor = null } }
    deleting?.let { item ->
        ConfirmDialog("Delete ${item.name}?", "It's removed from the gear list for everyone.", "Delete",
            onConfirm = { vm.delete(item); deleting = null }, onDismiss = { deleting = null })
    }
}

@Composable
private fun Summary(items: List<GearItem>, checkouts: List<GearCheckout>) {
    SSCard {
        Row(Modifier.fillMaxWidth()) {
            StatCell("${items.size}", "Items", Modifier.weight(1f))
            StatCell("${checkouts.size}", "Checked out", Modifier.weight(1f))
            StatCell("${items.count { it.resolvedStatus == GearStatus.CONFIRMED }}", "Confirmed", Modifier.weight(1f))
            StatCell("${items.count { it.resolvedStatus == GearStatus.PENDING }}", "Pending", Modifier.weight(1f))
        }
    }
}

@Composable
private fun GearRow(item: GearItem, out: GearCheckout?, onCheckout: () -> Unit, onCycle: () -> Unit, onDelete: () -> Unit) {
    val view = LocalView.current
    var menu by remember { mutableStateOf(false) }
    val cat = item.resolvedCategory
    SSCard(onClick = onCheckout, padding = PaddingValues(start = 14.dp, top = 12.dp, bottom = 12.dp, end = 4.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            IconTile(cat.icon, cat.tint)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(item.name, style = MaterialTheme.typography.titleMedium, color = SS.textPrimary, maxLines = 2,
                        overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                    if (item.count > 1) Text("  ×${item.count}", style = MaterialTheme.typography.labelLarge, color = SS.textTertiary)
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.clip(CircleShape).clickable(onClickLabel = "Change status") { view.tick(); onCycle() }) {
                        Chip(item.resolvedStatus.label, item.resolvedStatus.tint)
                    }
                    Chip(item.resolvedOwnership.label, item.resolvedOwnership.tint)
                    if (out != null) Chip("With ${out.checkedOutByName}", SS.warning, prominent = true, icon = Icons.Outlined.Person)
                }
                listOfNotNull(item.vendor?.nonEmpty(), item.notes?.nonEmpty()).joinToString(" · ").takeIf { it.isNotEmpty() }?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = SS.textTertiary, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
            Row {
                IconButton(onClick = onCheckout) {
                    if (out != null) Icon(Icons.AutoMirrored.Outlined.Login, "Return gear", tint = SS.warning)
                    else Icon(Icons.AutoMirrored.Outlined.Logout, "Check out gear", tint = SS.success)
                }
                Box {
                    IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, "Gear actions", tint = SS.textTertiary) }
                    DropdownMenu(menu, { menu = false }, containerColor = SS.elevated) {
                        DropdownMenuItem({ Text("Mark ${item.resolvedStatus.next.label.lowercase()}") }, { menu = false; onCycle() })
                        DropdownMenuItem({ Text("Delete", color = SS.danger) }, { menu = false; onDelete() })
                    }
                }
            }
        }
    }
}

/** Check a piece out of video village, or back in, and see who's had it — GearCheckoutSheet.swift. */
@Composable
private fun CheckoutSheet(item: GearItem, vm: GearViewModel, active: GearCheckout?, onDismiss: () -> Unit) {
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    var person by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var history by remember { mutableStateOf<List<GearCheckout>?>(null) }
    LaunchedEffect(item.id, active?.id) { history = vm.history(item.id) }

    SSSheet(item.name, onDismiss) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Chip(item.resolvedCategory.label, item.resolvedCategory.tint, icon = item.resolvedCategory.icon)
            Chip(item.resolvedStatus.label, item.resolvedStatus.tint)
            if (item.count > 1) Chip("×${item.count} ${item.unit.orEmpty()}".trim(), SS.textTertiary)
        }
        if (active != null) {
            SSCard(glow = SS.warning) {
                Text("CURRENTLY WITH", style = MaterialTheme.typography.labelSmall, color = SS.warning)
                Text(active.checkedOutByName, style = MaterialTheme.typography.titleLarge, color = SS.textPrimary)
                Text("Out since ${relativeTime(active.outAt)}", style = MaterialTheme.typography.bodySmall, color = SS.textTertiary)
                active.notes?.nonEmpty()?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = SS.textSecondary, modifier = Modifier.padding(top = 6.dp)) }
            }
            PrimaryButton("Return to video village", {
                view.confirm(); vm.giveBack(active); onDismiss()
            })
        } else {
            Text("Who is taking this from video village?", style = MaterialTheme.typography.bodyMedium, color = SS.textSecondary)
            SheetField("Person", person, { person = it }, placeholder = "Name of crew member")
            SheetField("Notes", notes, { notes = it }, placeholder = "Optional — e.g. B-cam setup at the quay")
            error?.let { Text(it, color = SS.danger) }
            PrimaryButton("Check out", {
                busy = true
                scope.launch {
                    try { vm.checkOut(item, person, notes.nonEmpty()); view.confirm(); onDismiss() }
                    catch (e: Exception) { error = friendly(e) } finally { busy = false }
                }
            }, enabled = person.isNotBlank(), loading = busy)
        }
        HorizontalDivider(color = SS.border)
        Text("History", style = MaterialTheme.typography.titleMedium, color = SS.textPrimary)
        val past = history
        when {
            past == null -> SkeletonList(2)
            past.isEmpty() -> Text("No checkouts yet.", style = MaterialTheme.typography.bodySmall, color = SS.textTertiary)
            else -> past.take(8).forEach { c ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Person, null, tint = if (c.active) SS.warning else SS.textTertiary, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(c.checkedOutByName, style = MaterialTheme.typography.bodyMedium, color = SS.textPrimary)
                        Text(
                            "Out ${relativeTime(c.outAt)} → " + (c.inAt?.let { "in ${relativeTime(it)}" } ?: "still out"),
                            style = MaterialTheme.typography.bodySmall, color = SS.textTertiary,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NewGearSheet(
    onDismiss: () -> Unit,
    onCreate: suspend (String, GearCategory, Int, String, GearOwnership, String?, Double?, String?) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var category by remember { mutableStateOf(GearCategory.CAMERA) }
    var quantity by remember { mutableStateOf("1") }
    var unit by remember { mutableStateOf("") }
    var ownership by remember { mutableStateOf(GearOwnership.RENTED) }
    var vendor by remember { mutableStateOf("") }
    var rate by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    SSSheet("New gear", onDismiss) {
        SheetField("Name", name, { name = it }, placeholder = "ARRI ALEXA Mini LF")
        Text("Category", style = MaterialTheme.typography.labelSmall, color = SS.textTertiary)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            GearCategory.entries.forEach { FilterPill(it.label, category == it, it.tint) { category = it } }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.weight(1f)) { SheetField("Quantity", quantity, { quantity = it.filter(Char::isDigit).take(4) }) }
            Box(Modifier.weight(1f)) { SheetField("Unit", unit, { unit = it }, placeholder = "body") }
        }
        Text("Ownership", style = MaterialTheme.typography.labelSmall, color = SS.textTertiary)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            GearOwnership.entries.forEach { FilterPill(it.label, ownership == it, it.tint) { ownership = it } }
        }
        if (ownership == GearOwnership.RENTED) {
            SheetField("Vendor", vendor, { vendor = it }, placeholder = "Rental house")
            SheetField("Daily rate", rate, { rate = it.filter { c -> c.isDigit() || c == '.' } }, placeholder = "0")
        }
        SheetField("Notes", notes, { notes = it }, singleLine = false)
        error?.let { Text(it, color = SS.danger) }
        PrimaryButton("Add gear", {
            busy = true
            scope.launch {
                try {
                    onCreate(name, category, quantity.toIntOrNull()?.coerceAtLeast(1) ?: 1, unit, ownership,
                        vendor.takeIf { ownership == GearOwnership.RENTED }, rate.toDoubleOrNull().takeIf { ownership == GearOwnership.RENTED }, notes)
                    onDismiss()
                } catch (e: Exception) { error = friendly(e) } finally { busy = false }
            }
        }, enabled = name.isNotBlank(), loading = busy)
    }
}
