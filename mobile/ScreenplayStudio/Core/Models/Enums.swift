import SwiftUI

/// Mirrors of the Postgres enum types in `supabase/FULL.sql`.
///
/// Each conforms to `Decodable` through a failable raw value plus an `unknown`
/// bucket, so a value added to the database later shows up as a readable label
/// instead of failing the whole decode and blanking a screen.

// MARK: - project_status

enum ProjectStatus: String, Codable, CaseIterable, Identifiable {
    case development
    case preProduction = "pre_production"
    case production
    case postProduction = "post_production"
    case completed
    case archived

    var id: String { rawValue }

    var label: String {
        switch self {
        case .development:    return "Development"
        case .preProduction:  return "Pre-production"
        case .production:     return "Production"
        case .postProduction: return "Post-production"
        case .completed:      return "Completed"
        case .archived:       return "Archived"
        }
    }

    var tint: Color {
        switch self {
        case .development:    return Theme.Brand.b400
        case .preProduction:  return Color(hex: 0x8B5CF6)
        case .production:     return Theme.success
        case .postProduction: return Color(hex: 0x06B6D4)
        case .completed:      return Color(hex: 0x22C55E)
        case .archived:       return Theme.textTertiary
        }
    }

    var symbol: String {
        switch self {
        case .development:    return "lightbulb"
        case .preProduction:  return "calendar.badge.clock"
        case .production:     return "video"
        case .postProduction: return "scissors"
        case .completed:      return "checkmark.seal"
        case .archived:       return "archivebox"
        }
    }
}

// MARK: - project format (a plain text column, not an enum, in the schema)

enum ProjectFormat: String, Codable, CaseIterable, Identifiable {
    case feature
    case short
    case series
    case pilot
    case webseries

    var id: String { rawValue }

    var label: String {
        switch self {
        case .feature:   return "Feature"
        case .short:     return "Short"
        case .series:    return "Series"
        case .pilot:     return "Pilot"
        case .webseries: return "Web series"
        }
    }
}

// MARK: - scene_location_type

enum SceneLocationType: String, Codable, CaseIterable, Identifiable {
    case interior = "INT"
    case exterior = "EXT"
    case intExt = "INT_EXT"
    case extInt = "EXT_INT"

    var id: String { rawValue }

    /// How it reads inside a slug line.
    var label: String {
        switch self {
        case .interior: return "INT."
        case .exterior: return "EXT."
        case .intExt:   return "INT./EXT."
        case .extInt:   return "EXT./INT."
        }
    }

    var shortLabel: String {
        switch self {
        case .interior: return "INT"
        case .exterior: return "EXT"
        case .intExt:   return "I/E"
        case .extInt:   return "E/I"
        }
    }

    var symbol: String {
        switch self {
        case .interior: return "house"
        case .exterior: return "tree"
        case .intExt, .extInt: return "door.left.hand.open"
        }
    }
}

// MARK: - scene_time

enum SceneTime: String, Codable, CaseIterable, Identifiable {
    case day = "DAY"
    case night = "NIGHT"
    case dawn = "DAWN"
    case dusk = "DUSK"
    case morning = "MORNING"
    case afternoon = "AFTERNOON"
    case evening = "EVENING"
    case continuous = "CONTINUOUS"
    case later = "LATER"
    case momentsLater = "MOMENTS_LATER"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .momentsLater: return "MOMENTS LATER"
        default: return rawValue
        }
    }

    /// Day/night split drives scheduling colour-coding.
    var isNight: Bool {
        switch self {
        case .night, .dusk, .evening: return true
        default: return false
        }
    }

    var symbol: String {
        switch self {
        case .day, .morning, .afternoon: return "sun.max"
        case .night: return "moon.stars"
        case .dawn: return "sunrise"
        case .dusk, .evening: return "sunset"
        case .continuous, .later, .momentsLater: return "arrow.right.circle"
        }
    }
}

// MARK: - shot_type

enum ShotType: String, Codable, CaseIterable, Identifiable {
    case wide, full
    case mediumWide = "medium_wide"
    case medium
    case mediumClose = "medium_close"
    case closeUp = "close_up"
    case extremeClose = "extreme_close"
    case overShoulder = "over_shoulder"
    case twoShot = "two_shot"
    case pov, aerial, insert, cutaway, establishing, tracking, dolly
    case crane, steadicam, handheld, `static`
    case dutchAngle = "dutch_angle"

    var id: String { rawValue }

