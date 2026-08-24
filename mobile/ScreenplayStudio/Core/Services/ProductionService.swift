import Foundation

/// Reads and writes for the production-planning tables: scenes, shots,
/// characters, schedule and locations.
enum ProductionService {

    // MARK: - Scenes

    static func fetchScenes(projectID: String) async throws -> [ProductionScene] {
        let query = PostgrestQuery("scenes")
            .select()
            .eq("project_id", projectID)
            .order("sort_order")
        return try await Supabase.shared.execute(query)
    }

    static func createScene(
        projectID: String,
        heading: String,
        locationType: SceneLocationType,
        locationName: String?,
        timeOfDay: SceneTime,
        sortOrder: Int,
        ownerID: String?
    ) async throws -> ProductionScene? {
        let payload = [NewScene(
            projectID: projectID,
            scriptID: nil,
            sceneNumber: nil,
            sceneHeading: heading.nonEmpty,
            locationType: locationType.rawValue,
            locationName: locationName?.nonEmpty,
            timeOfDay: timeOfDay.rawValue,
            synopsis: nil,
            sortOrder: sortOrder,
            createdBy: ownerID
        )]
        let query = try PostgrestQuery("scenes").insert(payload)
        let rows: [ProductionScene] = try await Supabase.shared.execute(query)
        return rows.first
    }

