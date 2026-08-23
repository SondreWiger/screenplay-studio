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

    private var flushTask: Task<Void, Never>?

    init(projectID: String, scriptID: String) {
        self.projectID = projectID
        self.scriptID = scriptID
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

        await refresh()
        isLoading = false

        // A brand new script starts with one empty slug line rather than a void.
        if elements.isEmpty {
            let first = ScriptElement(scriptID: scriptID, elementType: .sceneHeading, sortOrder: 0)
            elements = [first]
            pendingInserts[first.id] = first
            focusedElementID = first.id
            scheduleFlush()
        }
    }

    func refresh() async {
        // Don't clobber unsent local work with a server snapshot that predates it.
        guard pendingPatches.isEmpty, pendingInserts.isEmpty, pendingDeletes.isEmpty else { return }

        do {
            let fetched = try await ScriptService.fetchElements(scriptID: scriptID)
            elements = fetched
            await LocalCache.shared.save(fetched, for: LocalCache.Key.elements(scriptID))
            errorMessage = nil
        } catch is CancellationError {
            // Left the screen.
        } catch {
            if elements.isEmpty {
                errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            }
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
            sortOrder: current.sortOrder + 1
        )

        elements.insert(element, at: index + 1)
        renumber(from: index + 1)
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
        renumber(from: max(0, index - 1))

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
        renumber(from: 0)
        Haptics.impact()
        scheduleFlush(reorder: true)
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

    /// Rewrites `sortOrder` so it stays dense and gap-free after an edit.
    private func renumber(from start: Int) {
        for index in start..<elements.count where elements[index].sortOrder != index {
            elements[index].sortOrder = index
            let id = elements[index].id
            if pendingInserts[id] != nil {
                pendingInserts[id]?.sortOrder = index
            } else {
                var patch = pendingPatches[id] ?? ScriptElementPatch()
                patch.sortOrder = index
                pendingPatches[id] = patch
            }
        }
    }

    // MARK: - Saving

    private func scheduleFlush(reorder: Bool = false) {
        saveState = .pending
        Task { await LocalCache.shared.save(elements, for: LocalCache.Key.elements(scriptID)) }

        flushTask?.cancel()
        let delay = AppSettings.shared.autosaveDelay(
            isExpensive: NetworkMonitor.shared.shouldConserveData
        )

        flushTask = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            await self?.flush(reorder: reorder)
        }
    }

    /// Pushes everything queued. Safe to call repeatedly.
    func flush(reorder: Bool = false) async {
        guard !pendingPatches.isEmpty || !pendingInserts.isEmpty || !pendingDeletes.isEmpty || reorder
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
        pendingInserts.removeAll()
        pendingPatches.removeAll()
        pendingDeletes.removeAll()

        do {
            // Order matters: create, then edit, then remove.
            for element in inserts.values.sorted(by: { $0.sortOrder < $1.sortOrder }) {
                try await ScriptService.insert(element, createdBy: ownerID)
            }
            for (id, patch) in patches {
                try await ScriptService.update(id: id, patch: patch)
            }
            for id in deletes {
                try await ScriptService.delete(id: id)
            }
            if reorder {
                try await ScriptService.reorder(elements)
            }

            saveState = .saved(Date())
            errorMessage = nil
            await LocalCache.shared.save(elements, for: LocalCache.Key.elements(scriptID))

        } catch is CancellationError {
            // Put the work back so leaving the screen doesn't drop an edit.
            merge(inserts: inserts, patches: patches, deletes: deletes)
            saveState = .pending

        } catch let error as SupabaseError where error.isRetryable || error == .offline {
            merge(inserts: inserts, patches: patches, deletes: deletes)
            await queueEverythingOffline()
            saveState = .queuedOffline(await SyncQueue.shared.count)

        } catch {
            merge(inserts: inserts, patches: patches, deletes: deletes)
            let message = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            saveState = .failed(message)
            Haptics.error()
        }
    }

    private func merge(
        inserts: [String: ScriptElement],
        patches: [String: ScriptElementPatch],
        deletes: Set<String>
    ) {
        pendingInserts.merge(inserts) { current, _ in current }
        pendingPatches.merge(patches) { current, _ in current }
        pendingDeletes.formUnion(deletes)
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
        await flush()
    }
}
