import Foundation

/// A composable description of a PostgREST request.
///
/// Value-typed and chainable so services read close to the JavaScript client the
/// web app uses:
///
///     PostgrestQuery("scenes")
///         .select()
///         .eq("project_id", projectID)
///         .order("sort_order")
struct PostgrestQuery {

    enum Method: String {
        case get = "GET"
        case post = "POST"
        case patch = "PATCH"
        case delete = "DELETE"
    }

    let table: String
    private(set) var method: Method = .get
    private(set) var queryItems: [URLQueryItem] = []
    private(set) var body: Data?
    private(set) var preferences: [String] = []
    private(set) var rangeHeader: String?

    init(_ table: String) {
        self.table = table
    }

    // MARK: - Projection

    func select(_ columns: String = "*") -> Self {
        var copy = self
        copy.queryItems.append(URLQueryItem(name: "select", value: columns))
        return copy
    }

    // MARK: - Filters

    func eq(_ column: String, _ value: String) -> Self {
        filter(column, "eq.\(value)")
    }

    func eq(_ column: String, _ value: Bool) -> Self {
        filter(column, "eq.\(value)")
    }

    func eq(_ column: String, _ value: Int) -> Self {
        filter(column, "eq.\(value)")
    }

    func neq(_ column: String, _ value: String) -> Self {
        filter(column, "neq.\(value)")
    }

    func isNull(_ column: String) -> Self {
        filter(column, "is.null")
    }

    func notNull(_ column: String) -> Self {
        filter(column, "not.is.null")
    }

    func gte(_ column: String, _ value: String) -> Self {
        filter(column, "gte.\(value)")
    }

    func lte(_ column: String, _ value: String) -> Self {
        filter(column, "lte.\(value)")
    }

    /// `column IN (a, b, c)`. Values are quoted so commas inside them survive.
    func `in`(_ column: String, _ values: [String]) -> Self {
        guard !values.isEmpty else { return filter(column, "in.()") }
        let list = values
            .map { "\"\($0.replacingOccurrences(of: "\"", with: "\\\""))\"" }
            .joined(separator: ",")
        return filter(column, "in.(\(list))")
    }

    /// Case-insensitive substring match, used by the search fields.
    func ilike(_ column: String, contains term: String) -> Self {
        let escaped = term
            .replacingOccurrences(of: "%", with: "\\%")
            .replacingOccurrences(of: "_", with: "\\_")
        return filter(column, "ilike.*\(escaped)*")
    }

    /// `or=(a.eq.1,b.eq.2)` — raw because the shapes vary too much to wrap.
    func or(_ expression: String) -> Self {
        var copy = self
        copy.queryItems.append(URLQueryItem(name: "or", value: "(\(expression))"))
        return copy
    }

    private func filter(_ column: String, _ expression: String) -> Self {
        var copy = self
        copy.queryItems.append(URLQueryItem(name: column, value: expression))
        return copy
    }

    // MARK: - Ordering and paging

    func order(_ column: String, ascending: Bool = true, nullsFirst: Bool = false) -> Self {
        var copy = self
        let direction = ascending ? "asc" : "desc"
        let nulls = nullsFirst ? "nullsfirst" : "nullslast"
        copy.queryItems.append(URLQueryItem(name: "order", value: "\(column).\(direction).\(nulls)"))
        return copy
    }

    func limit(_ count: Int) -> Self {
        var copy = self
        copy.queryItems.append(URLQueryItem(name: "limit", value: String(count)))
        return copy
    }

    /// Inclusive row range, mapped to the `Range` header so PostgREST also
    /// reports the total count.
    func range(from: Int, to: Int) -> Self {
        var copy = self
        copy.rangeHeader = "\(from)-\(to)"
        return copy
    }

    // MARK: - Mutations

    func insert<T: Encodable>(_ values: T, returning: Bool = true) throws -> Self {
        var copy = self
        copy.method = .post
        copy.body = try JSONEncoder.supabase.encode(values)
        copy.preferences.append(returning ? "return=representation" : "return=minimal")
        return copy
    }

    /// Insert-or-update on a conflicting unique column.
    func upsert<T: Encodable>(_ values: T, onConflict: String? = nil, returning: Bool = true) throws -> Self {
        var copy = try insert(values, returning: returning)
        copy.preferences.append("resolution=merge-duplicates")
        if let onConflict {
            copy.queryItems.append(URLQueryItem(name: "on_conflict", value: onConflict))
        }
        return copy
    }

    func update<T: Encodable>(_ values: T, returning: Bool = true) throws -> Self {
        var copy = self
        copy.method = .patch
        copy.body = try JSONEncoder.supabase.encode(values)
        copy.preferences.append(returning ? "return=representation" : "return=minimal")
        return copy
    }

    func delete(returning: Bool = false) -> Self {
        var copy = self
        copy.method = .delete
        copy.preferences.append(returning ? "return=representation" : "return=minimal")
        return copy
    }

    // MARK: - Low-level mutators
    //
    // Used by the offline queue, which replays a mutation from raw bytes it
    // captured earlier and so cannot go through the generic `Encodable` paths.

    mutating func setMethod(_ value: Method) { method = value }
    mutating func setBody(_ value: Data?) { body = value }
    mutating func addPreference(_ value: String) { preferences.append(value) }
}
