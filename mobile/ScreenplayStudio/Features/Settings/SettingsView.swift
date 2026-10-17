import SwiftUI

struct SettingsView: View {

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var network: NetworkMonitor

    @State private var pendingCount = 0
    @State private var cacheClearedAt: Date?
    @State private var isConfirmingSignOut = false
    @State private var isConfirmingDeletion = false
    @State private var isSyncing = false

    var body: some View {
        List {
            accountSection
            writingSection
            dataSection
            aboutSection
            signOutSection
            deleteAccountSection
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        // A settings column the width of the screen is hard to scan on an iPad.
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
        .background(Theme.background)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .task {
            pendingCount = await SyncQueue.shared.count
            await auth.loadProfile()
        }
        .confirmationDialog(
            "Sign out of Screenplay Studio?",
            isPresented: $isConfirmingSignOut,
            titleVisibility: .visible
        ) {
            Button("Sign out", role: .destructive) {
                Task { await auth.signOut() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(pendingCount > 0
                 ? "\(pendingCount) unsynced change\(pendingCount == 1 ? "" : "s") will be lost."
                 : "Cached projects on this device will be cleared.")
        }
        .alert("Delete your account?", isPresented: $isConfirmingDeletion) {
            Button("Delete account", role: .destructive) {
                Task { await auth.deleteAccount() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes your account, every project you created and everything in them, on every device and on the web. It can't be undone.")
        }
        .alert(
            "Couldn't delete your account",
            isPresented: Binding(
                get: { auth.errorMessage != nil && !isConfirmingDeletion },
                set: { if !$0 { auth.errorMessage = nil } }
            ),
            actions: { Button("OK", role: .cancel) { auth.errorMessage = nil } },
            message: { Text(auth.errorMessage ?? "") }
        )
    }

    // MARK: - Account

    private var accountSection: some View {
        Section {
            HStack(spacing: 12) {
                Text(auth.profile?.initials ?? "?")
                    .font(.headline)
                    .foregroundStyle(.white)
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

    // MARK: - Writing

    private var writingSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Script text size")
                        .font(.body)
                        .foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Text("\(Int(settings.clampedEditorScale * 100))%")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.textTertiary)
                        .monospacedDigit()
                }

                Slider(
                    value: Binding(
                        get: { settings.clampedEditorScale },
                        set: { settings.editorScale = $0 }
                    ),
                    in: 0.75...1.6,
                    step: 0.05
                ) {
                    Text("Script text size")
                } minimumValueLabel: {
                    Image(systemName: "textformat.size.smaller")
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                } maximumValueLabel: {
                    Image(systemName: "textformat.size.larger")
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                }
                .tint(Theme.accent)

                Text("Sits on top of the system text size, so the page can be smaller than the rest of the app when you want more words on screen.")
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 4)
            .listRowBackground(Theme.card)

            settingsToggle(
                "Element bar above keyboard",
                detail: "The scene / action / character switcher. Turn it off if you prefer more page.",
                isOn: $settings.showElementBar
            )

            settingsToggle(
                "Haptics",
                detail: "Feedback when you switch element type, tick a shot, or save.",
                isOn: $settings.hapticsEnabled
            )
        } header: {
            sectionHeader("Writing")
        }
    }

    // MARK: - Data

    private var dataSection: some View {
        Section {
            settingsToggle(
                "Data saver",
                detail: "Waits longer before autosaving and skips image prefetching. Also switches on automatically on Low Data Mode.",
                isOn: $settings.dataSaver
            )

            HStack(spacing: 10) {
                Image(systemName: network.isOnline ? "wifi" : "wifi.slash")
                    .font(.body)
                    .foregroundStyle(network.isOnline ? Theme.success : Theme.warning)
                    .frame(width: 24)
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
                            Text("Sync")
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

            NavigationLink {
                DiagnosticsView()
            } label: {
                HStack {
                    Text("Diagnostics")
                        .font(.body)
                        .foregroundStyle(Theme.textPrimary)
                    Spacer()
                    if pendingCount > 0 {
                        Text("\(pendingCount)")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.warning)
                    }
                }
                .frame(minHeight: Theme.minTouchTarget - 10)
            }
            .listRowBackground(Theme.card)

            Button {
                clearCache()
            } label: {
                HStack {
                    Text("Clear offline cache")
                        .font(.body)
                        .foregroundStyle(Theme.textPrimary)
                    Spacer()
                    if cacheClearedAt != nil {
                        Image(systemName: "checkmark")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.success)
                    }
                }
                .frame(minHeight: Theme.minTouchTarget - 10)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .listRowBackground(Theme.card)
            .disabled(pendingCount > 0)
        } header: {
            sectionHeader("Data & sync")
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
                Text("Version")
                    .font(.body)
                    .foregroundStyle(Theme.textPrimary)
            }
            .frame(minHeight: Theme.minTouchTarget - 10)
            .listRowBackground(Theme.card)

            externalLink("Open on the web", destination: AppLinks.website)
            externalLink("Privacy policy", destination: AppLinks.privacy)
            externalLink("Terms of use", destination: AppLinks.terms)
            externalLink("Contact support", destination: AppLinks.support, symbol: "envelope")

            Text("Budget, call sheets, storyboards, rundowns and the broadcast suite are on the web app.")
                .font(.caption)
                .foregroundStyle(Theme.textTertiary)
                .fixedSize(horizontal: false, vertical: true)
                .listRowBackground(Theme.card)
        } header: {
            sectionHeader("About")
        }
    }

    private var signOutSection: some View {
        Section {
            Button(role: .destructive) {
                Haptics.warning()
                isConfirmingSignOut = true
            } label: {
                Text("Sign out")
                    .font(.body.weight(.medium))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(minHeight: Theme.minTouchTarget - 10)
                    .contentShape(Rectangle())
            }
            .listRowBackground(Theme.card)
        }
    }

    private var deleteAccountSection: some View {
        Section {
            Button(role: .destructive) {
                Haptics.warning()
                isConfirmingDeletion = true
            } label: {
                HStack {
                    Text("Delete account")
                        .font(.body.weight(.medium))
                    Spacer()
                    if auth.isWorking {
                        ProgressView().tint(Theme.danger)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(minHeight: Theme.minTouchTarget - 10)
                .contentShape(Rectangle())
            }
            .disabled(auth.isWorking)
            .listRowBackground(Theme.card)
        } footer: {
            Text("Permanently removes your account and the projects you own. Projects other people shared with you stay with them.")
                .font(.caption)
                .foregroundStyle(Theme.textTertiary)
        }
    }

    // MARK: - Helpers

    private func externalLink(_ title: String, destination: URL, symbol: String = "arrow.up.right.square") -> some View {
        Link(destination: destination) {
            HStack {
                Text(title)
                    .font(.body)
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Image(systemName: symbol)
                    .font(.footnote)
                    .foregroundStyle(Theme.textTertiary)
            }
            .frame(minHeight: Theme.minTouchTarget - 10)
            .contentShape(Rectangle())
        }
        .listRowBackground(Theme.card)
    }

    private static var versionString: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.textTertiary)
            .textCase(.uppercase)
            .tracking(0.5)
    }

    private func settingsToggle(_ title: String, detail: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body)
                    .foregroundStyle(Theme.textPrimary)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .tint(Theme.accent)
        .padding(.vertical, 2)
        .listRowBackground(Theme.card)
        .onChange(of: isOn.wrappedValue) { _ in Haptics.selectionChanged() }
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
