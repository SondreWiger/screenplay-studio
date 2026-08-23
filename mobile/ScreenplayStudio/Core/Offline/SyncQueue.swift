import Foundation

/// A write made while offline, replayed once connectivity returns.
struct PendingMutation: Codable, Identifiable, Equatable {

    enum Kind: String, Codable {
        case insert, update, upsert, delete
    }

    let id: String
    let createdAt: Date
    let table: String
    let kind: Kind
    /// Filter applied to update/delete, e.g. `id` = `<uuid>`.
    let matchColumn: String?
    let matchValue: String?
    /// Encoded row (insert/upsert) or patch (update).
    let payload: Data?
    var attempts: Int

    init(
        table: String,
        kind: Kind,
        matchColumn: String? = nil,
        matchValue: String? = nil,
        payload: Data? = nil
    ) {
        self.id = UUID().uuidString
        self.createdAt = Date()
        self.table = table
        self.kind = kind
        self.matchColumn = matchColumn
        self.matchValue = matchValue
        self.payload = payload
        self.attempts = 0
    }
}

/// Durable FIFO queue of offline writes.
///
/// Ordering matters — an element's insert has to land before the patch that
/// edits it — so the queue drains strictly in order and stops at the first
/// failure rather than skipping ahead.
actor SyncQueue {

    static let shared = SyncQueue()

    private var pending: [PendingMutation] = []
    private let storeURL: URL
    private var isDraining = false

    /// After this many failed attempts a mutation is dropped, so one poisoned
    /// write can't wedge the queue forever.
    private let maxAttempts = 5

    private init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = base.appendingPathComponent("ScreenplayStudio", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        storeURL = directory.appendingPathComponent("pending-mutations.json")

        if let data = try? Data(contentsOf: storeURL),
           let decoded = try? JSONDecoder().decode([PendingMutation].self, from: data) {
            pending = decoded
        }
    }

    var count: Int { pending.count }
    var hasPending: Bool { !pending.isEmpty }

    func enqueue(_ mutation: PendingMutation) {
        pending.append(mutation)
        persist()
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(pending) else { return }
        try? data.write(to: storeURL, options: .atomic)
    }

    /// Replays queued writes oldest-first. Returns how many succeeded.
    @discardableResult
    func drain() async -> Int {
        guard !isDraining, !pending.isEmpty else { return 0 }
        isDraining = true
        defer { isDraining = false }

        var succeeded = 0

        while let next = pending.first {
            do {
                try await apply(next)
                pending.removeFirst()
                succeeded += 1
                persist()
            } catch is CancellationError {
                break
            } catch let error as SupabaseError where error.isRetryable {
                // Still offline or the server is unhappy — leave the queue intact
                // and try again on the next connectivity change.
                break
            } catch {
                // A non-retryable rejection (row deleted server-side, RLS denial).
                // Count attempts so it eventually stops blocking the queue.
                pending[0].attempts += 1
                if pending[0].attempts >= maxAttempts {
                    pending.removeFirst()
                }
                persist()
                if pending.first == next { break }
            }
        }

        return succeeded
    }

    private func apply(_ mutation: PendingMutation) async throws {
        var query = PostgrestQuery(mutation.table)

        if let column = mutation.matchColumn, let value = mutation.matchValue {
            query = query.eq(column, value)
        }

        switch mutation.kind {
        case .insert, .upsert:
            guard let payload = mutation.payload else { return }
            query = query.rawBody(payload, method: .post, returning: false)
            if mutation.kind == .upsert {
                query = query.mergingDuplicates()
            }
        case .update:
            guard let payload = mutation.payload else { return }
            query = query.rawBody(payload, method: .patch, returning: false)
        case .delete:
            query = query.delete()
        }

        try await Supabase.shared.executeIgnoringResult(query)
    }

    func clear() {
        pending.removeAll()
        persist()
    }
}

// MARK: - Replay support

extension PostgrestQuery {
    /// Rebuilds a mutation from bytes captured when it was queued, without
    /// needing the original `Encodable` type.
    func rawBody(_ data: Data, method: Method, returning: Bool) -> Self {
        var copy = self
        copy.setMethod(method)
        copy.setBody(data)
        copy.addPreference(returning ? "return=representation" : "return=minimal")
        return copy
    }

    func mergingDuplicates() -> Self {
        var copy = self
        copy.addPreference("resolution=merge-duplicates")
        return copy
    }
}
