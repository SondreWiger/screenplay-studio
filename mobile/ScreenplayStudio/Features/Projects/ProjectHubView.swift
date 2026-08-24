import SwiftUI

/// The project's home screen — a summary plus the way into every tool.
struct ProjectHubView: View {

    let project: Project

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: Router
    @StateObject private var model: ProjectHubViewModel

    @State private var isOpeningEditor = false
    @State private var isShowingDrafts = false

    init(project: Project) {
        self.project = project
        _model = StateObject(wrappedValue: ProjectHubViewModel(projectID: project.id))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                summaryCard

                if let next = model.nextEvent {
                    NextUpCard(event: next)
                }

                progressCard

                toolsSection
            }
            .screenPadding()
            .padding(.top, 4)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .refreshable { await model.refresh() }
        .navigationTitle(project.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .task {
            AppSettings.shared.lastProjectID = project.id
            await model.loadIfNeeded()
        }
        .navigationDestination(for: ProjectRoute.self) { route in
            destination(for: route)
        }
        .sheet(isPresented: $isShowingDrafts) {
            DraftsSheet(
                scripts: model.scripts,
                currentScriptID: model.activeScript?.id,
                onSelect: { script in
                    model.remember(script)
                    router.push(.editor(scriptID: script.id, scriptTitle: script.title))
                },
                onCreate: { createDraft() }
            )
        }
    }

    // MARK: - Summary

    private var summaryCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 10) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(project.title)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(Theme.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: 6) {
                            Chip(
                                text: project.resolvedStatus.label,
                                symbol: project.resolvedStatus.symbol,
                                tint: project.resolvedStatus.tint
                            )
                            Chip(text: project.resolvedFormat.label, tint: Theme.textTertiary)
                        }
                    }
                    Spacer(minLength: 0)
                }

                if let logline = project.logline?.nonEmpty {
                    Text(logline)
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Divider().overlay(Theme.border)

                HStack(spacing: 0) {
                    StatCell(value: "\(model.sceneCount)", label: "Scenes")
                    StatCell(value: "\(model.shotCount)", label: "Shots")
                    StatCell(value: "\(model.characterCount)", label: "Characters")
                    if let pages = model.pagesLabel {
                        StatCell(value: pages.replacingOccurrences(of: " pages", with: ""), label: "Pages")
                    }
                }
            }
        }
    }

    // MARK: - Progress

    @ViewBuilder
    private var progressCard: some View {
        if model.sceneCount > 0 || model.shotCount > 0 {
            Card {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Progress")
                        .font(.headline)
                        .foregroundStyle(Theme.textPrimary)

                    if model.sceneCount > 0 {
                        ProgressRow(
                            title: "Scenes shot",
                            detail: "\(model.completedScenes) of \(model.sceneCount)",
                            fraction: model.sceneProgress,
                            tint: Theme.accent
                        )
                    }

                    if model.shotCount > 0 {
                        ProgressRow(
                            title: "Shots covered",
                            detail: "\(model.completedShots) of \(model.shotCount)",
                            fraction: model.shotProgress,
                            tint: Theme.success
                        )
                    }
                }
            }
        }
    }

    // MARK: - Tools

    private var toolsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Tools")

            VStack(spacing: Theme.rowSpacing) {
                // Script gets its own full-width row: it's the thing people open
                // most, and it needs room for the draft name.
                Button {
                    Haptics.tap()
                    openEditor()
                } label: {
                    ToolRow(
                        symbol: "doc.text",
                        tint: Theme.accent,
                        title: "Script",
                        subtitle: scriptSubtitle,
                        isBusy: isOpeningEditor
                    )
                }
                .buttonStyle(.plain)
                .contextMenu {
                    Button {
                        isShowingDrafts = true
                    } label: {
                        Label(
                            model.scripts.count > 1
                                ? "All \(model.scripts.count) drafts"
                                : "Drafts",
                            systemImage: "doc.on.doc"
                        )
                    }
                }

                // A project with more than one draft says so, and offers them —
                // otherwise the extra versions are unreachable from the phone.
                if model.scripts.count > 1 {
                    Button {
                        Haptics.tap()
                        isShowingDrafts = true
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "doc.on.doc")
                                .font(.caption)
                            Text("\(model.scripts.count) drafts on this project")
                                .font(.subheadline.weight(.medium))
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                        }
                        .foregroundStyle(Theme.textSecondary)
                        .padding(.horizontal, 14)
                        .frame(minHeight: Theme.minTouchTarget)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }

                NavigationLink(value: ProjectRoute.documents) {
                    ToolRow(
                        symbol: "doc.richtext",
                        tint: Color(hex: 0x14B8A6),
                        title: "Documents",
                        subtitle: "Notes, treatments, outlines & more"
                    )
                }
                .buttonStyle(.plain)

                NavigationLink(value: ProjectRoute.scenes) {
                    ToolRow(
                        symbol: "list.bullet.rectangle",
                        tint: Color(hex: 0x8B5CF6),
                        title: "Scenes & breakdown",
                        subtitle: model.sceneCount == 0
                            ? "Break the script into scenes"
                            : "\(model.sceneCount) scene\(model.sceneCount == 1 ? "" : "s") · \(model.completedScenes) shot"
                    )
                }
                .buttonStyle(.plain)

                NavigationLink(value: ProjectRoute.shots) {
                    ToolRow(
                        symbol: "camera",
                        tint: Color(hex: 0x06B6D4),
                        title: "Shot list",
                        subtitle: model.shotCount == 0
                            ? "Plan your coverage"
                            : "\(model.shotCount) shot\(model.shotCount == 1 ? "" : "s") · \(model.completedShots) done"
                    )
                }
                .buttonStyle(.plain)

                NavigationLink(value: ProjectRoute.schedule) {
                    ToolRow(
                        symbol: "calendar",
                        tint: Color(hex: 0x22C55E),
                        title: "Schedule",
                        subtitle: model.events.isEmpty
                            ? "No days scheduled yet"
                            : "\(model.events.count) event\(model.events.count == 1 ? "" : "s")"
                    )
                }
                .buttonStyle(.plain)

                NavigationLink(value: ProjectRoute.gear) {
                    ToolRow(
                        symbol: "shippingbox",
                        tint: Color(hex: 0xF97316),
                        title: "Gear",
                        subtitle: "Equipment tracking & checkout"
                    )
                }
                .buttonStyle(.plain)

                NavigationLink(value: ProjectRoute.characters) {
                    ToolRow(
                        symbol: "person.2",
                        tint: Color(hex: 0xEC4899),
                        title: "Characters",
                        subtitle: model.characterCount == 0
                            ? "Add your cast of characters"
                            : "\(model.characterCount) character\(model.characterCount == 1 ? "" : "s")"
                    )
                }
                .buttonStyle(.plain)

                NavigationLink(value: ProjectRoute.slate) {
                    ToolRow(
                        symbol: "camera.aperture",
                        tint: Color(hex: 0xF59E0B),
                        title: "Slate",
                        subtitle: "Clapperboard — marks takes onto the shot list"
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var scriptSubtitle: String {
        guard let script = model.activeScript else {
            return model.isLoading ? "Loading…" : "Start writing"
        }
        var parts = [script.title, script.versionLabel]
        if script.isLocked { parts.append("Locked") }
        return parts.joined(separator: " · ")
    }

    // MARK: - Navigation

    @ViewBuilder
    private func destination(for route: ProjectRoute) -> some View {
        switch route {
        case .editor(let scriptID, let scriptTitle):
            ScriptEditorView(projectID: project.id, scriptID: scriptID, scriptTitle: scriptTitle)
        case .scenes:
            ScenesView(projectID: project.id)
        case .shots:
            ShotsView(projectID: project.id)
        case .schedule:
            ScheduleView(projectID: project.id, projectTitle: project.title)
        case .characters:
            CharactersView(projectID: project.id)
        case .slate:
            SlateView(projectID: project.id, projectTitle: project.title)
        case .documents:
            DocumentsView(projectID: project.id)
        case .gear:
            GearView(projectID: project.id)
        }
    }

    /// Opening the editor may need to create the project's first draft, so the
    /// push happens after an await rather than through a `NavigationLink`.
    private func createDraft() {
        guard let ownerID = auth.userID else { return }
        isOpeningEditor = true
        Task {
            let title = "\(project.title) — draft \(model.scripts.count + 1)"
            let created = await model.createDraft(title: title, ownerID: ownerID)
            isOpeningEditor = false
            guard let created else { return }
            router.push(.editor(scriptID: created.id, scriptTitle: created.title))
        }
    }

    private func openEditor() {
        if let script = model.activeScript {
            router.push(.editor(scriptID: script.id, scriptTitle: script.title))
            return
        }

        guard let ownerID = auth.userID else { return }
        isOpeningEditor = true
        Task {
            let script = await model.ensureScript(ownerID: ownerID, projectTitle: project.title)
            isOpeningEditor = false
            guard let script else { return }
            router.push(.editor(scriptID: script.id, scriptTitle: script.title))
        }
    }
}

// MARK: - Pieces

private struct StatCell: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.textPrimary)
                .monospacedDigit()
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(value) \(label)")
    }
}

