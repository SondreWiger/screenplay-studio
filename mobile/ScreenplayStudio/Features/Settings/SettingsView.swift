import SwiftUI

struct SettingsView: View {

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var network: NetworkMonitor

    @State private var pendingCount = 0
    @State private var cacheClearedAt: Date?
    @State private var isConfirmingSignOut = false
    @State private var isConfirmingDelete = false
    @State private var deleteError: String?
    @State private var isSyncing = false

    var body: some View {
        List {
            accountSection
            personaliseSection
            generalSection
            dataSection
            aboutSection
            accountActionsSection
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .navigationDestination(for: SettingsRoute.self) { route in
            switch route {
            case .appearance:   AppearanceSettingsView()
            case .writing:      WritingSettingsView()
            case .projectTools: HubToolsEditor()
            case .diagnostics:  DiagnosticsView()
            }
        }
        .task {
            pendingCount = await SyncQueue.shared.count
            await auth.loadProfile()
        }
        .confirmationDialog(
            "Sign out of Screenplay Studio?",
            isPresented: $isConfirmingSignOut,
            titleVisibility: .visible
        ) {
            Button("Sign Out", role: .destructive) {
                Task { await auth.signOut() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(pendingCount > 0
                 ? "\(pendingCount) unsynced change\(pendingCount == 1 ? "" : "s") will be lost."
                 : "Projects cached on this device will be cleared. Everything stays in your account.")
        }
        .alert("Delete your account?", isPresented: $isConfirmingDelete) {
            Button("Delete Account", role: .destructive) {
                Task { deleteError = await auth.deleteAccount() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your account, your projects and everything in them are permanently deleted, on every device. This can’t be undone.")
        }
        .alert(
            "Couldn’t delete account",
            isPresented: Binding(get: { deleteError != nil }, set: { if !$0 { deleteError = nil } }),
            actions: { Button("OK", role: .cancel) { deleteError = nil } },
            message: { Text(deleteError ?? "") }
        )
    }

    // MARK: - Account

    private var accountSection: some View {
        Section {
            HStack(spacing: 12) {
                Text(auth.profile?.initials ?? "?")
                    .font(.headline)
                    .foregroundStyle(Theme.accent.readableForeground)
                    .frame(width: 48, height: 48)
                    .background(Theme.accent, in: Circle())
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 2) {
                    Text(auth.profile?.bestName ?? auth.user?.fullName ?? "Signed in")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                    if let email = auth.profile?.email ?? auth.user?.email {
                        Text(email)
                            .font(.caption)
                            .foregroundStyle(Theme.textTertiary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 4)
            .listRowBackground(Theme.card)
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: - Make it yours

    private var personaliseSection: some View {
        Section {
            NavigationLink(value: SettingsRoute.appearance) {
                SettingsRow(symbol: "paintpalette", tint: Theme.accent, title: "Appearance") {
                    Text("\(settings.appearance.label) · \(settings.accent.label)")
                }
            }
            .listRowBackground(Theme.card)

            NavigationLink(value: SettingsRoute.writing) {
                SettingsRow(symbol: "pencil.line", tint: Color(hex: 0x8B5CF6), title: "Writing") {
                    Text("\(Int(settings.clampedEditorScale * 100))%")
                }
            }
            .listRowBackground(Theme.card)

            NavigationLink(value: SettingsRoute.projectTools) {
                SettingsRow(symbol: "square.grid.2x2", tint: Color(hex: 0x14B8A6), title: "Project Tools") {
                    Text("\(settings.visibleHubTools.count) shown")
                }
            }
            .listRowBackground(Theme.card)
        } header: {
            SettingsSectionHeader("Make it yours")
        }
    }

    // MARK: - General

    private var generalSection: some View {
        Section {
            Picker(selection: $settings.launchDestination) {
                ForEach(LaunchDestination.allCases) { destination in
                    Text(destination.label).tag(destination)
                }
            } label: {
                SettingsRow(symbol: "arrow.up.forward.app", tint: Color(hex: 0x3B82F6), title: "Open to")
            }
            .listRowBackground(Theme.card)

            Toggle(isOn: $settings.hapticsEnabled) {
                SettingsRow(symbol: "hand.tap", tint: Color(hex: 0xEC4899), title: "Haptics")
            }
            .tint(Theme.accent)
            .listRowBackground(Theme.card)

            Toggle(isOn: $settings.slateSoundEnabled) {
                SettingsRow(symbol: "speaker.wave.2", tint: Color(hex: 0xF59E0B), title: "Slate clap sound")
            }
            .tint(Theme.accent)
            .listRowBackground(Theme.card)
        } header: {
            SettingsSectionHeader("General")
        } footer: {
            Text("“Last project” reopens whatever you had open, so you land back on the page you were writing.")
                .font(.caption)
                .foregroundStyle(Theme.textTertiary)
        }
    }

    // MARK: - Data

    private var dataSection: some View {
        Section {
            Toggle(isOn: $settings.dataSaver) {
                VStack(alignment: .leading, spacing: 2) {
                    SettingsRow(symbol: "antenna.radiowaves.left.and.right", tint: Color(hex: 0x22C55E), title: "Data saver")
                    Text("Waits longer before autosaving on cellular. Turns on by itself in Low Data Mode.")
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.leading, 40)
                }
            }
            .tint(Theme.accent)
            .listRowBackground(Theme.card)

            HStack(spacing: 10) {
                Image(systemName: network.isOnline ? "checkmark.icloud" : "icloud.slash")
                    .font(.body)
                    .foregroundStyle(network.isOnline ? Theme.success : Theme.warning)
                    .frame(width: 28)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 2) {
                    Text(network.isOnline ? "Online" : "Offline")
                        .font(.body)
                        .foregroundStyle(Theme.textPrimary)
                    Text(statusDetail)
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                }

                Spacer(minLength: 0)

                if pendingCount > 0 && network.isOnline {
                    Button {
                        syncNow()
                    } label: {
                        if isSyncing {
                            ProgressView().tint(Theme.accent)
                        } else {
                            Text("Sync Now")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.accent)
                        }
                    }
                    .buttonStyle(.plain)
                    .frame(minHeight: Theme.minTouchTarget)
                }
            }
            .padding(.vertical, 2)
            .listRowBackground(Theme.card)
            .accessibilityElement(children: .combine)

            NavigationLink(value: SettingsRoute.diagnostics) {
                SettingsRow(symbol: "stethoscope", tint: Theme.textTertiary, title: "Diagnostics") {
                    if pendingCount > 0 {
                        Text("\(pendingCount) waiting")
                            .foregroundStyle(Theme.warning)
                    }
                }
            }
            .listRowBackground(Theme.card)

            Button {
                clearCache()
            } label: {
                HStack {
                    SettingsRow(symbol: "trash", tint: Theme.textTertiary, title: "Clear offline cache")
                    if cacheClearedAt != nil {
                        Image(systemName: "checkmark")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.success)
                    }
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .listRowBackground(Theme.card)
            .disabled(pendingCount > 0)
        } header: {
            SettingsSectionHeader("Data & sync")
        } footer: {
            if pendingCount > 0 {
                Text("The cache can't be cleared while changes are waiting to sync.")
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
            }
        }
    }

    private var statusDetail: String {
        if pendingCount > 0 {
            return "\(pendingCount) change\(pendingCount == 1 ? "" : "s") waiting to sync"
        }
        if network.shouldConserveData {
            return "On a metered or constrained connection"
        }
        return network.isOnline ? "Everything is synced" : "Edits are saved on this device"
    }

    // MARK: - About

    private var aboutSection: some View {
        Section {
            LabeledContent {
                Text(Self.versionString)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textTertiary)
                    .monospacedDigit()
            } label: {
                SettingsRow(symbol: "info.circle", tint: Theme.textTertiary, title: "Version")
            }
            .listRowBackground(Theme.card)

            externalLink("Open on the web", symbol: "safari", path: "")
            externalLink("Help & tutorials", symbol: "questionmark.circle", path: "learn")
            externalLink("Send feedback", symbol: "bubble.left.and.text.bubble.right", path: "feedback")
            externalLink("Privacy policy", symbol: "hand.raised", path: "legal/privacy")
            externalLink("Terms of service", symbol: "doc.plaintext", path: "legal/terms")
        } header: {
            SettingsSectionHeader("About")
        } footer: {
            Text("Budget, call sheets, storyboards, rundowns and the broadcast suite are on the web and desktop apps, with the same account.")
                .font(.caption)
                .foregroundStyle(Theme.textTertiary)
        }
    }

    private func externalLink(_ title: String, symbol: String, path: String) -> some View {
        Link(destination: AuthStore.webBaseURL.appendingPathComponent(path)) {
            HStack {
                SettingsRow(symbol: symbol, tint: Theme.textTertiary, title: title)
                Image(systemName: "arrow.up.right")
                    .font(.footnote)
                    .foregroundStyle(Theme.textTertiary)
            }
            .contentShape(.rect)
        }
        .listRowBackground(Theme.card)
    }

    private var accountActionsSection: some View {
        Section {
            Button(role: .destructive) {
                Haptics.warning()
                isConfirmingSignOut = true
            } label: {
                Text("Sign Out")
                    .font(.body.weight(.medium))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(minHeight: Theme.minTouchTarget - 10)
                    .contentShape(.rect)
            }
            .listRowBackground(Theme.card)

            Button(role: .destructive) {
                Haptics.warning()
                isConfirmingDelete = true
            } label: {
                HStack {
                    Text("Delete Account…")
                        .font(.body)
                    Spacer()
                    if auth.isWorking { ProgressView() }
                }
                .frame(minHeight: Theme.minTouchTarget - 10)
                .contentShape(.rect)
            }
            .disabled(auth.isWorking || !network.isOnline)
            .listRowBackground(Theme.card)
        }
    }

    // MARK: - Helpers

    private static var versionString: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }

    private func syncNow() {
        isSyncing = true
        Task {
            await SyncQueue.shared.drain()
            pendingCount = await SyncQueue.shared.count
            isSyncing = false
            Haptics.success()
        }
    }

    private func clearCache() {
        Task {
            await LocalCache.shared.clearAll()
            cacheClearedAt = Date()
            Haptics.success()
        }
    }
}

// MARK: - Shared pieces

/// An iOS Settings-style row: a tinted icon tile, a title, and an optional
/// trailing value.
struct SettingsRow<Value: View>: View {
    let symbol: String
    let tint: Color
    let title: String
    @ViewBuilder var value: Value

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(tint, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                .accessibilityHidden(true)
            Text(title)
                .font(.body)
                .foregroundStyle(Theme.textPrimary)
            Spacer(minLength: 8)
            value
                .font(.subheadline)
                .foregroundStyle(Theme.textTertiary)
        }
        .frame(minHeight: Theme.minTouchTarget - 8)
    }
}

extension SettingsRow where Value == EmptyView {
    init(symbol: String, tint: Color, title: String) {
        self.init(symbol: symbol, tint: tint, title: title) { EmptyView() }
    }
}

struct SettingsSectionHeader: View {
    let title: String
    init(_ title: String) { self.title = title }

    var body: some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.textTertiary)
            .textCase(.uppercase)
            .tracking(0.5)
    }
}
