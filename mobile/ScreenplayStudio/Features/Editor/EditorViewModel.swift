import SwiftUI

/// State and persistence for the script editor.
///
/// Edits are applied to the in-memory array immediately and pushed to the server
/// on a debounce. Nothing in the typing path waits on the network — on a train,
/// on set, or in a lift, the text keeps up with the thumb.
@MainActor
final class EditorViewModel: ObservableObject {

    enum SaveState: Equatable {
        case idle
        case pending
        case saving
        case saved(Date)
        case queuedOffline(Int)
        case failed(String)
    }

    @Published private(set) var elements: [ScriptElement] = []
    @Published private(set) var isLoading = false
    @Published private(set) var saveState: SaveState = .idle
    @Published var errorMessage: String?

    /// Element currently holding the keyboard.
    @Published var focusedElementID: String?

    let scriptID: String
    let projectID: String

    private var hasLoaded = false
    private var ownerID: String?

    /// Column-level patches waiting to go up, keyed by element id.
    private var pendingPatches: [String: ScriptElementPatch] = [:]
    /// Elements created locally that the server hasn't acknowledged yet.
    private var pendingInserts: [String: ScriptElement] = [:]
    private var pendingDeletes: Set<String> = []
    /// Set after a drag or a renumber; sent as one bulk upsert on the next save.
    private var needsReorder = false

    private var flushTask: Task<Void, Never>?
    private var cacheTask: Task<Void, Never>?
    private var liveTask: Task<Void, Never>?

    /// True while a collaborator's edit is arriving, so the banner can say so.
    @Published private(set) var lastRemoteEditAt: Date?

    init(projectID: String, scriptID: String) {
        self.projectID = projectID
        self.scriptID = scriptID
    }

    deinit { liveTask?.cancel() }

    // MARK: - Live collaboration

    /// Applies element changes from other people as they happen.
    ///
    /// The safety rule is narrow and strict: never touch the element the caret
    /// is in, and never touch one with an edit of our own still queued. Those
    /// are the only two cases where the local copy is more current than the
    /// server's, and overwriting either would delete something the user just
    /// typed.
    func startLiveUpdates() {
        guard liveTask == nil else { return }
        liveTask = Task { [weak self, scriptID] in
            let stream = await RealtimeClient.shared.changes(
                table: "script_elements", filter: "script_id=eq.\(scriptID)"
            )
            for await change in stream {
                guard let self else { return }
                self.applyLive(change)
            }
        }
    }

    func stopLiveUpdates() {
        liveTask?.cancel()
        liveTask = nil
    }

    private func applyLive(_ change: RealtimeChange) {
        // Our own saves come back over the socket too. An echo that matches
        // what's already on screen stops here, before it costs a sort, a cache
        // write and a redraw.
        if change.kind == .update,
           let row = change.decoded(ScriptElement.self),
           let index = index(of: row.id),
           elements[index].drawsSame(as: row) {
            return
        }

        // Merged on a copy: writing through `&elements` publishes, and so
        // redraws the editor, even when the change ends up skipped.
        var merged = elements
        let changed = LiveMerge.apply(
            change,
            to: &merged,
            skip: { [weak self] id in
                guard let self else { return true }
                return id == self.focusedElementID
                    || self.pendingPatches[id] != nil
                    || self.pendingInserts[id] != nil
            },
            sort: { $0.sortOrder < $1.sortOrder }
        )
        guard changed else { return }
        elements = merged
        lastRemoteEditAt = Date()
        scheduleCacheSave()
    }

    // MARK: - Derived

    /// Distinct character names, newest use first — feeds the autocomplete bar.
    var knownCharacterNames: [String] {
        var seen = Set<String>()
        var names: [String] = []
        for element in elements.reversed() where element.elementType == .character {
            let name = element.content.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            guard !name.isEmpty, !seen.contains(name) else { continue }
            seen.insert(name)
            names.append(name)
        }
        return names
    }

    /// Scene headings with their index, for the scene jump list.
    var sceneIndex: [(index: Int, element: ScriptElement)] {
        elements.enumerated()
            .filter { $0.element.elementType == .sceneHeading }
            .map { (index: $0.offset, element: $0.element) }
    }

