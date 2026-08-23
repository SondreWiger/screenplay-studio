import SwiftUI

/// The signed-in shell.
///
/// Three tabs, because a thumb reaches three targets comfortably and the work
/// splits cleanly: what you're writing, what's happening today, and everything
/// else. Every production tool lives under a project rather than in the tab bar,
/// which keeps the bar stable as the tool list grows.
struct MainTabView: View {

    @StateObject private var router = Router()

    var body: some View {
        TabView(selection: tabSelection) {
            NavigationStack(path: $router.projectsPath) {
                ProjectsView()
            }
            .tabItem {
                Label("Projects", systemImage: "film.stack")
            }
            .tag(Router.Tab.projects)

            NavigationStack(path: $router.todayPath) {
                TodayView()
            }
            .tabItem {
                Label("Today", systemImage: "calendar.day.timeline.left")
            }
            .tag(Router.Tab.today)

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape")
            }
            .tag(Router.Tab.settings)
        }
        .tint(Theme.accent)
        .environmentObject(router)
        .task {
            #if DEBUG
            DemoData.applyInitialRoute(to: router)
            #endif
        }
    }

    /// Intercepts selection so tapping the current tab again pops to root.
    private var tabSelection: Binding<Router.Tab> {
        Binding(
            get: { router.selectedTab },
            set: { newValue in
                if newValue == router.selectedTab {
                    router.popToRoot(newValue)
                } else {
                    Haptics.selectionChanged()
                    router.selectedTab = newValue
                }
            }
        )
    }
}
