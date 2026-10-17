import SwiftUI
import UIKit

/// Design tokens mirrored from the web app's CSS custom properties
/// (`src/app/globals.css`) so the iPhone/iPad app and the web app read as one
/// product.
///
/// Every semantic colour is dynamic: it resolves against the current trait
/// collection, so the app follows Light, Dark or the system setting (Settings
/// → Appearance) without any view knowing which one is showing.
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
    static let background = Color.dynamic(light: 0xF2F2F7, dark: 0x070710)
    /// Raised cards and rows.
    static let card = Color.dynamic(light: 0xFFFFFF, dark: 0x0F0F1C)
    /// Cards raised above other cards (sheets, fields, popovers).
    static let elevated = Color.dynamic(light: 0xEBEBF0, dark: 0x181828)
    /// Hairlines and dividers.
    static let border = Color.dynamic(light: 0x0F0F1C, dark: 0xFFFFFF, lightOpacity: 0.09, darkOpacity: 0.08)
    /// A stronger border for focused / selected states.
    static let borderStrong = Color.dynamic(light: 0x0F0F1C, dark: 0xFFFFFF, lightOpacity: 0.18, darkOpacity: 0.16)
    /// A faint fill for tracks, shimmer and pressed states.
    static let fill = Color.dynamic(light: 0x0F0F1C, dark: 0xFFFFFF, lightOpacity: 0.06, darkOpacity: 0.08)

    /// The user's accent (Settings → Appearance). Read at render time; the root
    /// view rebuilds when it changes.
    static var accent: Color { AccentChoice.current.color }
    static var accentSoft: Color { accent.opacity(0.16) }

    static let textPrimary = Color.dynamic(light: 0x0F0F1C, dark: 0xF4F4FC)
    static let textSecondary = Color.dynamic(light: 0x45455E, dark: 0xB0B0CC)
    static let textTertiary = Color.dynamic(light: 0x6B6B85, dark: 0x8888AA)

    // Darker in light mode so they still read as text on white.
    static let success = Color.dynamic(light: 0x047857, dark: 0x10B981)
    static let warning = Color.dynamic(light: 0xB45309, dark: 0xF59E0B)
    static let danger  = Color.dynamic(light: 0xDC2626, dark: 0xEF4444)

    // MARK: - Metrics

    /// Apple's HIG minimum tappable size. Every interactive control in the app
    /// is padded out to at least this.
    static let minTouchTarget: CGFloat = 44
    static let cornerRadius: CGFloat = 14
    static let cornerRadiusSmall: CGFloat = 10
    static let rowSpacing: CGFloat = 10
    static let screenPadding: CGFloat = 16
    /// Widest a column of cards gets on iPad before it's centred, so lines of
    /// text stay a readable length.
    static let readableWidth: CGFloat = 820
}

// MARK: - Appearance choices

/// Light, Dark, or follow the system. Stored in Settings → Appearance.
enum AppearanceMode: String, CaseIterable, Identifiable {
    case system, light, dark

    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: return "System"
        case .light:  return "Light"
        case .dark:   return "Dark"
        }
    }

    var symbol: String {
        switch self {
        case .system: return "circle.lefthalf.filled"
        case .light:  return "sun.max"
        case .dark:   return "moon"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light:  return .light
        case .dark:   return .dark
        }
    }
}

/// The accent colour, chosen in Settings → Appearance. Each has a light-mode
/// shade dark enough to keep 4.5:1 contrast as text on white, and a dark-mode
/// shade that still carries white button labels.
enum AccentChoice: String, CaseIterable, Identifiable {
    case ember, crimson, rose, violet, indigo, ocean, teal, forest, gold, graphite

    static let storageKey = "ss.settings.accent"

    var id: String { rawValue }

    /// Read straight from defaults so `Theme.accent` works from any context.
    static var current: AccentChoice {
        AccentChoice(rawValue: UserDefaults.standard.string(forKey: storageKey) ?? "") ?? .ember
    }

    var label: String {
        switch self {
        case .ember:    return "Ember"
        case .crimson:  return "Crimson"
        case .rose:     return "Rose"
        case .violet:   return "Violet"
        case .indigo:   return "Indigo"
        case .ocean:    return "Ocean"
        case .teal:     return "Teal"
        case .forest:   return "Forest"
        case .gold:     return "Gold"
        case .graphite: return "Graphite"
        }
    }

    private var hexes: (light: UInt32, dark: UInt32) {
        switch self {
        case .ember:    return (0xE54E15, 0xFF5F1F)
        case .crimson:  return (0xC81E3A, 0xF43F5E)
        case .rose:     return (0xBE185D, 0xEC4899)
        case .violet:   return (0x7C3AED, 0x8B5CF6)
        case .indigo:   return (0x4338CA, 0x6366F1)
        case .ocean:    return (0x1D4ED8, 0x3B82F6)
        case .teal:     return (0x0F766E, 0x14B8A6)
        case .forest:   return (0x15803D, 0x22C55E)
        case .gold:     return (0xA16207, 0xD97706)
        case .graphite: return (0x3F3F55, 0x7C7C96)
        }
    }

    var color: Color { Color.dynamic(light: hexes.light, dark: hexes.dark) }
}

// MARK: - Colour helpers

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(
            red:   CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >>  8) & 0xFF) / 255,
            blue:  CGFloat( hex        & 0xFF) / 255,
            alpha: alpha
        )
    }
}

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

    /// A colour that resolves differently in light and dark appearance.
    static func dynamic(light: UInt32, dark: UInt32, lightOpacity: CGFloat = 1, darkOpacity: CGFloat = 1) -> Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(hex: dark, alpha: darkOpacity)
                : UIColor(hex: light, alpha: lightOpacity)
        })
    }

    /// Parses the `#rrggbb` strings stored in the database (character colours,
    /// schedule event colours). Falls back to the accent when malformed.
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
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a)
        // Rec. 709 relative luminance.
        let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        return luminance > 0.6 ? Theme.Surface.s950 : .white
    }
}
