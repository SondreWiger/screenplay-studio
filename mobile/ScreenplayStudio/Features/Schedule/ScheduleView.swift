import SwiftUI

/// The production schedule, as an agenda rather than a month grid.
///
/// A month grid on a 390pt screen gives every day about 50pt — enough for a dot,
/// not enough for a call time. An agenda shows the thing people actually need:
/// what's happening next, and when they have to be there.
struct ScheduleView: View {

    let projectID: String
    let projectTitle: String

    @EnvironmentObject private var auth: AuthStore
    @StateObject private var model: ScheduleViewModel
    @State private var isPresentingNewEvent = false

    init(projectID: String, projectTitle: String) {
        self.projectID = projectID
        self.projectTitle = projectTitle
        _model = StateObject(wrappedValue: ScheduleViewModel(projectID: projectID))
    }

    var body: some View {
        List {
            if !model.events.isEmpty {
                Section {
                    summaryStrip
                    if model.pastCount > 0 {
                        pastToggle
                    }
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(rowInsets)
            }

            if model.days.isEmpty {
                Section {
                    emptyContent
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(rowInsets)
            } else {
                ForEach(model.days, id: \.date) { day in
                    Section {
                        ForEach(day.events) { event in
                            EventRow(
                                event: event,
                                locationName: model.locationName(for: event),
                                onToggleConfirmed: { Task { await model.toggleConfirmed(event) } }
                            )
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                            .listRowInsets(rowInsets)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    Task { await model.delete(event) }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                Button {
                                    Task { await model.toggleConfirmed(event) }
                                } label: {
                                    Label(event.confirmed ? "Unconfirm" : "Confirm",
                                          systemImage: event.confirmed ? "questionmark.circle" : "checkmark.seal")
                                }
                                .tint(event.confirmed ? Theme.textTertiary : Theme.success)
                            }
                        }
                    } header: {
                        DayHeader(date: day.date, eventCount: day.events.count)
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .refreshable { await model.refresh() }
        .navigationTitle("Schedule")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Haptics.tap()
                    isPresentingNewEvent = true
                } label: {
                    Image(systemName: "plus").tappableArea()
                }
                .accessibilityLabel("New event")
            }
        }
        .sheet(isPresented: $isPresentingNewEvent) {
            NewEventSheet { title, type, start, end, allDay, notes in
                await model.create(
                    title: title,
                    type: type,
                    start: start,
                    end: end,
                    allDay: allDay,
                    notes: notes,
                    ownerID: auth.userID
                )
            }
        }
        .task { await model.loadIfNeeded() }
    }

    private var rowInsets: EdgeInsets {
        EdgeInsets(top: 4, leading: Theme.screenPadding, bottom: 4, trailing: Theme.screenPadding)
    }

    private var summaryStrip: some View {
        Card(padding: 12) {
            HStack(spacing: 0) {
                MiniStat(value: "\(model.shootDayCount)", label: "Shoot days")
                MiniStat(value: "\(model.upcomingCount)", label: "Upcoming")
                MiniStat(value: "\(model.events.count)", label: "Total")
            }
        }
    }

    private var pastToggle: some View {
        Button {
            Haptics.selectionChanged()
            model.showPast.toggle()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: model.showPast ? "eye.slash" : "clock.arrow.circlepath")
                    .font(.caption)
                Text(model.showPast
                     ? "Hide past days"
                     : "Show \(model.pastCount) past event\(model.pastCount == 1 ? "" : "s")")
                    .font(.subheadline.weight(.medium))
            }
            .foregroundStyle(Theme.textSecondary)
            .frame(maxWidth: .infinity)
            .frame(minHeight: Theme.minTouchTarget)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var emptyContent: some View {
        if model.isLoading && model.events.isEmpty {
            SkeletonList(rows: 3)
        } else if let error = model.errorMessage, model.events.isEmpty {
            ErrorStateView(message: error) { Task { await model.refresh() } }
                .padding(.top, 40)
        } else if model.events.isEmpty {
            EmptyStateView(
                symbol: "calendar",
                title: "Nothing scheduled",
                message: "Add shoot days, rehearsals, recces and meetings. They'll show up on the Today tab too.",
                actionTitle: "Add an event"
            ) { isPresentingNewEvent = true }
            .padding(.top, 30)
        } else {
            EmptyStateView(
                symbol: "checkmark.circle",
                title: "Nothing upcoming",
                message: "Every scheduled day is in the past. Turn on past events to see them."
            )
            .padding(.top, 30)
        }
    }
}

// MARK: - Day header

struct DayHeader: View {
    let date: Date
    let eventCount: Int

    private var isToday: Bool { Calendar.current.isDateInToday(date) }

    var body: some View {
        HStack(spacing: 8) {
            Text(DayFormatter.label(for: date))
                .font(.subheadline.weight(.bold))
                .foregroundStyle(isToday ? Theme.accent : Theme.textPrimary)

            if let suffix = DayFormatter.relativeSuffix(for: date) {
                Text(suffix)
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
            }

            Spacer(minLength: 4)

            Text("\(eventCount)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.textTertiary)
                .monospacedDigit()
        }
        .padding(.horizontal, Theme.screenPadding)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.background)
        .listRowInsets(EdgeInsets())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(DayFormatter.label(for: date)), \(eventCount) event\(eventCount == 1 ? "" : "s")")
    }
}

// MARK: - Event row

struct EventRow: View {
    let event: ScheduleEvent
    let locationName: String?
    let onToggleConfirmed: () -> Void

    private var tint: Color {
        // A stored colour wins; otherwise the event type's own colour keeps the
        // list readable without any setup.
        event.color?.nonEmpty.map { Color(webHex: $0) } ?? event.resolvedType.tint
    }

    var body: some View {
        Card {
            HStack(alignment: .top, spacing: 12) {
                VStack(spacing: 2) {
                    Image(systemName: event.resolvedType.symbol)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(tint)
                        .frame(width: 36, height: 36)
                        .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                }
                .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 4) {
                    Text(event.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 6) {
                        Text(event.timeRangeLabel)
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                            .monospacedDigit()

                        if let duration = event.durationLabel {
                            Text("· \(duration)")
                                .font(.caption)
                                .foregroundStyle(Theme.textTertiary)
                        }
                    }

                    HStack(spacing: 6) {
                        Chip(text: event.resolvedType.label, tint: tint)
                        if event.confirmed {
                            Chip(text: "Confirmed", symbol: "checkmark.seal.fill", tint: Theme.success)
                        }
                    }

                    if let locationName {
                        MetaLabel(symbol: "mappin", text: locationName)
                    }

                    if let callTime = event.callTime {
                        MetaLabel(symbol: "bell", text: "Call \(Self.time(callTime))")
                    }

                    if let notes = event.notes?.nonEmpty {
                        Text(notes)
                            .font(.caption)
                            .foregroundStyle(Theme.textTertiary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                }

                Spacer(minLength: 0)

                Button(action: onToggleConfirmed) {
                    Image(systemName: event.confirmed ? "checkmark.seal.fill" : "checkmark.seal")
                        .font(.body)
                        .foregroundStyle(event.confirmed ? Theme.success : Theme.textTertiary)
                        .tappableArea(38)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(event.confirmed ? "Mark as unconfirmed" : "Mark as confirmed")
            }
        }
        .accessibilityElement(children: .contain)
    }

    private static func time(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter.string(from: date)
    }
}
