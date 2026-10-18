package no.northem.screenplaystudio.ui.schedule

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.data.Realtime
import no.northem.screenplaystudio.data.Repository
import no.northem.screenplaystudio.data.merged
import no.northem.screenplaystudio.data.ScheduleEvent
import no.northem.screenplaystudio.data.ScheduleEventType
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
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.temporal.ChronoUnit

private val timeFormat = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)

fun timeRange(event: ScheduleEvent): String {
    if (event.allDay == true) return "All day"
    val zone = ZoneId.systemDefault()
    return "${timeFormat.format(event.start.atZone(zone))} – ${timeFormat.format(event.end.atZone(zone))}"
}

fun dayLabel(day: LocalDate): String {
    val today = LocalDate.now()
    return when (day) {
        today -> "Today"
        today.plusDays(1) -> "Tomorrow"
        today.minusDays(1) -> "Yesterday"
        else -> day.format(DateTimeFormatter.ofPattern("EEEE d MMMM"))
    }
}

class ScheduleViewModel(private val projectId: String) : ViewModel() {
    val events = MutableStateFlow(Supabase.cached(Repository.scheduleQuery(projectId), ScheduleEvent.serializer()))
    val error = MutableStateFlow<String?>(null)

    init {
        refresh()
        viewModelScope.launch {
            Realtime.changes("production_schedule", "project_id=eq.$projectId").collect { change ->
                events.value?.merged(change, ScheduleEvent.serializer(), { it.id }, sort = compareBy { it.start })?.let { events.value = it }
            }
        }
    }

    fun refresh() = viewModelScope.launch {
        runCatching { Repository.fetchSchedule(projectId) }
            .onSuccess { events.value = it; error.value = null }
            .onFailure { error.value = friendly(it) }
    }

    fun toggleConfirmed(event: ScheduleEvent) = viewModelScope.launch {
        val before = events.value
        events.update { list -> list?.map { if (it.id == event.id) it.copy(isConfirmed = !event.confirmed) else it } }
        runCatching { Repository.setEventConfirmed(event.id, !event.confirmed) }.onFailure { events.value = before; error.value = friendly(it) }
    }

