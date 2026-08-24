import Foundation

// MARK: - Gear Item

/// Maps to the `shoot_gear` table. Tracks individual pieces of production
/// equipment — cameras, lenses, lights, grip, etc.
struct GearItem: Codable, Identifiable, Hashable {
    let id: String
    var projectID: String
    var name: String
    var category: GearCategory
    var quantity: Int
    var unit: String
    var ownership: GearOwnership
    var vendor: String?
    var dailyRate: Double?
    var totalCost: Double?
    var shootDayID: String?
    var notes: String?
    var status: GearStatus
    var createdBy: String?
    var createdAt: Date?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name, category, quantity, unit, ownership, vendor, notes, status
        case projectID = "project_id"
        case dailyRate = "daily_rate"
        case totalCost = "total_cost"
        case shootDayID = "shoot_day_id"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Insert payload — only the columns the server accepts.
struct NewGearItem: Encodable {
    var projectID: String
    var name: String
    var category: String
    var quantity: Int
    var unit: String
    var ownership: String
    var vendor: String?
    var dailyRate: Double?
    var totalCost: Double?
    var notes: String?
    var status: String
    var createdBy: String?

    enum CodingKeys: String, CodingKey {
        case name, category, quantity, unit, ownership, vendor, notes, status
        case projectID = "project_id"
        case dailyRate = "daily_rate"
        case totalCost = "total_cost"
        case createdBy = "created_by"
    }
}

// MARK: - Gear Checkout

/// Tracks who took a piece of gear from video village — the core of the
/// checkout system. Each row represents one checkout event; `returnedAt`
/// being nil means the gear is still out.
struct GearCheckout: Codable, Identifiable, Hashable {
    let id: String
    var gearID: String
    var projectID: String
    var checkedOutBy: String
    var checkedOutByName: String
    var checkedOutAt: Date
    var returnedAt: Date?
    var notes: String?

    enum CodingKeys: String, CodingKey {
        case id, notes
        case gearID = "gear_id"
        case projectID = "project_id"
        case checkedOutBy = "checked_out_by"
        case checkedOutByName = "checked_out_by_name"
        case checkedOutAt = "checked_out_at"
        case returnedAt = "returned_at"
    }

    var isActive: Bool { returnedAt == nil }
}

struct NewGearCheckout: Encodable {
    var gearID: String
    var projectID: String
    var checkedOutBy: String
    var checkedOutByName: String
    var notes: String?

    enum CodingKeys: String, CodingKey {
        case notes
        case gearID = "gear_id"
        case projectID = "project_id"
        case checkedOutBy = "checked_out_by"
        case checkedOutByName = "checked_out_by_name"
    }
}
