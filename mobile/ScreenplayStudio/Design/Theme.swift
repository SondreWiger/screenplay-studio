import SwiftUI

/// Design tokens mirrored from the web app's CSS custom properties
/// (`src/app/globals.css`) so the phone app and the web app read as one product.
enum Theme {

    // MARK: - Surface ramp (--surface-*)

    enum Surface {
        static let s50  = Color(hex: 0xF4F4FC)
        static let s100 = Color(hex: 0xEAEAF5)
        static let s200 = Color(hex: 0xD4D4E8)
        static let s300 = Color(hex: 0xB0B0CC)
        static let s400 = Color(hex: 0x8888AA)
        static let s500 = Color(hex: 0x5C5C7A)
        static let s600 = Color(hex: 0x3A3A56)
        static let s700 = Color(hex: 0x24243A)
        static let s800 = Color(hex: 0x181828)
        static let s900 = Color(hex: 0x0F0F1C)
        static let s950 = Color(hex: 0x070710)
    }

    // MARK: - Brand ramp (--brand-*, default "brand" accent)

    enum Brand {
        static let b300 = Color(hex: 0xFCBA64)
        static let b400 = Color(hex: 0xFF8C46)
        static let b500 = Color(hex: 0xFF5F1F)
        static let b600 = Color(hex: 0xE54E15)
        static let b700 = Color(hex: 0xCC4312)
    }

    // MARK: - Semantic roles

    /// App background — the deepest surface.
    static let background = Surface.s950
    /// Raised cards and rows.
    static let card = Surface.s900
    /// Cards raised above other cards (sheets, popovers).
    static let elevated = Surface.s800
    /// Hairlines and dividers.
    static let border = Color.white.opacity(0.08)
    /// A stronger border for focused / selected states.
    static let borderStrong = Color.white.opacity(0.16)

    static let accent = Brand.b500
    static let accentSoft = Brand.b500.opacity(0.16)

    static let textPrimary = Color(hex: 0xF4F4FC)
    static let textSecondary = Color(hex: 0xB0B0CC)
    static let textTertiary = Color(hex: 0x8888AA)

    static let success = Color(hex: 0x10B981)
    static let warning = Color(hex: 0xF59E0B)
    static let danger  = Color(hex: 0xEF4444)

    // MARK: - Metrics

    /// Apple's HIG minimum tappable size. Every interactive control in the app
    /// is padded out to at least this.
    static let minTouchTarget: CGFloat = 44
    static let cornerRadius: CGFloat = 14
    static let cornerRadiusSmall: CGFloat = 10
    static let rowSpacing: CGFloat = 10
    static let screenPadding: CGFloat = 16
}

// MARK: - Colour helpers

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red:   Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >>  8) & 0xFF) / 255,
            blue:  Double( hex        & 0xFF) / 255,
            opacity: opacity
        )
    }

    /// Parses the `#rrggbb` strings stored in the database (character colours,
    /// schedule event colours). Falls back to the brand accent when malformed.
    init(webHex: String?) {
        guard var s = webHex?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty else {
            self = Theme.accent
            return
        }
        if s.hasPrefix("#") { s.removeFirst() }
        if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
        guard s.count == 6, let value = UInt32(s, radix: 16) else {
            self = Theme.accent
            return
        }
        self.init(hex: value)
    }

    /// A readable foreground colour for text drawn on top of this colour.
    var readableForeground: Color {
        #if canImport(UIKit)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a)
        // Rec. 709 relative luminance.
        let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        return luminance > 0.6 ? Theme.Surface.s950 : .white
        #else
        return .white
        #endif
    }
}
