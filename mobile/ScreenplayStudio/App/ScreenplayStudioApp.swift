import SwiftUI

@main
struct ScreenplayStudioApp: App {

    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    @StateObject private var auth = AuthStore()
    @StateObject private var network = NetworkMonitor.shared
    @StateObject private var settings = AppSettings.shared
    /// Navigation and the project list live at the app level, so they survive
    /// the shell being rebuilt (an accent change, an iPad window resizing).
    @StateObject private var router = Router()
    @StateObject private var library = ProjectsViewModel()
    @StateObject private var quickActions = QuickActions.shared

    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                // Colours are read when views render; a new accent rebuilds the
                // tree so everything picks it up. Navigation is kept in `router`.
                .id(settings.accent)
                .environmentObject(auth)
                .environmentObject(network)
                .environmentObject(settings)
                .environmentObject(router)
                .environmentObject(library)
                .environmentObject(quickActions)
                .tint(Theme.accent)
                .preferredColorScheme(settings.appearance.colorScheme)
                .onAppear { MacWindow.configure() }
                .task {
                    #if DEBUG
                    if DemoData.runsKeychainTest {
                        print("[SS] keychain self-test: \(KeychainStore.selfTest())")
                    }
                    #endif
                    MacWindow.configure()
                    await auth.bootstrap()
                    Haptics.prepare()
                }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                // Coming back to the foreground is the natural moment to flush
                // any writes made while the device was offline.
                Task { await SyncQueue.shared.drain() }
            case .background:
                let lastID = settings.lastProjectID
                quickActions.refreshShortcutItems(lastProject: library.projects.first { $0.id == lastID })
            default:
                break
            }
        }
        .commands {
            AppCommands(router: router)
        }
    }
}

/// Keyboard shortcuts for iPad with a hardware keyboard (hold ⌘ to see them).
struct AppCommands: Commands {
    let router: Router

    var body: some Commands {
        // Catalyst gives every app File > New Window and a Format menu;
        // neither means anything here.
        CommandGroup(replacing: .newItem) {
            Button("New Project") { router.requestNewProject() }
                .keyboardShortcut("n", modifiers: .command)
        }
        CommandGroup(replacing: .textFormatting) {}
        CommandGroup(replacing: .help) {
            Link("Screenplay Studio Help", destination: AppLinks.website)
            Link("Contact Support", destination: AppLinks.support)
        }
        CommandMenu("Go") {
            Button("Projects") { router.go(to: .projects) }
                .keyboardShortcut("1", modifiers: .command)
            Button("Today") { router.go(to: .today) }
                .keyboardShortcut("2", modifiers: .command)
            Button("Settings") { router.go(to: .settings) }
                .keyboardShortcut(",", modifiers: .command)
        }
    }
}
