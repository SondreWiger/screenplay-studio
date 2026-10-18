package no.northem.screenplaystudio.ui.schedule

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.data.Repository
import no.northem.screenplaystudio.data.ScheduleEvent
import no.northem.screenplaystudio.ui.ProjectMemory
import no.northem.screenplaystudio.ui.SSLargeTopBar
import no.northem.screenplaystudio.ui.friendly
import no.northem.screenplaystudio.ui.theme.SS
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** What's on across every project, today and the next week. */
class TodayViewModel : ViewModel() {
    val events = MutableStateFlow<List<ScheduleEvent>?>(null)
    val error = MutableStateFlow<String?>(null)

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        try {
            val projects = Repository.fetchProjects().onEach { ProjectMemory.byId[it.id] = it }
            if (projects.isEmpty()) { events.value = emptyList(); return@launch }
            val zone = ZoneId.systemDefault()
            val from = LocalDate.now().atStartOfDay(zone).toInstant()
            val to = LocalDate.now().plusDays(8).atStartOfDay(zone).toInstant()
            val rows = no.northem.screenplaystudio.data.Supabase.select(
                Repository.scheduleWindowQuery(projects.map { it.id }, from, to), ScheduleEvent.serializer(),
            )
            events.value = rows
            error.value = null
        } catch (e: Exception) {
            error.value = friendly(e)
            if (events.value == null) events.value = emptyList()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(onOpenProject: (String) -> Unit, vm: TodayViewModel = viewModel()) {
    val events by vm.events.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Scaffold(
        modifier = Modifier.nestedScroll(scroll.nestedScrollConnection),
        containerColor = SS.background,
        topBar = { SSLargeTopBar("Today", scroll) },
    ) { padding ->
        PullToRefreshBox(false, { vm.refresh() }, Modifier.fillMaxSize().padding(padding)) {
            Agenda(
                events = events,
                error = error,
                showProject = true,
                onToggle = null,
                emptyTitle = "A clear week",
                emptyMessage = "Nothing is scheduled across your projects for the next seven days.",
                onOpenProject = onOpenProject,
                header = {
                    Column(Modifier.padding(bottom = 4.dp)) {
                        Text(
                            LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE d MMMM")),
                            style = MaterialTheme.typography.titleMedium, color = SS.textSecondary,
                        )
                        val todayCount = events?.count { it.day == LocalDate.now() } ?: 0
                        Text(
                            when (todayCount) { 0 -> "Nothing on today"; 1 -> "1 thing on today"; else -> "$todayCount things on today" },
                            style = MaterialTheme.typography.bodyMedium, color = SS.textTertiary,
                        )
                    }
                },
            )
        }
    }
}