    /// Rough page count using the industry approximation of 55 lines per page.
    var estimatedPages: Double {
        let lines = elements.reduce(0.0) { total, element in
            let characters = max(element.content.count, 1)
            let perLine: Double
            switch element.elementType {
            case .dialogue:      perLine = 35
            case .parenthetical: perLine = 25
            default:             perLine = 60
            }
            return total + max(1, (Double(characters) / perLine).rounded(.up))
                + Double(element.elementType.spacingAbove > 10 ? 1 : 0)
        }
        return lines / 55
    }

    var wordCount: Int {
        elements.reduce(0) { $0 + $1.content.split(whereSeparator: \.isWhitespace).count }
    }

    func index(of id: String) -> Int? {
        elements.firstIndex { $0.id == id }
    }

    // MARK: - Loading

    func load(ownerID: String?) async {
        self.ownerID = ownerID
        guard !hasLoaded else { return }
        hasLoaded = true

        UserDefaults.standard.set(scriptID, forKey: "ss.lastScript.\(projectID)")

        if let cached = await LocalCache.shared.load(
            [ScriptElement].self, for: LocalCache.Key.elements(scriptID)
        ), !cached.isEmpty {
            elements = cached
        } else {
            isLoading = true
        }

        await loadFromServer()
    }

    /// Tries the server again after a failed first load.
    func retry() async {
        errorMessage = nil
        isLoading = elements.isEmpty
        await loadFromServer()
    }

    private func loadFromServer() async {
        let fetched = await refresh()
        isLoading = false

        // A brand new script starts with one empty slug line rather than a void
        // — but only once the server has said it really is empty. Seeding after
        // a failed load would write a stray heading into a script that has text.
        if fetched, elements.isEmpty {
            let first = ScriptElement(scriptID: scriptID, elementType: .sceneHeading, sortOrder: 0)
            elements = [first]
            pendingInserts[first.id] = first
            focusedElementID = first.id
            scheduleFlush()
        }
    }

    /// Returns true when the server answered, even with no rows.
    @discardableResult
    func refresh() async -> Bool {
        // Don't clobber unsent local work with a server snapshot that predates it.
        guard pendingPatches.isEmpty, pendingInserts.isEmpty, pendingDeletes.isEmpty else { return false }

        do {
            let fetched = try await ScriptService.fetchElements(scriptID: scriptID)
            elements = fetched
            await LocalCache.shared.save(fetched, for: LocalCache.Key.elements(scriptID))
            errorMessage = nil
            return true
        } catch is CancellationError {
            // Left the screen.
            return false
        } catch {
            if elements.isEmpty {
                errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            }
            return false
        }
    }

    // MARK: - Editing

    func updateContent(_ content: String, for id: String) {
        guard let index = index(of: id), elements[index].content != content else { return }
        elements[index].content = content

        if pendingInserts[id] != nil {
            // Not on the server yet — amend the queued insert rather than
            // sending a patch for a row that doesn't exist.
            pendingInserts[id]?.content = content
        } else {
            var patch = pendingPatches[id] ?? ScriptElementPatch()
            patch.content = content
            patch.updatedAt = Date()
            pendingPatches[id] = patch
        }
        scheduleFlush()
    }

    func changeType(_ type: ScriptElementType, for id: String) {
        guard let index = index(of: id), elements[index].elementType != type else { return }
        elements[index].elementType = type

        // Casing is part of the format, so switching type re-cases the text.
        if type.isUppercased {
            elements[index].content = elements[index].content.uppercased()
        }
        let content = elements[index].content

        if pendingInserts[id] != nil {
            pendingInserts[id]?.elementType = type
            pendingInserts[id]?.content = content
        } else {
            var patch = pendingPatches[id] ?? ScriptElementPatch()
            patch.elementType = type.rawValue
            patch.content = content
            patch.updatedAt = Date()
            pendingPatches[id] = patch
        }
        Haptics.selectionChanged()
        scheduleFlush()
    }

    /// Inserts a new element after `id` and returns its identifier so the caller
    /// can move focus to it.
    @discardableResult
    func insertElement(after id: String, type: ScriptElementType? = nil) -> String? {
        guard let index = index(of: id) else { return nil }
        let current = elements[index]
        let newType = type ?? current.elementType.nextOnReturn

        let element = ScriptElement(
            scriptID: scriptID,
            elementType: newType,
            sortOrder: sortOrder(after: index)
        )

        elements.insert(element, at: index + 1)
        pendingInserts[element.id] = element
        focusedElementID = element.id
        Haptics.tap()
        scheduleFlush()
        return element.id
    }

