import SwiftUI

/// A cross-project agenda: what's on today and next, plus a jump back into
/// whatever was last being written.
///
/// This is the screen a phone is actually best at — you check it in a taxi on
/// the way to a location, not at a desk.
@MainActor
final class TodayViewModel: ObservableObject {

    struct Entry: Identifiable, Hashable {
        let event: ScheduleEvent
        let projectTitle: String
        var id: String { event.id }
    }

    @Published private(set) var entries: [Entry] = []
    @Published private(set) var projects: [Project] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private var hasLoaded = false

    var today: [Entry] {
        let calendar = Calendar.current
        return entries.filter { calendar.isDateInToday($0.event.startTime) }
    }

    var upcoming: [Entry] {
        let startOfTomorrow = Calendar.current.startOfDay(for: Date().addingTimeInterval(86400))
        return entries
            .filter { $0.event.startTime >= startOfTomorrow }
            .prefix(12)
            .map { $0 }
    }

    var upcomingByDay: [(date: Date, entries: [Entry])] {
        Dictionary(grouping: upcoming, by: \.event.day)
            .map { (date: $0.key, entries: $0.value.sorted { $0.event.startTime < $1.event.startTime }) }
            .sorted { $0.date < $1.date }
    }

    /// Most recently touched projects, for the quick-resume row.
    var recentProjects: [Project] {
        Array(projects.prefix(5))
    }

    func loadIfNeeded() async {
        guard !hasLoaded else {
            await refresh()
            return
        }
        hasLoaded = true

        if let cached = await LocalCache.shared.load([Project].self, for: LocalCache.Key.projects) {
            projects = cached
            await buildEntriesFromCache()
        }
        if entries.isEmpty { isLoading = true }
        await refresh()
        isLoading = false
    }

    private func buildEntriesFromCache() async {
        var collected: [Entry] = []
        for project in projects {
            if let events = await LocalCache.shared.load(
                [ScheduleEvent].self, for: LocalCache.Key.schedule(project.id)
            ) {
                collected.append(contentsOf: events.map { Entry(event: $0, projectTitle: project.title) })
            }
        }
        entries = collected.sorted { $0.event.startTime < $1.event.startTime }
    }

    func refresh() async {
        do {
            let fetchedProjects = try await ProjectService.fetchAll()
            projects = fetchedProjects
            await LocalCache.shared.save(fetchedProjects, for: LocalCache.Key.projects)

            // Only the handful of projects someone is actively working on need a
            // schedule fetch here — pulling every project's calendar on a tab
            // switch would be a lot of requests for a screen you glance at.
            let active = fetchedProjects.filter {
                $0.resolvedStatus != .archived && $0.resolvedStatus != .completed
            }.prefix(8)

            var collected: [Entry] = []
            try await withThrowingTaskGroup(of: (Project, [ScheduleEvent]).self) { group in
                for project in active {
                    group.addTask {
                        let events = try await ProductionService.fetchSchedule(projectID: project.id)
                        return (project, events)
                    }
                }
                for try await (project, events) in group {
                    collected.append(contentsOf: events.map { Entry(event: $0, projectTitle: project.title) })
                    await LocalCache.shared.save(events, for: LocalCache.Key.schedule(project.id))
                }
            }

            entries = collected.sorted { $0.event.startTime < $1.event.startTime }
            errorMessage = nil

        } catch is CancellationError {
        } catch {
            if entries.isEmpty {
                errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            }
        }
    }
}

struct TodayView: View {

    @EnvironmentObject private var auth: AuthStore
    @StateObject private var model = TodayViewModel()

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                greeting

