package no.northem.screenplaystudio.ui

import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import no.northem.screenplaystudio.ui.characters.CharactersScreen
import no.northem.screenplaystudio.ui.editor.ScriptEditorScreen
import no.northem.screenplaystudio.ui.hub.ProjectHubScreen
import no.northem.screenplaystudio.ui.projects.ProjectsScreen
import no.northem.screenplaystudio.ui.scenes.ScenesScreen
import no.northem.screenplaystudio.ui.schedule.ScheduleScreen
import no.northem.screenplaystudio.ui.schedule.TodayScreen
import no.northem.screenplaystudio.ui.settings.SettingsScreen
import no.northem.screenplaystudio.ui.shots.ShotsScreen
import no.northem.screenplaystudio.ui.slate.SlateScreen

object Routes {
    fun project(id: String) = "project/$id"
    fun editor(projectId: String, scriptId: String) = "project/$projectId/editor/$scriptId"
    fun tool(projectId: String, tool: String) = "project/$projectId/$tool"
}

@Composable
fun AppNavHost(nav: NavHostController) {
    val back: () -> Unit = { nav.popBackStack() }
    NavHost(
        navController = nav,
        startDestination = TopLevel.PROJECTS.route,
        enterTransition = { slideInHorizontally { it / 6 } + fadeIn() },
        exitTransition = { fadeOut() },
        popEnterTransition = { fadeIn() },
        popExitTransition = { slideOutHorizontally { it / 6 } + fadeOut() },
    ) {
        composable(TopLevel.PROJECTS.route) {
            ProjectsScreen(onOpen = { nav.navigate(Routes.project(it.id)) })
        }
        composable(TopLevel.TODAY.route) {
            TodayScreen(onOpenProject = { nav.navigate(Routes.project(it)) })
        }
        composable(TopLevel.SETTINGS.route) { SettingsScreen() }

        composable("project/{id}") { e ->
            val id = e.arguments?.getString("id").orEmpty()
            ProjectHubScreen(
                projectId = id,
                onBack = back,
                onOpenEditor = { scriptId -> nav.navigate(Routes.editor(id, scriptId)) },
                onOpenTool = { tool -> nav.navigate(Routes.tool(id, tool)) },
            )
        }
        composable("project/{id}/editor/{scriptId}") { e ->
            ScriptEditorScreen(
                scriptId = e.arguments?.getString("scriptId").orEmpty(),
                onBack = back,
            )
        }
        composable("project/{id}/scenes") { e -> ScenesScreen(e.arguments?.getString("id").orEmpty(), back) }
        composable("project/{id}/shots") { e -> ShotsScreen(e.arguments?.getString("id").orEmpty(), back) }
        composable("project/{id}/schedule") { e -> ScheduleScreen(e.arguments?.getString("id").orEmpty(), back) }
        composable("project/{id}/characters") { e -> CharactersScreen(e.arguments?.getString("id").orEmpty(), back) }
        composable("project/{id}/slate") { e -> SlateScreen(e.arguments?.getString("id").orEmpty(), back) }
    }
}

/** DEBUG: `--es ss-route editor` opens straight onto a screen of the demo project. */
object DebugRoutes {
    private const val DEMO_PROJECT = "22222222-2222-4222-8222-222222222222"
    private const val DEMO_SCRIPT = "44444444-4444-4444-8444-444444444444"

    fun open(nav: NavHostController, route: String) {
        when (route) {
            "today" -> nav.navigate(TopLevel.TODAY.route)
            "settings" -> nav.navigate(TopLevel.SETTINGS.route)
            "hub" -> nav.navigate(Routes.project(DEMO_PROJECT))
            "editor" -> { nav.navigate(Routes.project(DEMO_PROJECT)); nav.navigate(Routes.editor(DEMO_PROJECT, DEMO_SCRIPT)) }
            "scenes", "shots", "schedule", "characters", "slate" -> {
                nav.navigate(Routes.project(DEMO_PROJECT)); nav.navigate(Routes.tool(DEMO_PROJECT, route))
            }
        }
    }
}
