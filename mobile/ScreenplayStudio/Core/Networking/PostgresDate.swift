import Foundation

/// PostgREST hands back `timestamptz` in a few shapes depending on whether the
/// column has fractional seconds and how the zone is written
/// (`+00:00`, `+00`, `Z`). `ISO8601DateFormatter` alone rejects half of them,
/// so decoding walks a small ladder of formats.
enum PostgresDate {

    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let withoutFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    /// For bare `date` columns (`shoot_day`, etc.) with no time component.
    private static let dateOnly: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func parse(_ raw: String) -> Date? {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty else { return nil }

        // Normalise `+00` / `-05` shorthand zones to `+00:00`.
        if let zoneStart = s.range(of: "[+-]\\d{2}$", options: .regularExpression) {
            s += ":00"
            _ = zoneStart
        }
        // A space between date and time instead of `T`.
        if s.contains(" "), !s.contains("T") {
            s = s.replacingOccurrences(of: " ", with: "T")
        }
        // No zone at all — Postgres means UTC.
        if !s.contains("Z"), s.range(of: "[+-]\\d{2}:\\d{2}$", options: .regularExpression) == nil,
           s.contains("T") {
            s += "Z"
        }

        if let d = withFraction.date(from: s) { return d }
        if let d = withoutFraction.date(from: s) { return d }
        return dateOnly.date(from: raw)
    }

    static func string(from date: Date) -> String {
        withFraction.string(from: date)
    }

    static func dateOnlyString(from date: Date) -> String {
        dateOnly.string(from: date)
    }

    // MARK: - Coder strategies

    static let decodingStrategy = JSONDecoder.DateDecodingStrategy.custom { decoder in
        let raw = try decoder.singleValueContainer().decode(String.self)
        guard let date = parse(raw) else {
            throw DecodingError.dataCorruptedError(
                in: try decoder.singleValueContainer(),
                debugDescription: "Unparseable timestamp: \(raw)"
            )
        }
        return date
    }

    static let encodingStrategy = JSONEncoder.DateEncodingStrategy.custom { date, encoder in
        var c = encoder.singleValueContainer()
        try c.encode(string(from: date))
    }
}

extension JSONDecoder {
    static let supabase: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = PostgresDate.decodingStrategy
        return d
    }()
}

extension JSONEncoder {
    static let supabase: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = PostgresDate.encodingStrategy
        return e
    }()
}