    @discardableResult
    func appendElement(type: ScriptElementType = .action) -> String? {
        if let last = elements.last {
            return insertElement(after: last.id, type: type)
        }
        let element = ScriptElement(scriptID: scriptID, elementType: type, sortOrder: 0)
        elements.append(element)
        pendingInserts[element.id] = element
        focusedElementID = element.id
        scheduleFlush()
        return element.id
    }

    /// Backspace at the start of an element.
    ///
    /// Empty element → delete it and focus the previous one's end.
    /// Non-empty → append its text to the previous element and delete it,
    /// which is what every text editor does and what people expect.
    func mergeBackwards(from id: String) {
        guard let index = index(of: id), index > 0 else { return }
        let current = elements[index]
        let previousID = elements[index - 1].id

        if !current.content.isEmpty {
            let merged = elements[index - 1].content + current.content
            elements[index - 1].content = merged
            recordContentChange(merged, for: previousID)
        }

        delete(id: id, moveFocusTo: previousID)
    }

    func delete(id: String, moveFocusTo focusID: String? = nil) {
        guard let index = index(of: id) else { return }
        // Never leave the script with nothing to type into.
        guard elements.count > 1 else {
            elements[0].content = ""
            recordContentChange("", for: elements[0].id)
            scheduleFlush()
            return
        }

        elements.remove(at: index)

        if pendingInserts.removeValue(forKey: id) == nil {
            pendingDeletes.insert(id)
        }
        pendingPatches.removeValue(forKey: id)

        focusedElementID = focusID ?? elements[min(index, elements.count - 1)].id
        Haptics.tap()
        scheduleFlush()
    }

    func move(from source: IndexSet, to destination: Int) {
        elements.move(fromOffsets: source, toOffset: destination)
        renumberAll()
        Haptics.impact()
        scheduleFlush()
    }

    private func recordContentChange(_ content: String, for id: String) {
        if pendingInserts[id] != nil {
            pendingInserts[id]?.content = content
        } else {
            var patch = pendingPatches[id] ?? ScriptElementPatch()
            patch.content = content
            patch.updatedAt = Date()
            pendingPatches[id] = patch
        }
    }

    /// Where a line inserted after `index` goes: halfway to the next one, as the
    /// web editor does, so nothing else in the script moves. Renumbering every
    /// later line instead cost one request per line on save, and as many
    /// realtime echoes back.
    private func sortOrder(after index: Int) -> Double {
        let current = elements[index].sortOrder
        guard index + 1 < elements.count else { return current + 1 }
        let middle = (current + elements[index + 1].sortOrder) / 2
        if middle > current, middle < elements[index + 1].sortOrder { return middle }

        // Neighbours share a value, or repeated inserts at one spot have used
        // up the gap. Spread the script out once and try again.
        renumberAll()
        return elements[index].sortOrder + 0.5
    }

    /// Resets `sortOrder` to 0, 1, 2… and marks the script for one bulk
    /// reorder on the next save.
    private func renumberAll() {
        for index in elements.indices where elements[index].sortOrder != Double(index) {
            elements[index].sortOrder = Double(index)
            pendingInserts[elements[index].id]?.sortOrder = Double(index)
        }
        needsReorder = true
    }

    // MARK: - Saving

