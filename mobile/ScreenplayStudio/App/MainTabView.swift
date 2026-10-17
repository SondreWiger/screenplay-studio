import SwiftUI

/// The signed-in shell. Picks its layout from the width it's given:
///
/// * **Compact** (iPhone, narrow iPad windows): three tabs, because a thumb
///   reaches three targets comfortably and the work splits cleanly — what
///   you're writing, what's happening today, and everything else.
/// * **Regular** (iPad): a sidebar of places and projects beside the content,
///   the way Notes or Files work, so a project and its tools share the screen.
///
/// Every production tool lives under a project rather than in the top-level
/// navigation, which keeps both layouts stable as the tool list grows.
struct MainTabView: View {

    @Environment(\.horizontalSizeClass) private var sizeClass
    @EnvironmentObject private var router: Router
    @EnvironmentObject private var library: ProjectsViewModel
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var quickActions: QuickActions

    var body: some View {
        Group {
            if sizeClass == .regular {
                SplitShell()
            } else {
                TabShell()
            }
        }
        .onAppear { adoptLayout() }
        .onChange(of: sizeClass) { _, _ in adoptLayout() }
        .sheet(isPresented: $router.isPresentingNewProject) {
            NewProjectSheet { title, format, logline in
                guard let ownerID = auth.userID else { return nil }
                let created = await library.create(title: title, format: format, logline: logline, ownerID: ownerID)
                if let created { router.open(created) }
                return created
            }
        }
        .task {
            // Cached projects are enough to decide where to open; the network
            // refresh follows behind. A quick action that launched the app
            // waits for them too, so "Continue <project>" can find it.
            await library.primeFromCache()
            perform(quickActions.pending)
            applyLaunchDestination()
            await library.loadIfNeeded()
            library.startLiveUpdates()
        }
        // Quick actions while the app is already running.
        .onChange(of: quickActions.pending) { _, action in
            perform(action)
        }
    }

    private func adoptLayout() {
        router.adoptLayout(split: sizeClass == .regular) { id in
            library.projects.first { $0.id == id }
        }
    }

    /// Settings → General → Open to. Runs once per launch — not again when
    /// the shell is rebuilt — and never over a quick action.
    private func applyLaunchDestination() {
        guard !router.didHandleLaunch else { return }
        router.didHandleLaunch = true
        #if DEBUG
        if DemoData.isActive, DemoData.initialRoute != nil {
            DemoData.applyInitialRoute(to: router)
            return
        }
        #endif
        guard quickActions.pending == nil else { return }
        switch settings.launchDestination {
        case .projects:
            break
        case .today:
            router.go(to: .today)
        case .lastProject:
            if let project = library.projects.first(where: { $0.id == settings.lastProjectID }) {
                router.open(project)
            }
        }
    }

    private func perform(_ action: QuickActions.Action?) {
        guard let action else { return }
        quickActions.pending = nil
        router.didHandleLaunch = true
        switch action {
        case .newProject:
            router.requestNewProject()
        case .today:
            router.go(to: .today)
        case .openProject(let id):
            if let project = library.projects.first(where: { $0.id == id }) {
                router.open(project)
            } else {
                // Not in the cache yet: open it once the list has loaded.
                Task {
                    await library.loadIfNeeded()
                    if let project = library.projects.first(where: { $0.id == id }) {
                        router.open(project)
                    }
                }
            }
        }
    }
}

// MARK: - iPhone: tabs

private struct TabShell: View {

    @EnvironmentObject private var router: Router

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

            NavigationStack(path: $router.settingsPath) {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape")
            }
            .tag(Router.Tab.settings)
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

// MARK: - iPad: sidebar and detail

private struct SplitShell: View {