    suspend fun create(title: String, type: ScheduleEventType, start: Instant, end: Instant, notes: String?) {
        Repository.createEvent(projectId, title, type, start, end, notes)?.let { created ->
            events.update { (it.orEmpty() + created).sortedBy { e -> e.start } }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(projectId: String, onBack: () -> Unit) {
    val vm: ScheduleViewModel = viewModel(key = "schedule-$projectId") { ScheduleViewModel(projectId) }
    val events by vm.events.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var adding by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = SS.background,
        topBar = { SSTopBar("Schedule", onBack, subtitle = ProjectMemory.byId[projectId]?.title) },
        floatingActionButton = {
            FloatingActionButton(onClick = { adding = true }, containerColor = SS.accent, contentColor = Color.White) {
                Icon(Icons.Filled.Add, "New event")
            }
        },
    ) { padding ->
        PullToRefreshBox(false, { vm.refresh() }, Modifier.fillMaxSize().padding(padding)) {
            Agenda(
                events = events,
                error = error,
                showProject = false,
                onToggle = vm::toggleConfirmed,
                emptyTitle = "Nothing scheduled",
                emptyMessage = "Add shoot days, rehearsals and recces. They show up here and on the Today tab.",
            )
        }
    }
    if (adding) NewEventSheet(onDismiss = { adding = false }, onCreate = vm::create)
}

/** An agenda grouped by day — not a month grid, which gives a day ~50dp: enough for a dot, not a call time. */
@Composable
fun Agenda(
    events: List<ScheduleEvent>?,
    error: String?,
    showProject: Boolean,
    onToggle: ((ScheduleEvent) -> Unit)?,
    emptyTitle: String,
    emptyMessage: String,
    onOpenProject: ((String) -> Unit)? = null,
    header: (@Composable () -> Unit)? = null,
) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        LazyColumn(
            Modifier.widthIn(max = SS.readableWidth).fillMaxSize(),
            contentPadding = PaddingValues(start = SS.screenPadding, end = SS.screenPadding, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(SS.rowSpacing),
        ) {
            header?.let { item { it() } }
            when {
                events == null -> item { SkeletonList(4) }
                events.isEmpty() -> item {
                    if (error != null) Text(error, color = SS.warning, style = MaterialTheme.typography.bodySmall)
                    EmptyState(Icons.Outlined.CalendarMonth, emptyTitle, emptyMessage)
                }
                else -> {
                    if (error != null) item { Text(error, color = SS.warning, style = MaterialTheme.typography.bodySmall) }
                    events.groupBy { it.day }.toSortedMap().forEach { (day, dayEvents) ->
                        item(key = "h-$day") {
                            Text(
                                dayLabel(day),
                                style = MaterialTheme.typography.titleSmall,
                                color = if (day == LocalDate.now()) SS.accent else SS.textSecondary,
                                modifier = Modifier.padding(top = 14.dp, bottom = 2.dp),
                            )
                        }
                        items(dayEvents, key = { it.id }) { event ->
                            EventRow(event, showProject, onToggle, onOpenProject)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EventRow(event: ScheduleEvent, showProject: Boolean, onToggle: ((ScheduleEvent) -> Unit)?, onOpenProject: ((String) -> Unit)?) {
    val view = LocalView.current
    SSCard(onClick = onOpenProject?.let { { it(event.projectId) } }, padding = PaddingValues(0.dp)) {
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
            Box(Modifier.width(4.dp).fillMaxHeight().background(event.type.tint))
            Column(Modifier.weight(1f).padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(timeRange(event), style = MaterialTheme.typography.labelLarge, color = SS.textSecondary)
                    Chip(event.type.label, event.type.tint)
                }
                Text(event.title, style = MaterialTheme.typography.titleMedium, color = SS.textPrimary)
                event.call?.let {
                    Text("Call ${timeFormat.format(it.atZone(ZoneId.systemDefault()))}", style = MaterialTheme.typography.bodySmall, color = SS.Brand300)
                }
                if (showProject) ProjectMemory.byId[event.projectId]?.let {
                    Text(it.title, style = MaterialTheme.typography.bodySmall, color = SS.textTertiary)
                }
                event.notes?.nonEmpty()?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = SS.textTertiary, maxLines = 3) }
            }
            if (onToggle != null) {
                IconButton(onClick = { view.confirm(); onToggle(event) }, modifier = Modifier.padding(4.dp)) {
                    Icon(
                        if (event.confirmed) Icons.Filled.CheckCircle else Icons.Outlined.RadioButtonUnchecked,
                        if (event.confirmed) "Confirmed — tap to unconfirm" else "Not confirmed — tap to confirm",
                        tint = if (event.confirmed) SS.success else SS.textTertiary,
                    )
                }
            }
        }
    }
}

@Composable
private fun NewEventSheet(onDismiss: () -> Unit, onCreate: suspend (String, ScheduleEventType, Instant, Instant, String?) -> Unit) {
    var title by remember { mutableStateOf("") }
    var type by remember { mutableStateOf(ScheduleEventType.SHOOTING) }
    var dayOffset by remember { mutableIntStateOf(0) }
    var startHour by remember { mutableIntStateOf(8) }
    var hours by remember { mutableIntStateOf(10) }
    var notes by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    SSSheet("New event", onDismiss) {
        SheetField("Title", title, { title = it }, placeholder = "Day 1 — Interiors")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ScheduleEventType.entries.forEach { t -> FilterPill(t.label, type == t, t.tint) { type = t } }
        }
        Stepper("Day", dayLabel(LocalDate.now().plusDays(dayOffset.toLong())), { dayOffset-- }, { dayOffset++ })
        Stepper("Starts", "%02d:00".format(startHour), { startHour = (startHour + 23) % 24 }, { startHour = (startHour + 1) % 24 })
        Stepper("Length", "$hours h", { if (hours > 1) hours-- }, { if (hours < 24) hours++ })
        SheetField("Notes", notes, { notes = it }, singleLine = false)
        error?.let { Text(it, color = SS.danger) }
        PrimaryButton("Add to schedule", {
            busy = true
            scope.launch {
                val start = LocalDate.now().plusDays(dayOffset.toLong()).atTime(startHour, 0).atZone(ZoneId.systemDefault()).toInstant()
                try {
                    onCreate(title, type, start, start.plus(hours.toLong(), ChronoUnit.HOURS), notes)
                    onDismiss()
                } catch (e: Exception) { error = friendly(e) } finally { busy = false }
            }
        }, enabled = title.isNotBlank(), loading = busy)
    }
}

@Composable
fun Stepper(label: String, value: String, onMinus: () -> Unit, onPlus: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(SS.elevated, RoundedCornerShape(SS.radius)).padding(horizontal = 14.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = SS.textTertiary, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.width(72.dp))
        Text(value, color = SS.textPrimary, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
        IconButton(onClick = onMinus) { Text("−", style = MaterialTheme.typography.titleLarge, color = SS.accent) }
        IconButton(onClick = onPlus) { Text("+", style = MaterialTheme.typography.titleLarge, color = SS.accent) }
    }
}