private struct ProgressRow: View {
    let title: String
    let detail: String
    let fraction: Double
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                Spacer()
                Text(detail)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.textPrimary)
                    .monospacedDigit()
            }
            ProgressBar(fraction: fraction, tint: tint)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(detail)")
    }
}

struct ToolRow: View {
    let symbol: String
    let tint: Color
    let title: String
    let subtitle: String
    var isBusy = false

    var body: some View {
        Card(padding: 12) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 38, height: 38)
                    .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)

                if isBusy {
                    ProgressView().tint(Theme.textTertiary)
                } else {
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.textTertiary)
                        .accessibilityHidden(true)
                }
            }
            .frame(minHeight: Theme.minTouchTarget)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(subtitle)")
        .accessibilityAddTraits(.isButton)
    }
}

/// The next scheduled event, pinned near the top on shoot days.
private struct NextUpCard: View {
    let event: ScheduleEvent

    private var dayLabel: String {
        let calendar = Calendar.current
        if calendar.isDateInToday(event.startTime) { return "Today" }
        if calendar.isDateInTomorrow(event.startTime) { return "Tomorrow" }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE d MMM"
        return formatter.string(from: event.startTime)
    }

    var body: some View {
        Card {
            HStack(spacing: 12) {
                Image(systemName: event.resolvedType.symbol)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(event.resolvedType.tint)
                    .frame(width: 38, height: 38)
                    .background(event.resolvedType.tint.opacity(0.14), in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Next up · \(dayLabel)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                        .textCase(.uppercase)
                        .tracking(0.4)
                    Text(event.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(2)
                    Text(event.timeRangeLabel)
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                }

                Spacer(minLength: 0)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
