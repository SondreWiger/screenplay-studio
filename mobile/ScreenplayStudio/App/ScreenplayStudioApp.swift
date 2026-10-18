import SwiftUI

@main
struct ScreenplayStudioApp: App {

    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var auth = AuthStore()
    @StateObject private var network = NetworkMonitor.shared
    @StateObject private var settings = AppSettings.shared

    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(network)
                .environmentObject(settings)
                .tint(Theme.accent)
                .preferredColorScheme(.dark)
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
        .commands {
            // Catalyst gives every app File > New Window and a Format menu;
            // neither means anything here.
            CommandGroup(replacing: .newItem) {}
            CommandGroup(replacing: .textFormatting) {}
            CommandGroup(replacing: .help) {
                Link("Screenplay Studio Help", destination: AppLinks.website)
                Link("Contact Support", destination: AppLinks.support)
            }
        }
        .onChange(of: scenePhase) { phase in
            guard phase == .active else { return }
            // Coming back to the foreground is the natural moment to flush any
            // writes made while the phone was offline.
            Task { await SyncQueue.shared.drain() }
        }
    }
}
