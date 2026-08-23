import Foundation

/// Reads and writes for `projects`.
///
/// We explicitly filter by user ID here because platform admins have an RLS policy 
/// that allows them to read all projects. Without this filter, admins would see 
/// every single project on the platform in their regular app view.
enum ProjectService {

    static func fetchAll() async throws -> [Project] {
        guard let session = await Supabase.shared.currentSession else { return [] }
        let userID = session.user.id
        
        let membershipsQuery = PostgrestQuery("project_members")
            .select("project_id")
            .eq("user_id", userID)
        
        struct Membership: Decodable { let project_id: String }
        let memberships: [Membership] = (try? await Supabase.shared.execute(membershipsQuery)) ?? []
        let memberIDs = memberships.map(\.project_id)
        
        var orFilter = "created_by.eq.\(userID)"
        if !memberIDs.isEmpty {
            let inList = memberIDs.joined(separator: ",")
            orFilter += ",id.in.(\(inList))"
        }
        
        let query = PostgrestQuery("projects")
            .select()
            .or(orFilter)
            .order("updated_at", ascending: false)
        return try await Supabase.shared.execute(query)
    }

    static func fetch(id: String) async throws -> Project? {
        let query = PostgrestQuery("projects")
            .select()
            .eq("id", id)
            .limit(1)
        return try await Supabase.shared.executeSingle(query)
    }

    static func create(title: String, format: ProjectFormat, logline: String?, ownerID: String) async throws -> Project? {
        let payload = [NewProject(
            title: title,
            logline: logline?.nonEmpty,
            format: format.rawValue,
            status: ProjectStatus.development.rawValue,
            createdBy: ownerID
        )]
        let query = try PostgrestQuery("projects").insert(payload)
        let rows: [Project] = try await Supabase.shared.execute(query)
        return rows.first
    }

    static func updateStatus(id: String, status: ProjectStatus) async throws {
        struct Patch: Encodable {
            let status: String
            let updated_at: Date
        }
        let query = try PostgrestQuery("projects")
            .eq("id", id)
            .update(Patch(status: status.rawValue, updated_at: Date()), returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func rename(id: String, title: String, logline: String?) async throws {
        struct Patch: Encodable {
            let title: String
            let logline: String?
            let updated_at: Date
        }
        let query = try PostgrestQuery("projects")
            .eq("id", id)
            .update(Patch(title: title, logline: logline, updated_at: Date()), returning: false)
        try await Supabase.shared.executeIgnoringResult(query)
    }

    static func delete(id: String) async throws {
        let query = PostgrestQuery("projects").eq("id", id).delete()
        try await Supabase.shared.executeIgnoringResult(query)
    }
}
