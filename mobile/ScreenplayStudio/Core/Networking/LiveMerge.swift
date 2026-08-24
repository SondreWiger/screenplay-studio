import Foundation

/// Applies realtime changes to a local array.
///
/// The rule everywhere: the server is right about rows the user is not
/// currently editing, and the user is right about the one they are. Callers
/// that have unsent local work pass it in via `skip` so a remote update can't
/// overwrite something still being typed.
enum LiveMerge {

    @discardableResult
    static func apply<T: Decodable & Identifiable>(
        _ change: RealtimeChange,
        to rows: inout [T],
        skip: (String) -> Bool = { _ in false },
        sort: ((T, T) -> Bool)? = nil
    ) -> Bool where T.ID == String {

        switch change.kind {
        case .insert:
            guard let row = change.decoded(T.self) else { return false }
            guard !rows.contains(where: { $0.id == row.id }) else { return false }
            rows.append(row)
            if let sort { rows.sort(by: sort) }
            return true

        case .update:
            guard let row = change.decoded(T.self) else { return false }
            guard !skip(row.id) else { return false }
            if let index = rows.firstIndex(where: { $0.id == row.id }) {
                rows[index] = row
            } else {
                // An update for a row we never had — usually it just became
                // visible to this user. Treat it as an insert.
                rows.append(row)
            }
            if let sort { rows.sort(by: sort) }
            return true

        case .delete:
            guard let id = change.recordID, !skip(id) else { return false }
            let before = rows.count
            rows.removeAll { $0.id == id }
            return rows.count != before
        }
    }
}
