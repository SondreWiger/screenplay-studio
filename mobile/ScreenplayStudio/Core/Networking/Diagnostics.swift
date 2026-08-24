import Foundation

/// A rolling log of what the network layer actually did.
///
/// Exists because the failure this is meant to catch — "I signed in and nothing
/// appeared" — is invisible from the outside. An empty list looks identical
/// whether the fetch returned zero rows, was rejected by row-level security, or
/// threw while decoding. This records which, and Settings → Diagnostics shows
/// it, so the next report comes with an answer attached instead of a guess.
actor Diagnostics {

    static let shared = Diagnostics()

    struct Entry: Identifiable, Sendable {
        let id = UUID()
        let at: Date
        let label: String
        let detail: String
        let isFailure: Bool
    }

    private(set) var entries: [Entry] = []
    private let limit = 60

    private init() {}

    func record(_ label: String, _ detail: String, isFailure: Bool = false) {
        entries.insert(Entry(at: Date(), label: label, detail: detail, isFailure: isFailure), at: 0)
        if entries.count > limit { entries.removeLast(entries.count - limit) }

        #if DEBUG
        print("[SS] \(isFailure ? "✗" : "·") \(label): \(detail)")
        #endif
    }

    func snapshot() -> [Entry] { entries }

    func clear() { entries.removeAll() }
}
