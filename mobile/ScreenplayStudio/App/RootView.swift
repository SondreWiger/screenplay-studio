import SwiftUI

/// Chooses between the connection screen, the sign-in screen and the app itself.
struct RootView: View {

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var network: NetworkMonitor

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            switch auth.phase {
            case .loading:
                LaunchPlaceholder()
                    .transition(.opacity)

            case .needsConfiguration:
                ConnectProjectView()
                    .transition(.opacity)

            case .signedOut:
                SignInView()
                    .transition(.opacity)

            case .signedIn:
                MainTabView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: auth.phase)
        .overlay(alignment: .top) {
            OfflineBanner()
        }
        // Drain the offline queue the moment connectivity comes back.
        .onChange(of: network.isOnline) { _, isOnline in
            guard isOnline else { return }
            Task { await SyncQueue.shared.drain() }
        }
    }
}

/// Shown for the fraction of a second it takes to read the stored session.
/// Matches the launch screen so there's no flash of a different background.
private struct LaunchPlaceholder: View {
    var body: some View {
        VStack(spacing: 20) {
            AppMark(size: 72)
            ProgressView()
                .tint(Theme.textTertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }
}

/// A slim bar that drops in when the phone loses signal.
private struct OfflineBanner: View {

    @EnvironmentObject private var network: NetworkMonitor
    @State private var pendingCount = 0

    var body: some View {
        Group {
            if !network.isOnline {
                HStack(spacing: 8) {
                    Image(systemName: "wifi.slash")
                        .font(.footnote.weight(.semibold))
                    Text(pendingCount > 0
                         ? "Offline · \(pendingCount) change\(pendingCount == 1 ? "" : "s") waiting"
                         : "Offline · edits are saved on this phone")
                        .font(.footnote.weight(.medium))
                }
                .foregroundStyle(Theme.Surface.s950)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Theme.warning, in: Capsule())
                .padding(.top, 4)
                .transition(.move(edge: .top).combined(with: .opacity))
                .task(id: network.isOnline) {
                    pendingCount = await SyncQueue.shared.count
                }
                .accessibilityAddTraits(.isStaticText)
            }
        }
        .animation(.spring(duration: 0.35), value: network.isOnline)
    }
}