    /// The abbreviation an AD would actually write on a shot list.
    var abbreviation: String {
        switch self {
        case .wide: return "WS"
        case .full: return "FS"
        case .mediumWide: return "MWS"
        case .medium: return "MS"
        case .mediumClose: return "MCU"
        case .closeUp: return "CU"
        case .extremeClose: return "ECU"
        case .overShoulder: return "OTS"
        case .twoShot: return "2S"
        case .pov: return "POV"
        case .aerial: return "AER"
        case .insert: return "INS"
        case .cutaway: return "CA"
        case .establishing: return "EST"
        case .tracking: return "TRK"
        case .dolly: return "DOL"
        case .crane: return "CRN"
        case .steadicam: return "STE"
        case .handheld: return "HH"
        case .static: return "STA"
        case .dutchAngle: return "DUT"
        }
    }

    var label: String {
        switch self {
        case .wide: return "Wide"
        case .full: return "Full"
        case .mediumWide: return "Medium wide"
        case .medium: return "Medium"
        case .mediumClose: return "Medium close"
        case .closeUp: return "Close-up"
        case .extremeClose: return "Extreme close-up"
        case .overShoulder: return "Over the shoulder"
        case .twoShot: return "Two shot"
        case .pov: return "POV"
        case .aerial: return "Aerial"
        case .insert: return "Insert"
        case .cutaway: return "Cutaway"
        case .establishing: return "Establishing"
        case .tracking: return "Tracking"
        case .dolly: return "Dolly"
        case .crane: return "Crane"
        case .steadicam: return "Steadicam"
        case .handheld: return "Handheld"
        case .static: return "Static"
        case .dutchAngle: return "Dutch angle"
        }
    }
}

// MARK: - shot_movement

enum ShotMovement: String, Codable, CaseIterable, Identifiable {
    case `static`
    case panLeft = "pan_left"
    case panRight = "pan_right"
    case tiltUp = "tilt_up"
    case tiltDown = "tilt_down"
    case dollyIn = "dolly_in"
    case dollyOut = "dolly_out"
    case truckLeft = "truck_left"
    case truckRight = "truck_right"
    case craneUp = "crane_up"
    case craneDown = "crane_down"
    case zoomIn = "zoom_in"
    case zoomOut = "zoom_out"
    case follow, orbit
    case whipPan = "whip_pan"
    case rackFocus = "rack_focus"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .static: return "Static"
        case .panLeft: return "Pan left"
        case .panRight: return "Pan right"
        case .tiltUp: return "Tilt up"
        case .tiltDown: return "Tilt down"
        case .dollyIn: return "Dolly in"
        case .dollyOut: return "Dolly out"
        case .truckLeft: return "Truck left"
        case .truckRight: return "Truck right"
        case .craneUp: return "Crane up"
        case .craneDown: return "Crane down"
        case .zoomIn: return "Zoom in"
        case .zoomOut: return "Zoom out"
        case .follow: return "Follow"
        case .orbit: return "Orbit"
        case .whipPan: return "Whip pan"
        case .rackFocus: return "Rack focus"
        }
    }

    var symbol: String {
        switch self {
        case .static: return "viewfinder"
        case .panLeft: return "arrow.left"
        case .panRight: return "arrow.right"
        case .tiltUp, .craneUp: return "arrow.up"
        case .tiltDown, .craneDown: return "arrow.down"
        case .dollyIn, .zoomIn: return "plus.magnifyingglass"
        case .dollyOut, .zoomOut: return "minus.magnifyingglass"
        case .truckLeft: return "arrow.left.to.line"
        case .truckRight: return "arrow.right.to.line"
        case .follow: return "figure.walk"
        case .orbit: return "arrow.trianglehead.2.clockwise.rotate.90"
        case .whipPan: return "wind"
        case .rackFocus: return "camera.aperture"
        }
    }
}

// MARK: - schedule_event_type

enum ScheduleEventType: String, Codable, CaseIterable, Identifiable {
    case shooting
    case rehearsal
    case locationScout = "location_scout"
    case meeting
    case setup
    case wrap
    case travel
    case `break`
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .shooting:      return "Shooting"
        case .rehearsal:     return "Rehearsal"
        case .locationScout: return "Location scout"
        case .meeting:       return "Meeting"
        case .setup:         return "Setup"
        case .wrap:          return "Wrap"
        case .travel:        return "Travel"
        case .break:         return "Break"
        case .other:         return "Other"
        }
    }

    var symbol: String {
        switch self {
        case .shooting:      return "video"
        case .rehearsal:     return "person.2"
        case .locationScout: return "map"
        case .meeting:       return "bubble.left.and.bubble.right"
        case .setup:         return "wrench.and.screwdriver"
        case .wrap:          return "flag.checkered"
        case .travel:        return "car"
        case .break:         return "cup.and.saucer"
        case .other:         return "calendar"
        }
    }

    var tint: Color {
        switch self {
        case .shooting:      return Theme.Brand.b500
        case .rehearsal:     return Color(hex: 0x8B5CF6)
        case .locationScout: return Color(hex: 0x06B6D4)
        case .meeting:       return Color(hex: 0x3B82F6)
        case .setup:         return Color(hex: 0xF59E0B)
        case .wrap:          return Theme.success
        case .travel:        return Color(hex: 0xEC4899)
        case .break:         return Theme.textTertiary
        case .other:         return Theme.textSecondary
        }
    }
}