    static func setSceneCompleted(id: String, completed: Bool) async throws {
        struct Patch: Encodable {
            let is_completed: Bool
            let updated_at: Date
        }
        let query = try PostgrestQuery("scenes")
            .eq("id", id)
            .update(Patch(is_completed: completed, updated_at: Date()), returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    /// Writes back one breakdown list (props, costumes, vehicles, …).
    static func updateSceneList(id: String, column: String, values: [String]) async throws {
        var body: [String: JSONValue] = [
            column: .array(values.map { .string($0) }),
            "updated_at": .string(PostgresDate.string(from: Date())),
        ]
        let query = try PostgrestQuery("scenes")
            .eq("id", id)
            .update(body, returning: false)
        body.removeAll()
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func updateSceneFields(id: String, fields: [String: JSONValue]) async throws {
        var body = fields
        body["updated_at"] = .string(PostgresDate.string(from: Date()))
        let query = try PostgrestQuery("scenes")
            .eq("id", id)
            .update(body, returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func deleteScene(id: String) async throws {
        let query = PostgrestQuery("scenes").eq("id", id).delete()
        try await Supabase.shared.executeIgnoringResult(query)
    }

    // MARK: - Shots

    static func fetchShots(projectID: String) async throws -> [Shot] {
        let query = PostgrestQuery("shots")
            .select()
            .eq("project_id", projectID)
            .order("sort_order")
        return try await Supabase.shared.execute(query)
    }

    static func createShot(
        projectID: String,
        sceneID: String?,
        shotNumber: String?,
        type: ShotType,
        movement: ShotMovement,
        description: String?,
        lens: String?,
        sortOrder: Int,
        ownerID: String?
    ) async throws -> Shot? {
        let payload = [NewShot(
            projectID: projectID,
            sceneID: sceneID,
            shotNumber: shotNumber?.nonEmpty,
            shotType: type.rawValue,
            shotMovement: movement.rawValue,
            description: description?.nonEmpty,
            lens: lens?.nonEmpty,
            sortOrder: sortOrder,
            createdBy: ownerID
        )]
        let query = try PostgrestQuery("shots").insert(payload)
        let rows: [Shot] = try await Supabase.shared.execute(query)
        return rows.first
    }

    static func setShotCompleted(id: String, completed: Bool) async throws {
        struct Patch: Encodable {
            let is_completed: Bool
            let updated_at: Date
        }
        let query = try PostgrestQuery("shots")
            .eq("id", id)
            .update(Patch(is_completed: completed, updated_at: Date()), returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func setTakesCompleted(id: String, takes: Int) async throws {
        struct Patch: Encodable {
            let takes_completed: Int
            let updated_at: Date
        }
        let query = try PostgrestQuery("shots")
            .eq("id", id)
            .update(Patch(takes_completed: max(0, takes), updated_at: Date()), returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func updateShotFields(id: String, fields: [String: JSONValue]) async throws {
        var body = fields
        body["updated_at"] = .string(PostgresDate.string(from: Date()))
        let query = try PostgrestQuery("shots")
            .eq("id", id)
            .update(body, returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func deleteShot(id: String) async throws {
        let query = PostgrestQuery("shots").eq("id", id).delete()
        try await Supabase.shared.executeIgnoringResult(query)
    }

    // MARK: - Characters

    static func fetchCharacters(projectID: String) async throws -> [ProjectCharacter] {
        let query = PostgrestQuery("characters")
            .select()
            .eq("project_id", projectID)
            .order("sort_order")
        return try await Supabase.shared.execute(query)
    }

    static func createCharacter(
        projectID: String,
        name: String,
        description: String?,
        isMain: Bool,
        color: String,
        sortOrder: Int,
        ownerID: String?
    ) async throws -> ProjectCharacter? {
        let payload = [NewCharacter(
            projectID: projectID,
            name: name,
            description: description?.nonEmpty,
            isMain: isMain,
            color: color,
            sortOrder: sortOrder,
            createdBy: ownerID
        )]
        let query = try PostgrestQuery("characters").insert(payload)
        let rows: [ProjectCharacter] = try await Supabase.shared.execute(query)
        return rows.first
    }

    static func updateCharacterFields(id: String, fields: [String: JSONValue]) async throws {
        var body = fields
        body["updated_at"] = .string(PostgresDate.string(from: Date()))
        let query = try PostgrestQuery("characters")
            .eq("id", id)
            .update(body, returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func deleteCharacter(id: String) async throws {
        let query = PostgrestQuery("characters").eq("id", id).delete()
        try await Supabase.shared.executeIgnoringResult(query)
    }

    // MARK: - Schedule

    static func fetchSchedule(projectID: String) async throws -> [ScheduleEvent] {
        let query = PostgrestQuery("production_schedule")
            .select()
            .eq("project_id", projectID)
            .order("start_time")
        return try await Supabase.shared.execute(query)
    }

    static func createEvent(
        projectID: String,
        title: String,
        type: ScheduleEventType,
        start: Date,
        end: Date,
        allDay: Bool,
        notes: String?,
        ownerID: String?
    ) async throws -> ScheduleEvent? {
        let payload = [NewScheduleEvent(
            projectID: projectID,
            title: title,
            eventType: type.rawValue,
            startTime: start,
            endTime: end,
            allDay: allDay,
            notes: notes?.nonEmpty,
            createdBy: ownerID
        )]
        let query = try PostgrestQuery("production_schedule").insert(payload)
        let rows: [ScheduleEvent] = try await Supabase.shared.execute(query)
        return rows.first
    }

    static func setEventConfirmed(id: String, confirmed: Bool) async throws {
        struct Patch: Encodable {
            let is_confirmed: Bool
            let updated_at: Date
        }
        let query = try PostgrestQuery("production_schedule")
            .eq("id", id)
            .update(Patch(is_confirmed: confirmed, updated_at: Date()), returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func deleteEvent(id: String) async throws {
        let query = PostgrestQuery("production_schedule").eq("id", id).delete()
        try await Supabase.shared.executeIgnoringResult(query)
    }

    // MARK: - Locations

    static func fetchLocations(projectID: String) async throws -> [ProductionLocation] {
        let query = PostgrestQuery("locations")
            .select()
            .eq("project_id", projectID)
            .order("name")
        return try await Supabase.shared.execute(query)
    }

    // MARK: - Documents

    static func fetchDocuments(projectID: String) async throws -> [ProjectDocument] {
        let query = PostgrestQuery("project_documents")
            .select()
            .eq("project_id", projectID)
            .order("updated_at", ascending: false)
        return try await Supabase.shared.execute(query)
    }

    static func fetchFolders(projectID: String) async throws -> [ProjectFolder] {
        let query = PostgrestQuery("project_folders")
            .select()
            .eq("project_id", projectID)
            .order("sort_order")
        return try await Supabase.shared.execute(query)
    }

    static func createDocument(_ doc: NewDocument) async throws -> ProjectDocument? {
        let query = try PostgrestQuery("project_documents").insert([doc])
        let rows: [ProjectDocument] = try await Supabase.shared.execute(query)
        return rows.first
    }

    static func updateDocumentContent(id: String, content: String, editedBy: String?) async throws {
        let body: [String: JSONValue] = [
            "content": .string(content),
            "last_edited_by": editedBy.map { .string($0) } ?? .null,
            "updated_at": .string(PostgresDate.string(from: Date())),
        ]
        let query = try PostgrestQuery("project_documents")
            .eq("id", id)
            .update(body, returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func updateDocumentTitle(id: String, title: String) async throws {
        let body: [String: JSONValue] = [
            "title": .string(title),
            "updated_at": .string(PostgresDate.string(from: Date())),
        ]
        let query = try PostgrestQuery("project_documents")
            .eq("id", id)
            .update(body, returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func deleteDocument(id: String) async throws {
        let query = PostgrestQuery("project_documents").eq("id", id).delete()
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func createFolder(_ folder: NewFolder) async throws -> ProjectFolder? {
        let query = try PostgrestQuery("project_folders").insert([folder])
        let rows: [ProjectFolder] = try await Supabase.shared.execute(query)
        return rows.first
    }

    static func deleteFolder(id: String) async throws {
        let query = PostgrestQuery("project_folders").eq("id", id).delete()
        try await Supabase.shared.executeIgnoringResult(query)
    }

    // MARK: - Gear

    static func fetchGear(projectID: String) async throws -> [GearItem] {
        let query = PostgrestQuery("shoot_gear")
            .select()
            .eq("project_id", projectID)
            .order("category")
            .order("name")
        return try await Supabase.shared.execute(query)
    }

    static func createGear(_ item: NewGearItem) async throws -> GearItem? {
        let query = try PostgrestQuery("shoot_gear").insert([item])
        let rows: [GearItem] = try await Supabase.shared.execute(query)
        return rows.first
    }

    static func updateGear(id: String, fields: [String: JSONValue]) async throws {
        var body = fields
        body["updated_at"] = .string(PostgresDate.string(from: Date()))
        let query = try PostgrestQuery("shoot_gear")
            .eq("id", id)
            .update(body, returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func deleteGear(id: String) async throws {
        let query = PostgrestQuery("shoot_gear").eq("id", id).delete()
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func cycleGearStatus(id: String, next: GearStatus) async throws {
        let body: [String: JSONValue] = [
            "status": .string(next.rawValue),
            "updated_at": .string(PostgresDate.string(from: Date())),
        ]
        let query = try PostgrestQuery("shoot_gear")
            .eq("id", id)
            .update(body, returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    // MARK: - Gear Checkouts

    static func fetchCheckouts(gearID: String) async throws -> [GearCheckout] {
        let query = PostgrestQuery("gear_checkouts")
            .select()
            .eq("gear_id", gearID)
            .order("checked_out_at", ascending: false)
        return try await Supabase.shared.execute(query)
    }

    static func fetchActiveCheckouts(projectID: String) async throws -> [GearCheckout] {
        let query = PostgrestQuery("gear_checkouts")
            .select()
            .eq("project_id", projectID)
            .is("returned_at", "null")
            .order("checked_out_at", ascending: false)
        return try await Supabase.shared.execute(query)
    }

    static func checkoutGear(_ checkout: NewGearCheckout) async throws -> GearCheckout? {
        let query = try PostgrestQuery("gear_checkouts").insert([checkout])
        let rows: [GearCheckout] = try await Supabase.shared.execute(query)
        return rows.first
    }

    static func returnGear(checkoutID: String) async throws {
        let body: [String: JSONValue] = [
            "returned_at": .string(PostgresDate.string(from: Date())),
        ]
        let query = try PostgrestQuery("gear_checkouts")
            .eq("id", checkoutID)
            .update(body, returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }
}

