package no.northem.screenplaystudio.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteDefaults
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffoldDefaults
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteType
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import no.northem.screenplaystudio.data.Supabase
import no.northem.screenplaystudio.ui.auth.SignInScreen
import no.northem.screenplaystudio.ui.theme.SS
import no.northem.screenplaystudio.ui.theme.ScreenplayTheme

enum class TopLevel(val route: String, val label: String, val icon: ImageVector, val selectedIcon: ImageVector) {
    PROJECTS("projects", "Projects", Icons.Outlined.Movie, Icons.Filled.Movie),
    TODAY("today", "Today", Icons.Outlined.CalendarToday, Icons.Filled.CalendarToday),
    SETTINGS("settings", "Settings", Icons.Outlined.Settings, Icons.Filled.Settings),
}

@Composable
fun AppRoot(initialRoute: String?) {
    ScreenplayTheme {
        val session by Supabase.session.collectAsStateWithLifecycle()
        Box(Modifier.fillMaxSize().background(SS.background)) {
            AnimatedContent(session != null, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "auth") { signedIn ->
                if (signedIn) MainShell(initialRoute) else SignInScreen()
            }
        }
    }
}

/**
 * Three destinations, as on iOS: what you're writing, what's happening today,
 * and everything else. A bottom bar on phones, a rail on tablets and
 * foldables — chosen by the window size, not the device.
 */
@Composable
private fun MainShell(initialRoute: String?) {
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val current = TopLevel.entries.firstOrNull { route?.startsWith(it.route) == true }
        ?: if (route?.startsWith("project") == true) TopLevel.PROJECTS else TopLevel.PROJECTS

    // The editor and the slate want the whole screen on a phone.
    val immersive = route?.contains("/editor/") == true || route?.endsWith("/slate") == true
    val adaptive = currentWindowAdaptiveInfo()
    val layout = when {
        immersive && NavigationSuiteScaffoldDefaults.calculateFromAdaptiveInfo(adaptive) == NavigationSuiteType.NavigationBar ->
            NavigationSuiteType.None
        else -> NavigationSuiteScaffoldDefaults.calculateFromAdaptiveInfo(adaptive)
    }

    val itemColors = NavigationSuiteDefaults.itemColors(
        navigationBarItemColors = NavigationBarItemDefaults.colors(
            selectedIconColor = SS.accent, selectedTextColor = SS.accent,
            indicatorColor = SS.accentSoft,
            unselectedIconColor = SS.textTertiary, unselectedTextColor = SS.textTertiary,
        ),
        navigationRailItemColors = NavigationRailItemDefaults.colors(
            selectedIconColor = SS.accent, selectedTextColor = SS.accent,
            indicatorColor = SS.accentSoft,
            unselectedIconColor = SS.textTertiary, unselectedTextColor = SS.textTertiary,
        ),
        navigationDrawerItemColors = NavigationDrawerItemDefaults.colors(
            selectedContainerColor = SS.accentSoft,
            selectedIconColor = SS.accent, selectedTextColor = SS.accent,
        ),
    )

    NavigationSuiteScaffold(
        layoutType = layout,
        containerColor = SS.background,
        navigationSuiteColors = NavigationSuiteDefaults.colors(
            navigationBarContainerColor = SS.S900,
            navigationRailContainerColor = SS.S900,
            navigationDrawerContainerColor = SS.S900,
        ),
        navigationSuiteItems = {
            TopLevel.entries.forEach { dest ->
                val selected = dest == current
                item(
                    selected = selected,
                    onClick = { nav.navigateTopLevel(dest, reselect = selected) },
                    icon = { Icon(if (selected) dest.selectedIcon else dest.icon, contentDescription = null) },
                    label = { Text(dest.label) },
                    colors = itemColors,
                )
            }
        },
    ) {
        AppNavHost(nav)
    }

    LaunchedEffect(initialRoute) {
        if (initialRoute != null) DebugRoutes.open(nav, initialRoute)
    }
}

/** Tapping the current destination again pops it to its root, as on iOS. */
private fun NavHostController.navigateTopLevel(dest: TopLevel, reselect: Boolean) {
    if (reselect) {
        popBackStack(dest.route, inclusive = false)
        return
    }
    navigate(dest.route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