    private func scheduleFlush() {
        saveState = .pending
        scheduleCacheSave()

        flushTask?.cancel()
        let delay = AppSettings.shared.autosaveDelay(
            isExpensive: NetworkMonitor.shared.shouldConserveData
        )

        flushTask = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            await self?.flush()
        }
    }

    /// Writes the script to the on-device cache a second after the last change
    /// rather than on every keystroke, which encoded the whole script per
    /// letter and left a backlog of copies waiting on the cache.
    private func scheduleCacheSave() {
        cacheTask?.cancel()
        cacheTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled, let self else { return }
            await LocalCache.shared.save(self.elements, for: LocalCache.Key.elements(self.scriptID))
        }
    }

    /// Pushes everything queued. Safe to call repeatedly.
    func flush() async {
        guard !pendingPatches.isEmpty || !pendingInserts.isEmpty || !pendingDeletes.isEmpty || needsReorder
        else { return }

        // No signal: park the work durably and tell the user plainly.
        guard NetworkMonitor.shared.isOnline else {
            await queueEverythingOffline()
            saveState = .queuedOffline(await SyncQueue.shared.count)
            return
        }

        saveState = .saving

        let inserts = pendingInserts
        let patches = pendingPatches
        let deletes = pendingDeletes
        let reorder = needsReorder
        pendingInserts.removeAll()
        pendingPatches.removeAll()
        pendingDeletes.removeAll()
        needsReorder = false

        // What actually reached the server, so a failure part-way through
        // puts back only the rest. Re-sending finished writes is how a retry
        // used to end in a duplicate-key error and a "Couldn't save" alert.
        var insertedIDs = Set<String>()
        var patchedIDs = Set<String>()
        var deletedIDs = Set<String>()
        var reordered = false

        func putBackUnfinished() {
            merge(
                inserts: inserts.filter { !insertedIDs.contains($0.key) },
                patches: patches.filter { !patchedIDs.contains($0.key) },
                deletes: deletes.subtracting(deletedIDs),
                reorder: reorder && !reordered
            )
        }

        do {
            // Order matters: create, then edit, then remove.
            for element in inserts.values.sorted(by: { $0.sortOrder < $1.sortOrder }) {
                try await ScriptService.insert(element, createdBy: ownerID)
                insertedIDs.insert(element.id)
            }
            for (id, patch) in patches {
                try await ScriptService.update(id: id, patch: patch)
                patchedIDs.insert(id)
            }
            for id in deletes {
                try await ScriptService.delete(id: id)
                deletedIDs.insert(id)
            }
            if reorder {
                try await ScriptService.reorder(elements)
                reordered = true
            }

            saveState = .saved(Date())
            errorMessage = nil
            await LocalCache.shared.save(elements, for: LocalCache.Key.elements(scriptID))

        } catch is CancellationError {
            // Put the work back so leaving the screen doesn't drop an edit.
            putBackUnfinished()
            saveState = .pending

        } catch let error as SupabaseError where error.isRetryable || error == .offline {
            putBackUnfinished()
            await queueEverythingOffline()
            saveState = .queuedOffline(await SyncQueue.shared.count)

        } catch {
            putBackUnfinished()
            let message = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            saveState = .failed(message)
            Haptics.error()
        }
    }

    private func merge(
        inserts: [String: ScriptElement],
        patches: [String: ScriptElementPatch],
        deletes: Set<String>,
        reorder: Bool
    ) {
        pendingInserts.merge(inserts) { current, _ in current }
        pendingPatches.merge(patches) { current, _ in current }
        pendingDeletes.formUnion(deletes)
        needsReorder = needsReorder || reorder
    }

    private func queueEverythingOffline() async {
        for element in pendingInserts.values.sorted(by: { $0.sortOrder < $1.sortOrder }) {
            await ScriptService.queueInsert(element, createdBy: ownerID)
        }
        for (id, patch) in pendingPatches {
            await ScriptService.queueUpdate(id: id, patch: patch)
        }
        for id in pendingDeletes {
            await ScriptService.queueDelete(id: id)
        }
        pendingInserts.removeAll()
        pendingPatches.removeAll()
        pendingDeletes.removeAll()
    }

    /// Called when the editor is dismissed — never leave the screen with unsent work.
    func flushImmediately() async {
        flushTask?.cancel()
        cacheTask?.cancel()
        await flush()
        await LocalCache.shared.save(elements, for: LocalCache.Key.elements(scriptID))
    }
}

private extension ScriptElement {
    /// Same line on the page, timestamps aside — how a realtime echo of our own
    /// save is told apart from someone else's edit.
    func drawsSame(as other: ScriptElement) -> Bool {
        content == other.content
            && elementType == other.elementType
            && sortOrder == other.sortOrder
            && sceneNumber == other.sceneNumber
            && revisionColor == other.revisionColor
            && isRevised == other.isRevised
            && isOmitted == other.isOmitted
    }
}
