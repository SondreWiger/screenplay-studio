import Foundation

/// Decodes an enum column, tolerating values this build of the app does not
/// know about.
///
/// Without this, a single row carrying a status, shot type or time-of-day added
/// to the database after the app shipped throws during decoding — and because
/// `JSONDecoder` decodes the whole array or nothing, one unfamiliar row blanks
/// an entire screen. That failure is silent and looks exactly like "the app
/// didn't sync".
///
/// The database is the source of truth and it changes on its own schedule, so
/// the app treats an unrecognised value as "no value" and carries on.
@propertyWrapper
struct Lenient<T>: Codable, Hashable
where T: RawRepresentable & Codable & Hashable, T.RawValue: Codable & Hashable {

    var wrappedValue: T?
    /// Kept so an unrecognised value survives a round-trip instead of being
    /// silently rewritten to null the next time the row is saved.
    private var unknownRawValue: T.RawValue?

    init(wrappedValue: T?) {
        self.wrappedValue = wrappedValue
        self.unknownRawValue = nil
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            wrappedValue = nil
            unknownRawValue = nil
            return
        }
        guard let raw = try? container.decode(T.RawValue.self) else {
            wrappedValue = nil
            unknownRawValue = nil
            return
        }
        if let value = T(rawValue: raw) {
            wrappedValue = value
            unknownRawValue = nil
        } else {
            wrappedValue = nil
            unknownRawValue = raw
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let wrappedValue {
            try container.encode(wrappedValue.rawValue)
        } else if let unknownRawValue {
            try container.encode(unknownRawValue)
        } else {
            try container.encodeNil()
        }
    }
}

extension KeyedDecodingContainer {
    /// Makes a `@Lenient` property behave as optional: a missing key decodes to
    /// "no value" rather than throwing `keyNotFound`.
    func decode<T>(_ type: Lenient<T>.Type, forKey key: Key) throws -> Lenient<T> {
        try decodeIfPresent(type, forKey: key) ?? Lenient(wrappedValue: nil)
    }
}