// MARK: - revision_color

enum RevisionColor: String, Codable, CaseIterable, Identifiable {
    case white, blue, pink, yellow, green, goldenrod, buff, salmon, cherry, tan

    var id: String { rawValue }

    var label: String { rawValue.capitalized }

    /// The industry-standard revision paper colours.
    var swatch: Color {
        switch self {
        case .white:     return Color(hex: 0xFFFFFF)
        case .blue:      return Color(hex: 0xA8C8E8)
        case .pink:      return Color(hex: 0xF7B8CE)
        case .yellow:    return Color(hex: 0xF5E17A)
        case .green:     return Color(hex: 0xA9DCA9)
        case .goldenrod: return Color(hex: 0xE8C25A)
        case .buff:      return Color(hex: 0xE8DCC0)
        case .salmon:    return Color(hex: 0xF5A98A)
        case .cherry:    return Color(hex: 0xD46A7E)
        case .tan:       return Color(hex: 0xD2B48C)
        }
    }
}

// MARK: - gear_category

enum GearCategory: String, Codable, CaseIterable, Identifiable {
    case camera = "Camera"
    case lenses = "Lenses"
    case lighting = "Lighting"
    case grip = "Grip"
    case sound = "Sound"
    case artDept = "Art Dept"
    case costume = "Costume"
    case hairMakeup = "Hair & Makeup"
    case locations = "Locations"
    case transport = "Transport"
    case postDIT = "Post / DIT"
    case other = "Other"

    var id: String { rawValue }

    var label: String { rawValue }

    var symbol: String {
        switch self {
        case .camera:     return "camera"
        case .lenses:     return "circle.circle"
        case .lighting:   return "lightbulb"
        case .grip:       return "wrench.and.screwdriver"
        case .sound:      return "waveform"
        case .artDept:    return "paintbrush"
        case .costume:    return "tshirt"
        case .hairMakeup: return "scissors"
        case .locations:  return "map"
        case .transport:  return "car"
        case .postDIT:    return "externaldrive"
        case .other:      return "shippingbox"
        }
    }

    var tint: Color {
        switch self {
        case .camera:     return Theme.accent
        case .lenses:     return Color(hex: 0x8B5CF6)
        case .lighting:   return Color(hex: 0xFBBF24)
        case .grip:       return Color(hex: 0x78716C)
        case .sound:      return Color(hex: 0x06B6D4)
        case .artDept:    return Color(hex: 0xEC4899)
        case .costume:    return Color(hex: 0xA78BFA)
        case .hairMakeup: return Color(hex: 0xF472B6)
        case .locations:  return Color(hex: 0x22C55E)
        case .transport:  return Color(hex: 0x3B82F6)
        case .postDIT:    return Color(hex: 0x14B8A6)
        case .other:      return Theme.textTertiary
        }
    }
}

// MARK: - gear_ownership

enum GearOwnership: String, Codable, CaseIterable, Identifiable {
    case owned
    case rented
    case provided
    case tbc

    var id: String { rawValue }

    var label: String {
        switch self {
        case .owned:    return "Owned"
        case .rented:   return "Rented"
        case .provided: return "Provided"
        case .tbc:      return "TBC"
        }
    }

    var tint: Color {
        switch self {
        case .owned:    return Theme.success
        case .rented:   return Color(hex: 0x3B82F6)
        case .provided: return Color(hex: 0x8B5CF6)
        case .tbc:      return Theme.textTertiary
        }
    }
}

// MARK: - gear_status

enum GearStatus: String, Codable, CaseIterable, Identifiable {
    case confirmed
    case pending
    case cancelled

    var id: String { rawValue }

    var label: String {
        switch self {
        case .confirmed: return "Confirmed"
        case .pending:   return "Pending"
        case .cancelled: return "Cancelled"
        }
    }

    var tint: Color {
        switch self {
        case .confirmed: return Theme.success
        case .pending:   return Theme.warning
        case .cancelled: return Theme.danger
        }
    }

    var symbol: String {
        switch self {
        case .confirmed: return "checkmark.circle.fill"
        case .pending:   return "clock"
        case .cancelled: return "xmark.circle.fill"
        }
    }

    var next: GearStatus {
        switch self {
        case .pending:   return .confirmed
        case .confirmed: return .cancelled
        case .cancelled: return .pending
        }
    }
}