    @EnvironmentObject private var router: Router
    @EnvironmentObject private var library: ProjectsViewModel
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            StudioSidebar()
                .navigationSplitViewColumnWidth(min: 250, ideal: 290, max: 360)
        } detail: {
            NavigationStack(path: $router.detailPath) {
                detailRoot
            }
            // A different sidebar item is a different screen with its own
            // state — without this, switching projects would reuse the last
            // project's view model.
            .id(router.sidebarSelection)
        }
        .navigationSplitViewStyle(.balanced)
    }

    @ViewBuilder
    private var detailRoot: some View {
        switch router.sidebarSelection {
        case .today:
            TodayView()
        case .settings:
            SettingsView()
        case .project(let id):
            if let project = library.projects.first(where: { $0.id == id }) {
                ProjectHubView(project: project)
            } else if library.isLoading {
                ProgressView().tint(Theme.textTertiary)
            } else {
                ContentUnavailableView(
                    "Project not found",
                    systemImage: "film.stack",
                    description: Text("It may have been deleted, or you no longer have access to it.")
                )
            }
        case .projects, .none:
            ProjectsView()
        }
    }
}

private struct StudioSidebar: View {

    @EnvironmentObject private var router: Router
    @EnvironmentObject private var library: ProjectsViewModel
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var auth: AuthStore

    private var pinned: [Project] {
        let ids = settings.pinnedProjectIDs
        return ids.compactMap { id in library.projects.first { $0.id == id } }
    }

    /// Recent projects not already pinned. The library is ordered by last
    /// update, which is the order people come back to them in.
    private var recent: [Project] {
        let pinnedIDs = Set(settings.pinnedProjectIDs)
        return Array(library.projects.filter { !pinnedIDs.contains($0.id) && $0.resolvedStatus != .archived }.prefix(8))
    }

    var body: some View {
        List(selection: $router.sidebarSelection) {
            Section {
                Label("Projects", systemImage: "film.stack")
                    .tag(Router.SidebarItem.projects)
                Label("Today", systemImage: "calendar.day.timeline.left")
                    .tag(Router.SidebarItem.today)
            }

            if !pinned.isEmpty {
                Section("Pinned") {
                    ForEach(pinned) { project in
                        SidebarProjectRow(project: project)
                    }
                }
            }

            if !recent.isEmpty {
                Section("Recent") {
                    ForEach(recent) { project in
                        SidebarProjectRow(project: project)
                    }
                }
            }

            Section {
                Label("Settings", systemImage: "gearshape")
                    .tag(Router.SidebarItem.settings)
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("Studio")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Haptics.tap()
                    router.requestNewProject()
                } label: {
                    Image(systemName: "square.and.pencil")
                }
                .accessibilityLabel("New project")
                .help("New Project (⌘N)")
            }
        }
        .refreshable { await library.refresh() }
        .safeAreaInset(edge: .bottom) {
            if let profile = auth.profile {
                HStack(spacing: 10) {
                    Text(profile.initials)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 30, height: 30)
                        .background(Theme.accent, in: Circle())
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(profile.bestName)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.textPrimary)
                            .lineLimit(1)
                        if let email = profile.email {
                            Text(email)
                                .font(.caption2)
                                .foregroundStyle(Theme.textTertiary)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.bar)
                .accessibilityElement(children: .combine)
            }
        }
    }
}

private struct SidebarProjectRow: View {
    let project: Project

    @EnvironmentObject private var settings: AppSettings

    var body: some View {
        Label {
            Text(project.title)
                .lineLimit(1)
        } icon: {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(Color(hex: Project.accentPalette[project.accentSeed]))
                .frame(width: 18, height: 18)
                .overlay(
                    Text(String(project.title.prefix(1)).uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                )
                .accessibilityHidden(true)
        }
        .tag(Router.SidebarItem.project(project.id))
        .contextMenu {
            Button {
                settings.togglePin(project.id)
                Haptics.tap()
            } label: {
                if settings.isPinned(project.id) {
                    Label("Unpin", systemImage: "pin.slash")
                } else {
                    Label("Pin to Sidebar", systemImage: "pin")
                }
            }
        }
    }
}
