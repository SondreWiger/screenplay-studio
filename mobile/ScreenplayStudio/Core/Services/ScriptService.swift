import Foundation

/// Reads and writes for `scripts` and `script_elements`.
enum ScriptService {

    // MARK: - Scripts

    static func fetchScripts(projectID: String) async throws -> [Script] {
        let query = PostgrestQuery("scripts")
            .select()
            .eq("project_id", projectID)
            .order("version", ascending: false)
        return try await Supabase.shared.execute(query)
    }

    /// The draft the editor should open: the active one, else the newest.
    ///
    /// Mirrors the web app, which additionally remembers the last script opened
    /// per project — the phone stores that in `AppSettings`.
    static func preferredScript(from scripts: [Script], remembered id: String?) -> Script? {
        if let id, let remembered = scripts.first(where: { $0.id == id }) { return remembered }
        if let active = scripts.first(where: { $0.isActive == true }) { return active }
        return scripts.first
    }

    static func createScript(projectID: String, title: String, ownerID: String) async throws -> Script? {
        struct Payload: Encodable {
            let project_id: String
            let title: String
            let created_by: String
            let is_active: Bool
        }
        let query = try PostgrestQuery("scripts")
            .insert([Payload(project_id: projectID, title: title, created_by: ownerID, is_active: true)])
        let rows: [Script] = try await Supabase.shared.execute(query)
        return rows.first
    }

    // MARK: - Elements

    static func fetchElements(scriptID: String) async throws -> [ScriptElement] {
        let query = PostgrestQuery("script_elements")
            .select()
            .eq("script_id", scriptID)
            .order("sort_order")
        return try await Supabase.shared.execute(query)
    }

    static func insert(_ element: ScriptElement, createdBy: String?) async throws {
        let payload = [ScriptElementInsert(element: element, createdBy: createdBy)]
        let query = try PostgrestQuery("script_elements").insert(payload, returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    /// Queued variant used when the write happens offline.
    static func queueInsert(_ element: ScriptElement, createdBy: String?) async {
        let payload = [ScriptElementInsert(element: element, createdBy: createdBy)]
        guard let data = try? JSONEncoder.supabase.encode(payload) else { return }
        await SyncQueue.shared.enqueue(
            PendingMutation(table: "script_elements", kind: .insert, payload: data)
        )
    }

    static func update(id: String, patch: ScriptElementPatch) async throws {
        let query = try PostgrestQuery("script_elements")
            .eq("id", id)
            .update(patch, returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func queueUpdate(id: String, patch: ScriptElementPatch) async {
        guard let data = try? JSONEncoder.supabase.encode(patch) else { return }
        await SyncQueue.shared.enqueue(
            PendingMutation(
                table: "script_elements",
                kind: .update,
                matchColumn: "id",
                matchValue: id,
                payload: data
            )
        )
    }

    static func delete(id: String) async throws {
        let query = PostgrestQuery("script_elements").eq("id", id).delete()
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func queueDelete(id: String) async {
        await SyncQueue.shared.enqueue(
            PendingMutation(table: "script_elements", kind: .delete, matchColumn: "id", matchValue: id)
        )
    }

    /// Rewrites `sort_order` for a set of elements after a move.
    ///
    /// Sent as one upsert rather than N patches — reordering a long script over
    /// a cellular connection otherwise takes a visible pause.
    static func reorder(_ elements: [ScriptElement]) async throws {
        struct OrderPatch: Encodable {
            let id: String
            let script_id: String
            let element_type: String
            let content: String
            let sort_order: Int
        }
        let payload = elements.map {
            OrderPatch(
                id: $0.id,
                script_id: $0.scriptID,
                element_type: $0.elementType.rawValue,
                content: $0.content,
                sort_order: $0.sortOrder
            )
        }
        let query = try PostgrestQuery("script_elements")
            .upsert(payload, onConflict: "id", returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }
}
