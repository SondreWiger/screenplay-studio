import SwiftUI

/// Owns the navigation state for each tab.
///
/// Holding the paths in one observable object (rather than as `@State` inside
/// `MainTabView`) means any screen can push without a binding threaded through
/// its ancestors. The script editor needs that: opening it may first have to
/// create the project's first draft, so the push happens after an `await`.
///
/// It also makes every screen addressable, which is what deep links and the
/// DEBUG screen-routing launch argument both rely on.
@MainActor
final class Router: ObservableObject {

    enum Tab: Hashable {
        case projects, today, settings
    }

    @Published var selectedTab: Tab = .projects
    @Published var projectsPath = NavigationPath()
    @Published var todayPath = NavigationPath()

    // MARK: - Pushing

    func push(_ route: ProjectRoute) {
        switch selectedTab {
        case .projects: projectsPath.append(route)
        case .today:    todayPath.append(route)
        case .settings: break
        }
    }

    /// Pushes any hashable value onto the active tab's path.
    ///
    /// Used by rows inside a `List`: wrapping them in a `NavigationLink` there
    /// forces SwiftUI's own disclosure chevron into the row, which collides with
    /// the chevron drawn inside the card.
    func push<V: Hashable>(value: V) {
        switch selectedTab {
        case .projects: projectsPath.append(value)
        case .today:    todayPath.append(value)
        case .settings: break
        }
    }

    func open(_ project: Project) {
        selectedTab = .projects
        projectsPath.append(project)
    }

    /// Re-selecting the active tab pops it to root, as it does everywhere in iOS.
    func popToRoot(_ tab: Tab) {
        switch tab {
        case .projects:
            guard !projectsPath.isEmpty else { return }
            projectsPath.removeLast(projectsPath.count)
            Haptics.tap()
        case .today:
            guard !todayPath.isEmpty else { return }
            todayPath.removeLast(todayPath.count)
            Haptics.tap()
        case .settings:
            break
        }
    }
}

/// Destinations reachable inside a project.
enum ProjectRoute: Hashable {
    case editor(scriptID: String, scriptTitle: String)
    case scenes
    case shots
    case schedule
    case characters
}
