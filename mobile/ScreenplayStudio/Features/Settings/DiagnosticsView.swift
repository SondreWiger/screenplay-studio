import SwiftUI

/// Shows what the app's network layer is actually doing.
///
/// "I signed in and nothing appeared" has several possible causes that look
/// identical from the outside: zero rows returned, rejected by row-level
/// security, a decode that failed, or a request that never went out. This
/// separates them.
struct DiagnosticsView: View {

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var network: NetworkMonitor

    @State private var entries: [Diagnostics.Entry] = []
    @State private var pendingWrites = 0
    @State private var projectURL = "—"
    @State private var isSignedIn = false
    @State private var userID = "—"
    @State private var tokenState = "—"
    @State private var isRunningCheck = false
    @State private var checkResult: String?

    var body: some View {
        List {
            Section {
                row("Project", projectURL)
                row("Signed in", isSignedIn ? "yes" : "no")
                row("User id", userID)
                row("Access token", tokenState)
                row("Network", network.isOnline ? (network.shouldConserveData ? "online (metered)" : "online") : "offline")
                row("Queued writes", "\(pendingWrites)")
            } header: {
                header("Connection")
            }

            Section {
                Button {
                    runCheck()
                } label: {
                    HStack {
                        Text("Run a live fetch")
                            .foregroundStyle(Theme.textPrimary)
                        Spacer()
                        if isRunningCheck { ProgressView().tint(Theme.accent) }
                    }
                    .frame(minHeight: Theme.minTouchTarget - 10)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .disabled(isRunningCheck)
                .listRowBackground(Theme.card)

                if let checkResult {
                    Text(checkResult)
                        .font(.footnote.monospaced())
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .listRowBackground(Theme.card)
                }
            } header: {
                header("Check")
            } footer: {
                Text("Fetches one row from each table with your current session and reports exactly what came back.")
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
            }

            Section {
                if entries.isEmpty {
                    Text("Nothing recorded yet.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textTertiary)
                        .listRowBackground(Theme.card)
                } else {
                    ForEach(entries) { entry in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Image(systemName: entry.isFailure ? "xmark.circle.fill" : "checkmark.circle")
                                    .font(.caption)
                                    .foregroundStyle(entry.isFailure ? Theme.danger : Theme.success)
                                Text(entry.label)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.textPrimary)
                                Spacer(minLength: 0)
                                Text(Self.time(entry.at))
                                    .font(.caption2)
                                    .foregroundStyle(Theme.textTertiary)
                                    .monospacedDigit()
                            }
                            Text(entry.detail)
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.vertical, 2)
                        .listRowBackground(Theme.card)
                        .accessibilityElement(children: .combine)
                    }
                }
            } header: {
                HStack {
                    header("Recent activity")
                    Spacer()
                    Button("Clear") {
                        Task { await Diagnostics.shared.clear(); entries = [] }
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.accent)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Diagnostics")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .refreshable { await load() }
        .task { await load() }
    }

    private func header(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.textTertiary)
            .textCase(.uppercase)
            .tracking(0.5)
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
            Spacer(minLength: 12)
            Text(value)
                .font(.subheadline.monospaced())
                .foregroundStyle(Theme.textPrimary)
                .multilineTextAlignment(.trailing)
                .textSelection(.enabled)
        }
        .frame(minHeight: Theme.minTouchTarget - 14)
        .listRowBackground(Theme.card)
        .accessibilityElement(children: .combine)
    }

    private static func time(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: date)
    }

    private func load() async {
        entries = await Diagnostics.shared.snapshot()
        pendingWrites = await SyncQueue.shared.count
        isSignedIn = await Supabase.shared.isSignedIn
        userID = await Supabase.shared.currentUserID ?? "—"
        projectURL = await Supabase.shared.realtimeConfig()?.url.host ?? "not configured"

        if let session = await Supabase.shared.currentSession {
            tokenState = session.isExpired ? "expired (will refresh)" : "valid"
        } else {
            tokenState = "none"
        }
    }

    /// Hits every table the app reads and reports the outcome per table.
    private func runCheck() {
        isRunningCheck = true
        checkResult = nil

        Task {
            var lines: [String] = []

            func probe(_ label: String, _ table: String) async {
                do {
                    let rows: [JSONValue] = try await Supabase.shared.execute(
                        PostgrestQuery(table).select().limit(1)
                    )
                    lines.append("\(label): ok, \(rows.count) row(s)")
                } catch {
                    let message = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
                    lines.append("\(label): FAILED — \(message)")
                }
            }

            await probe("projects", "projects")
            await probe("scripts", "scripts")
            await probe("scenes", "scenes")
            await probe("shots", "shots")
            await probe("characters", "characters")
            await probe("schedule", "production_schedule")

            checkResult = lines.joined(separator: "\n")
            await load()
            isRunningCheck = false
            Haptics.success()
        }
    }
}
