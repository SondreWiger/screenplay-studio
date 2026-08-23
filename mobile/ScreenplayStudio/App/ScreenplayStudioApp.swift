import SwiftUI

@main
struct ScreenplayStudioApp: App {

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
                .task {
                    await auth.bootstrap()
                    Haptics.prepare()
                }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            // Coming back to the foreground is the natural moment to flush any
            // writes made while the phone was offline.
            Task { await SyncQueue.shared.drain() }
        }
    }
}
