import SwiftUI

@MainActor
final class ScheduleViewModel: ObservableObject {

    @Published private(set) var events: [ScheduleEvent] = []
    @Published private(set) var locations: [ProductionLocation] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var showPast = false

    private let projectID: String
    private var hasLoaded = false

    init(projectID: String) {
        self.projectID = projectID
    }

    /// Events grouped into shooting days, oldest first, past days optional.
    var days: [(date: Date, events: [ScheduleEvent])] {
        let startOfToday = Calendar.current.startOfDay(for: Date())
        let visible = showPast ? events : events.filter { $0.day >= startOfToday }

        return Dictionary(grouping: visible, by: \.day)
            .map { (date: $0.key, events: $0.value.sorted { $0.startTime < $1.startTime }) }
            .sorted { $0.date < $1.date }
    }

    var upcomingCount: Int {
        let now = Date()
        return events.filter { $0.endTime >= now }.count
    }

    var shootDayCount: Int {
        Set(events.filter { $0.resolvedType == .shooting }.map(\.day)).count
    }

    var pastCount: Int {
        let startOfToday = Calendar.current.startOfDay(for: Date())
        return events.filter { $0.day < startOfToday }.count
    }

    func locationName(for event: ScheduleEvent) -> String? {
        guard let id = event.locationID else { return nil }
        return locations.first { $0.id == id }?.name
    }

    // MARK: - Loading

    func loadIfNeeded() async {
        guard !hasLoaded else {
            await refresh()
            return
        }
        hasLoaded = true

        let cache = LocalCache.shared
        async let cachedEvents = cache.load([ScheduleEvent].self, for: LocalCache.Key.schedule(projectID))
        async let cachedLocations = cache.load([ProductionLocation].self, for: LocalCache.Key.locations(projectID))
        events = await cachedEvents ?? []
        locations = await cachedLocations ?? []

        if events.isEmpty { isLoading = true }
        await refresh()
        isLoading = false
    }

    func refresh() async {
        async let eventsTask = ProductionService.fetchSchedule(projectID: projectID)
        async let locationsTask = ProductionService.fetchLocations(projectID: projectID)

        do {
            let (fetchedEvents, fetchedLocations) = try await (eventsTask, locationsTask)
            events = fetchedEvents
            locations = fetchedLocations
            errorMessage = nil

            let cache = LocalCache.shared
            await cache.save(fetchedEvents, for: LocalCache.Key.schedule(projectID))
            await cache.save(fetchedLocations, for: LocalCache.Key.locations(projectID))
        } catch is CancellationError {
        } catch {
            if events.isEmpty {
                errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    // MARK: - Mutations

    func create(
        title: String,
        type: ScheduleEventType,
        start: Date,
        end: Date,
        allDay: Bool,
        notes: String?,
        ownerID: String?
    ) async -> ScheduleEvent? {
        do {
            let created = try await ProductionService.createEvent(
                projectID: projectID,
                title: title,
                type: type,
                start: start,
                end: end,
                allDay: allDay,
                notes: notes,
                ownerID: ownerID
            )
            if let created {
                events.append(created)
                events.sort { $0.startTime < $1.startTime }
                await LocalCache.shared.save(events, for: LocalCache.Key.schedule(projectID))
                Haptics.success()
            }
            return created
        } catch {
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
            return nil
        }
    }

    func toggleConfirmed(_ event: ScheduleEvent) async {
        guard let index = events.firstIndex(where: { $0.id == event.id }) else { return }
        let newValue = !event.confirmed
        events[index].isConfirmed = newValue
        Haptics.tap()

        do {
            try await ProductionService.setEventConfirmed(id: event.id, confirmed: newValue)
            await LocalCache.shared.save(events, for: LocalCache.Key.schedule(projectID))
        } catch {
            events[index].isConfirmed = event.isConfirmed
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }

    func delete(_ event: ScheduleEvent) async {
        let previous = events
        events.removeAll { $0.id == event.id }
        do {
            try await ProductionService.deleteEvent(id: event.id)
            await LocalCache.shared.save(events, for: LocalCache.Key.schedule(projectID))
            Haptics.success()
        } catch {
            events = previous
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }
}

// MARK: - Day formatting

enum DayFormatter {
    /// "Today", "Tomorrow", or "Mon 14 Oct" — the labels people use out loud.
    static func label(for date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Today" }
        if calendar.isDateInTomorrow(date) { return "Tomorrow" }
        if calendar.isDateInYesterday(date) { return "Yesterday" }

        let formatter = DateFormatter()
        formatter.dateFormat = calendar.isDate(date, equalTo: Date(), toGranularity: .year)
            ? "EEE d MMM"
            : "EEE d MMM yyyy"
        return formatter.string(from: date)
    }

    static func relativeSuffix(for date: Date) -> String? {
        let calendar = Calendar.current
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: Date()), to: date).day ?? 0
        switch days {
        case 0, 1, -1: return nil
        case 2...13:   return "in \(days) days"
        default:       return nil
        }
    }
}
