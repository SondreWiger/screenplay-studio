import SwiftUI

/// Backing store for the projects list.
///
/// Follows the pattern every list screen in the app uses: paint from cache
/// immediately, refresh from the network in the background, and surface a
/// failure only when there's nothing cached to show.
@MainActor
final class ProjectsViewModel: ObservableObject {

    @Published private(set) var projects: [Project] = []
    @Published private(set) var isLoading = false
    @Published private(set) var isRefreshing = false
    @Published var errorMessage: String?
    @Published var searchText = ""
    @Published var statusFilter: ProjectStatus?

    private var hasLoadedFromCache = false
    private var liveTask: Task<Void, Never>?

    deinit { liveTask?.cancel() }

    /// Live project changes. Requires `projects` to be in the
    /// `supabase_realtime` publication — see
    /// `supabase/migration_realtime_mobile.sql`. Until that runs this simply
    /// receives nothing; pull-to-refresh and the foreground refresh still work.
    func startLiveUpdates() {
        guard liveTask == nil else { return }
        liveTask = Task { [weak self] in
            let stream = await RealtimeClient.shared.changes(table: "projects")
            for await change in stream {
                guard let self else { return }
                await self.applyLive(change)
            }
        }
    }

    func stopLiveUpdates() {
        liveTask?.cancel()
        liveTask = nil
    }

    private func applyLive(_ change: RealtimeChange) {
        let changed = LiveMerge.apply(change, to: &projects) { a, b in
            (a.updatedAt ?? .distantPast) > (b.updatedAt ?? .distantPast)
        }
        guard changed else { return }
        Task { await LocalCache.shared.save(projects, for: LocalCache.Key.projects) }
    }

    var filteredProjects: [Project] {
        var result = projects

        if let statusFilter {
            result = result.filter { $0.resolvedStatus == statusFilter }
        }

        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !term.isEmpty {
            result = result.filter {
                $0.title.lowercased().contains(term)
                    || ($0.logline?.lowercased().contains(term) ?? false)
                    || ($0.genre?.contains { $0.lowercased().contains(term) } ?? false)
            }
        }

        return result
    }

    /// Counts per status, for the filter row.
    var statusCounts: [ProjectStatus: Int] {
        Dictionary(grouping: projects, by: \.resolvedStatus).mapValues(\.count)
    }

    // MARK: - Loading

    func loadIfNeeded() async {
        guard !hasLoadedFromCache else {
            await refresh(showSpinner: false)
            return
        }
        hasLoadedFromCache = true

        if let cached = await LocalCache.shared.load([Project].self, for: LocalCache.Key.projects) {
            projects = cached
        } else {
            isLoading = true
        }

        await refresh(showSpinner: false)
        isLoading = false
    }

    func refresh(showSpinner: Bool = true) async {
        if showSpinner { isRefreshing = true }
        defer { isRefreshing = false }

        do {
            let fetched = try await ProjectService.fetchAll()
            projects = fetched
            errorMessage = nil
            await LocalCache.shared.save(fetched, for: LocalCache.Key.projects)
        } catch is CancellationError {
            // Screen went away mid-flight — nothing to report.
        } catch {
            // Cached rows are still on screen and still useful; only shout when
            // the list would otherwise be blank.
            if projects.isEmpty {
                errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    // MARK: - Mutations

    func create(title: String, format: ProjectFormat, logline: String?, ownerID: String) async -> Project? {
        do {
            guard let created = try await ProjectService.create(
                title: title, format: format, logline: logline, ownerID: ownerID
            ) else { return nil }

            projects.insert(created, at: 0)
            await LocalCache.shared.save(projects, for: LocalCache.Key.projects)
            Haptics.success()
            return created
        } catch {
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
            return nil
        }
    }

    func delete(_ project: Project) async {
        let previous = projects
        projects.removeAll { $0.id == project.id }

        do {
            try await ProjectService.delete(id: project.id)
            await LocalCache.shared.save(projects, for: LocalCache.Key.projects)
            Haptics.success()
        } catch {
            // Put it back — a delete that didn't happen must not look like it did.
            projects = previous
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }

    func setStatus(_ status: ProjectStatus, for project: Project) async {
        guard let index = projects.firstIndex(where: { $0.id == project.id }) else { return }
        let previous = projects[index].status
        projects[index].status = status

        do {
            try await ProjectService.updateStatus(id: project.id, status: status)
            await LocalCache.shared.save(projects, for: LocalCache.Key.projects)
            Haptics.success()
        } catch {
            projects[index].status = previous
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }
}