                if model.isLoading && model.entries.isEmpty && model.projects.isEmpty {
                    SkeletonList(rows: 3)
                } else {
                    todaySection
                    upcomingSection
                    recentSection
                }
            }
            .screenPadding()
            .padding(.top, 4)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .refreshable { await model.refresh() }
        .navigationTitle("Today")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .navigationDestination(for: Project.self) { project in
            ProjectHubView(project: project)
        }
        .task { await model.loadIfNeeded() }
    }

    // MARK: - Greeting

    private var greeting: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(Self.greetingText())
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.textPrimary)
            Text(Self.dateText())
                .font(.subheadline)
                .foregroundStyle(Theme.textTertiary)
        }
        .accessibilityElement(children: .combine)
    }

    private static func greetingText() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<5:   return "Still up?"
        case 5..<12:  return "Good morning"
        case 12..<18: return "Good afternoon"
        default:      return "Good evening"
        }
    }

    private static func dateText() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE d MMMM"
        return formatter.string(from: Date())
    }

    // MARK: - Sections

    @ViewBuilder
    private var todaySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "On today", subtitle: model.today.isEmpty ? nil : "\(model.today.count) scheduled")

            if model.today.isEmpty {
                Card {
                    HStack(spacing: 10) {
                        Image(systemName: "cup.and.saucer")
                            .font(.body)
                            .foregroundStyle(Theme.textTertiary)
                            .accessibilityHidden(true)
                        Text("Nothing scheduled today.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textSecondary)
                        Spacer(minLength: 0)
                    }
                    .frame(minHeight: 36)
                }
            } else {
                VStack(spacing: Theme.rowSpacing) {
                    ForEach(model.today) { entry in
                        TodayEventRow(entry: entry)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var upcomingSection: some View {
        if !model.upcomingByDay.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Coming up")

                VStack(spacing: 14) {
                    ForEach(model.upcomingByDay, id: \.date) { day in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 6) {
                                Text(DayFormatter.label(for: day.date))
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Theme.textSecondary)
                                if let suffix = DayFormatter.relativeSuffix(for: day.date) {
                                    Text(suffix)
                                        .font(.caption2)
                                        .foregroundStyle(Theme.textTertiary)
                                }
                            }

                            VStack(spacing: Theme.rowSpacing) {
                                ForEach(day.entries) { entry in
                                    TodayEventRow(entry: entry)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var recentSection: some View {
        if !model.recentProjects.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Pick up where you left off")

                VStack(spacing: Theme.rowSpacing) {
                    ForEach(model.recentProjects) { project in
                        NavigationLink(value: project) {
                            ProjectRow(project: project)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        } else if model.projects.isEmpty && !model.isLoading {
            EmptyStateView(
                symbol: "film.stack",
                title: "Nothing here yet",
                message: "Create a project on the Projects tab and its schedule will show up here."
            )
            .padding(.top, 20)
        }
    }
}

// MARK: - Row

private struct TodayEventRow: View {
    let entry: TodayViewModel.Entry

    private var event: ScheduleEvent { entry.event }
    private var tint: Color {
        event.color?.nonEmpty.map { Color(webHex: $0) } ?? event.resolvedType.tint
    }

    private var isNow: Bool {
        let now = Date()
        return event.startTime <= now && event.endTime >= now
    }

    var body: some View {
        Card {
            HStack(alignment: .top, spacing: 12) {
                VStack(spacing: 2) {
                    Text(Self.time(event.startTime))
                        .font(.caption.weight(.bold))
                        .foregroundStyle(isNow ? Theme.accent : Theme.textPrimary)
                        .monospacedDigit()
                    if !event.isAllDay {
                        Text(Self.time(event.endTime))
                            .font(.caption2)
                            .foregroundStyle(Theme.textTertiary)
                            .monospacedDigit()
                    }
                }
                .frame(width: 48)
                .accessibilityElement(children: .combine)
                .accessibilityLabel(event.timeRangeLabel)

                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(tint)
                    .frame(width: 3)
                    .frame(maxHeight: .infinity)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 4) {
                    if isNow {
                        Chip(text: "Now", tint: Theme.accent, prominent: true)
                    }

                    Text(event.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 6) {
                        Chip(text: event.resolvedType.label, symbol: event.resolvedType.symbol, tint: tint)
                        if event.confirmed {
                            Image(systemName: "checkmark.seal.fill")
                                .font(.caption2)
                                .foregroundStyle(Theme.success)
                                .accessibilityLabel("Confirmed")
                        }
                    }

                    MetaLabel(symbol: "film", text: entry.projectTitle)
                }

                Spacer(minLength: 0)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(event.title), \(entry.projectTitle), \(event.timeRangeLabel)")
    }

    private static func time(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter.string(from: date)
    }
}
