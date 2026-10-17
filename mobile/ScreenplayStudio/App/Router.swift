import SwiftUI

/// Owns the navigation state for the whole app, on iPhone and iPad.
///
/// Holding the paths in one observable object (rather than as `@State` inside
/// the shell) means any screen can push without a binding threaded through its
/// ancestors. The script editor needs that: opening it may first have to create
/// the project's first draft, so the push happens after an `await`.
///
/// It also makes every screen addressable — the Go menu, home-screen quick
/// actions, launch-to-last-project and the DEBUG screen routing all rely on it —
/// and, because the app owns it rather than a view, navigation survives the
/// shell being rebuilt (switching accent colour, or an iPad window resizing
/// between the sidebar and tab layouts).
@MainActor
final class Router: ObservableObject {

    // MARK: - Compact (iPhone): tabs

    enum Tab: Hashable {
        case projects, today, settings
    }

    @Published var selectedTab: Tab = .projects
    @Published var projectsPath = NavigationPath()
    @Published var todayPath = NavigationPath()
    @Published var settingsPath = NavigationPath()

    // MARK: - Regular (iPad): sidebar and detail

    /// A sidebar destination. Projects are referenced by id so the selection
    /// survives the project's row being refreshed with new data.
    enum SidebarItem: Hashable {
        case today, projects, project(String), settings
    }

    /// Set by the shell: true while the sidebar layout is showing.
    @Published private(set) var isSplit = false

    @Published var sidebarSelection: SidebarItem? = .projects {
        didSet {
            // A new destination starts at its root.
            if sidebarSelection != oldValue { detailPath = NavigationPath() }
        }
    }
    @Published var detailPath = NavigationPath()

    // MARK: - App-wide requests

    /// Raised by ⌘N, the File menu and the home-screen quick action.
    @Published var isPresentingNewProject = false

    /// Whether the launch destination (or a quick action) has been applied.
    /// Kept here rather than in a view so a rebuilt shell doesn't apply it twice.
    var didHandleLaunch = false

    // MARK: - Layout changes

    /// Called by the shell when the size class changes, carrying the open
    /// project across so resizing an iPad window doesn't lose your place.
    func adoptLayout(split: Bool, projectLookup: (String) -> Project?) {
        guard split != isSplit else { return }
        let lastProjectID = AppSettings.shared.lastProjectID

        if split {
            // Tabs → sidebar.
            if selectedTab == .projects, !projectsPath.isEmpty, !lastProjectID.isEmpty {
                sidebarSelection = .project(lastProjectID)
            } else {
                sidebarSelection = sidebarItem(for: selectedTab)
            }
        } else {
            // Sidebar → tabs.
            switch sidebarSelection {
            case .project(let id):
                selectedTab = .projects
                projectsPath = NavigationPath()
                if let project = projectLookup(id) { projectsPath.append(project) }
            case .today:
                selectedTab = .today
            case .settings:
                selectedTab = .settings
            default:
                selectedTab = .projects
            }
        }
        isSplit = split
    }

    private func sidebarItem(for tab: Tab) -> SidebarItem {
        switch tab {
        case .projects: return .projects
        case .today:    return .today
        case .settings: return .settings
        }
    }

    // MARK: - Pushing

    func push(_ route: ProjectRoute) {
        push(value: route)
    }

    /// Pushes any hashable value onto the active stack.
    ///
    /// Used by rows inside a `List`: wrapping them in a `NavigationLink` there
    /// forces SwiftUI's own disclosure chevron into the row, which collides with
    /// the chevron drawn inside the card.
    func push<V: Hashable>(value: V) {
        if isSplit {
            detailPath.append(value)
            return
        }
        switch selectedTab {
        case .projects: projectsPath.append(value)
        case .today:    todayPath.append(value)
        case .settings: settingsPath.append(value)
        }
    }

    /// Show a project from wherever the user is: selected in the sidebar on
    /// iPad, pushed onto the current tab on iPhone.
    func show(_ project: Project) {
        if isSplit {
            sidebarSelection = .project(project.id)
        } else {
            push(value: project)
        }
    }

    /// Open a project from outside the app's normal flow (launch, a quick
    /// action): always lands on the Projects tab with nothing above it.
    func open(_ project: Project) {
        if isSplit {
            sidebarSelection = .project(project.id)
            return
        }
        selectedTab = .projects
        projectsPath = NavigationPath()
        projectsPath.append(project)
    }

    func go(to tab: Tab) {
        if isSplit {
            sidebarSelection = sidebarItem(for: tab)
        } else if selectedTab == tab {
            popToRoot(tab)
        } else {
            selectedTab = tab
        }
    }

    /// Re-selecting the active tab pops it to root, as it does everywhere in iOS.
    func popToRoot(_ tab: Tab) {
        switch tab {
        case .projects:
            guard !projectsPath.isEmpty else { return }
            projectsPath.removeLast(projectsPath.count)
        case .today:
            guard !todayPath.isEmpty else { return }
            todayPath.removeLast(todayPath.count)
        case .settings:
            guard !settingsPath.isEmpty else { return }
            settingsPath.removeLast(settingsPath.count)
        }
        Haptics.tap()
    }

    func requestNewProject() {
        if !isSplit { selectedTab = .projects }
        isPresentingNewProject = true
    }
}

/// Destinations reachable inside a project.
enum ProjectRoute: Hashable {
    case editor(scriptID: String, scriptTitle: String)
    case scenes
    case shots
    case schedule
    case characters
    case slate
    /// The slate, starting on a shot from the shot list.
    case slateShot(id: String)
    /// The slate, starting on a scene.
    case slateScene(id: String)
    case documents
    case gear
}

/// Destinations inside Settings.
enum SettingsRoute: Hashable {
    case appearance
    case writing
    case projectTools
    case diagnostics
}
