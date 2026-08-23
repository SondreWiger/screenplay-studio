#if DEBUG
import Foundation

/// Sample data for running the app without a Supabase project.
///
/// DEBUG only — this file is not compiled into a Release build, so it can never
/// reach the App Store. Launch with `-ss-demo` (already wired into the
/// `ScreenplayStudio` scheme's Demo variant, or pass it via
/// `xcrun simctl launch … -ss-demo`) to browse every screen with plausible
/// content, which is also how the UI gets checked in the simulator.
///
/// It hooks in at the transport layer rather than in the view models, so the
/// real decoding, caching and error paths all still run.
enum DemoData {

    static var isActive: Bool {
        ProcessInfo.processInfo.arguments.contains("-ss-demo")
    }

    static let userID = "11111111-1111-4111-8111-111111111111"
    private static let projectA = "22222222-2222-4222-8222-222222222222"
    private static let projectB = "33333333-3333-4333-8333-333333333333"
    private static let scriptA = "44444444-4444-4444-8444-444444444444"

    static var session: AuthSession {
        AuthSession(
            accessToken: "demo-access-token",
            refreshToken: "demo-refresh-token",
            expiresAt: Date().addingTimeInterval(86_400),
            user: AuthUser(id: userID, email: "demo@screenplaystudio.fun", userMetadata: nil)
        )
    }

    /// JSON rows for a table, matching what PostgREST would return for this
    /// query — including its `eq.` filters, so a per-project fetch really does
    /// come back scoped to that project. Without that, screens which fan out
    /// across projects (the Today tab) show every row several times over and
    /// the demo stops being a useful check on the real thing.
    static func rows(for query: PostgrestQuery) -> Data {
        let all = rows(for: query.table)

        let equalityFilters: [(column: String, value: String)] = query.queryItems.compactMap { item in
            guard
                let value = item.value,
                value.hasPrefix("eq."),
                !["select", "order", "limit", "offset", "on_conflict", "or"].contains(item.name)
            else { return nil }
            return (column: item.name, value: String(value.dropFirst(3)))
        }
        guard !equalityFilters.isEmpty else { return all }

        guard let parsed = try? JSONSerialization.jsonObject(with: all) as? [[String: Any]] else {
            return all
        }

        let filtered = parsed.filter { row in
            equalityFilters.allSatisfy { filter in
                switch row[filter.column] {
                case let text as String: return text == filter.value
                case let flag as Bool:   return String(flag) == filter.value
                case let number as NSNumber: return number.stringValue == filter.value
                default: return false
                }
            }
        }

        return (try? JSONSerialization.data(withJSONObject: filtered)) ?? all
    }

    private static func rows(for table: String) -> Data {
        let json: String
        switch table {
        case "projects":            json = projects
        case "profiles":            json = profiles
        case "scripts":             json = scripts
        case "script_elements":     json = scriptElements
        case "scenes":              json = scenes
        case "shots":               json = shots
        case "characters":          json = characters
        case "production_schedule": json = schedule
        case "locations":           json = locations
        default:                    json = "[]"
        }
        return Data(json.utf8)
    }

    /// Dates are generated relative to now so the Today tab always has something
    /// on it, whenever the app is run.
    private static func offsetDay(_ days: Int, hour: Int) -> String {
        let calendar = Calendar(identifier: .gregorian)
        let base = calendar.date(byAdding: .day, value: days, to: Date()) ?? Date()
        let stamped = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: base) ?? base
        return PostgresDate.string(from: stamped)
    }

    private static var now: String { PostgresDate.string(from: Date()) }

    // MARK: - Tables

    private static var profiles: String {
        """
        [{"id":"\(userID)","email":"demo@screenplaystudio.fun","full_name":"Demo Writer",
          "display_name":"Demo Writer","avatar_url":null,"bio":null,"role":"writer"}]
        """
    }

    private static var projects: String {
        """
        [
          {"id":"\(projectA)","title":"The Long Winter","logline":"A lighthouse keeper's daughter finds a body in the ice — and the only witness is the man she left behind.",
           "synopsis":null,"genre":["Thriller","Drama"],"format":"feature","target_length_minutes":104,
           "status":"pre_production","poster_url":null,"cover_url":null,"created_by":"\(userID)",
           "created_at":"\(now)","updated_at":"\(now)"},
          {"id":"\(projectB)","title":"Nightshift","logline":"Two paramedics, one impossible call, twelve hours to sunrise.",
           "synopsis":null,"genre":["Drama"],"format":"short","target_length_minutes":18,
           "status":"development","poster_url":null,"cover_url":null,"created_by":"\(userID)",
           "created_at":"\(now)","updated_at":"\(now)"}
        ]
        """
    }

    private static var scripts: String {
        """
        [{"id":"\(scriptA)","project_id":"\(projectA)","title":"The Long Winter","version":3,
          "revision_color":"blue","is_active":true,"locked":false,"locked_by":null,
          "created_by":"\(userID)","created_at":"\(now)","updated_at":"\(now)"}]
        """
    }

    private static var scriptElements: String {
        let lines: [(String, String)] = [
            ("scene_heading", "EXT. HALVARD POINT LIGHTHOUSE - DAWN"),
            ("action", "Ice all the way to the horizon. The lighthouse stands against it like something that refuses to be told."),
            ("action", "MAREN, 34, weatherproofed to the eyes, walks the frozen shoreline with a torch she doesn't need yet."),
            ("character", "MAREN"),
            ("parenthetical", "(into a radio)"),
            ("dialogue", "Station, this is Halvard Point. I've got something on the ice about two hundred metres out."),
            ("action", "Static. She waits. The wind takes the sound away from her."),
            ("character", "RADIO (V.O.)"),
            ("dialogue", "Say again, Halvard Point."),
            ("character", "MAREN"),
            ("dialogue", "I said there's a body."),
            ("transition", "CUT TO:"),
            ("scene_heading", "INT. LIGHTHOUSE - KITCHEN - CONTINUOUS"),
            ("action", "A kettle screams itself out on an unlit hob. Nobody comes."),
            ("scene_heading", "EXT. QUAY - DAY"),
            ("action", "A police launch noses through the channel it broke coming in. JOHAN, 40s, steps off it before it's tied."),
            ("character", "JOHAN"),
            ("dialogue", "You didn't have to call it in yourself."),
            ("character", "MAREN"),
            ("dialogue", "There wasn't anybody else on the point."),
            ("action", "He looks at the lighthouse. Twenty years fold up between them and neither one mentions it."),
        ]

        let rows = lines.enumerated().map { index, line in
            let content = line.1.replacingOccurrences(of: "\"", with: "\\\"")
            return """
            {"id":"55555555-5555-4555-8555-\(String(format: "%012d", index))","script_id":"\(scriptA)",
             "element_type":"\(line.0)","content":"\(content)","sort_order":\(index),
             "scene_number":null,"revision_color":"white","is_revised":false,"is_omitted":false,
             "created_at":"\(now)","updated_at":"\(now)"}
            """
        }
        return "[\(rows.joined(separator: ","))]"
    }

    private static var scenes: String {
        """
        [
          {"id":"66666666-6666-4666-8666-000000000001","project_id":"\(projectA)","script_id":"\(scriptA)",
           "scene_number":"1","scene_heading":"EXT. HALVARD POINT LIGHTHOUSE - DAWN","location_type":"EXT",
           "location_name":"HALVARD POINT LIGHTHOUSE","time_of_day":"DAWN",
           "synopsis":"Maren finds the body on the ice and calls it in.","page_count":2.5,
           "estimated_duration_minutes":3,"shooting_duration_minutes":180,
           "location_id":"88888888-8888-4888-8888-000000000001","cast_ids":["77777777-7777-4777-8777-000000000001"],
           "extras_count":0,"props":["Storm torch","Handheld VHF radio","Ice axe"],
           "costumes":["Maren — survival suit","Maren — wool base layer"],"makeup_notes":"Wind burn, cracked lips.",
           "special_effects":["Breath vapour","Blown snow"],"stunts":"Controlled walk on dressed ice — stunt coordinator on set.",
           "vehicles":[],"animals":[],"sound_notes":"Wind is the whole track. Record thirty minutes of clean atmos.",
           "music_cues":["Opening drone"],"vfx_notes":"Extend the ice field beyond the practical set.",
           "mood":"Cold, hushed, wrong.","weather_required":"Overcast, no sun",
           "special_equipment":["Ice mats","Rescue line","Heated battery packs"],
           "notes":"First shot of the film. Protect the dawn light.","is_completed":true,"sort_order":0,"updated_at":"\(now)"},

          {"id":"66666666-6666-4666-8666-000000000002","project_id":"\(projectA)","script_id":"\(scriptA)",
           "scene_number":"2","scene_heading":"INT. LIGHTHOUSE - KITCHEN - CONTINUOUS","location_type":"INT",
           "location_name":"LIGHTHOUSE KITCHEN","time_of_day":"CONTINUOUS",
           "synopsis":"An empty room that says everything.","page_count":0.375,
           "estimated_duration_minutes":1,"shooting_duration_minutes":45,
           "location_id":"88888888-8888-4888-8888-000000000002","cast_ids":[],"extras_count":0,
           "props":["Enamel kettle","Tin mugs"],"costumes":[],"makeup_notes":null,
           "special_effects":["Practical steam"],"stunts":null,"vehicles":[],"animals":[],
           "sound_notes":"Kettle whistle carries into the next scene.","music_cues":[],"vfx_notes":null,
           "mood":"Absence.","weather_required":null,"special_equipment":[],"notes":null,
           "is_completed":true,"sort_order":1,"updated_at":"\(now)"},

          {"id":"66666666-6666-4666-8666-000000000003","project_id":"\(projectA)","script_id":"\(scriptA)",
           "scene_number":"3","scene_heading":"EXT. QUAY - DAY","location_type":"EXT",
           "location_name":"HALVARD QUAY","time_of_day":"DAY",
           "synopsis":"Johan arrives. Twenty years in one look.","page_count":1.75,
           "estimated_duration_minutes":2,"shooting_duration_minutes":240,
           "location_id":"88888888-8888-4888-8888-000000000003",
           "cast_ids":["77777777-7777-4777-8777-000000000001","77777777-7777-4777-8777-000000000002"],
           "extras_count":6,"props":["Mooring rope","Evidence case"],
           "costumes":["Johan — police parka"],"makeup_notes":null,
           "special_effects":[],"stunts":null,"vehicles":["Police launch","Harbour tender"],
           "animals":[],"sound_notes":"Boat engine, ice against the hull.","music_cues":[],
           "vfx_notes":null,"mood":"Held breath.","weather_required":"Flat light",
           "special_equipment":["Marine safety boat"],"notes":"Tide window is 11:00–14:00 only.",
           "is_completed":false,"sort_order":2,"updated_at":"\(now)"},

          {"id":"66666666-6666-4666-8666-000000000004","project_id":"\(projectA)","script_id":"\(scriptA)",
           "scene_number":"4","scene_heading":"INT. LIGHTHOUSE - LAMP ROOM - NIGHT","location_type":"INT",
           "location_name":"LAMP ROOM","time_of_day":"NIGHT",
           "synopsis":"Maren tells Johan what she saw. Not all of it.","page_count":3.125,
           "estimated_duration_minutes":4,"shooting_duration_minutes":300,
           "location_id":"88888888-8888-4888-8888-000000000002",
           "cast_ids":["77777777-7777-4777-8777-000000000001","77777777-7777-4777-8777-000000000002"],
           "extras_count":0,"props":["Logbook","Paraffin lamp","Brass telescope"],
           "costumes":["Maren — oiled wool jumper"],"makeup_notes":"Exhausted, two days without sleep.",
           "special_effects":["Rotating lamp beam"],"stunts":null,"vehicles":[],"animals":[],
           "sound_notes":"The lamp mechanism is a metronome under the whole scene.",
           "music_cues":["Lamp room theme"],"vfx_notes":null,"mood":"Confession that isn't one.",
           "weather_required":null,"special_equipment":["Lamp rig","Dimmer board"],
           "notes":"Longest dialogue scene. Give it a full day.","is_completed":false,"sort_order":3,"updated_at":"\(now)"}
        ]
        """
    }

    private static var shots: String {
        """
        [
          {"id":"99999999-9999-4999-8999-000000000001","project_id":"\(projectA)","scene_id":"66666666-6666-4666-8666-000000000001",
           "shot_number":"1A","shot_type":"establishing","shot_movement":"crane_up","lens":"24mm",
           "description":"Crane up from the ice to reveal the lighthouse against a colourless dawn.",
           "dialogue_ref":null,"duration_seconds":18,"camera_notes":"Start low, 40cm off the ice.",
           "lighting_notes":"Available light only.","sound_notes":null,"vfx_required":true,
           "vfx_notes":"Extend ice field.","storyboard_url":null,"is_completed":true,
           "takes_needed":3,"takes_completed":4,"sort_order":0,"updated_at":"\(now)"},
          {"id":"99999999-9999-4999-8999-000000000002","project_id":"\(projectA)","scene_id":"66666666-6666-4666-8666-000000000001",
           "shot_number":"1B","shot_type":"medium","shot_movement":"follow","lens":"50mm",
           "description":"Track with Maren along the shoreline.","dialogue_ref":null,"duration_seconds":22,
           "camera_notes":"Steadicam.","lighting_notes":null,"sound_notes":"Radio playback.","vfx_required":false,
           "vfx_notes":null,"storyboard_url":null,"is_completed":true,"takes_needed":4,"takes_completed":6,
           "sort_order":1,"updated_at":"\(now)"},
          {"id":"99999999-9999-4999-8999-000000000003","project_id":"\(projectA)","scene_id":"66666666-6666-4666-8666-000000000001",
           "shot_number":"1C","shot_type":"close_up","shot_movement":"static","lens":"85mm",
           "description":"Maren's face as the radio doesn't answer.","dialogue_ref":null,"duration_seconds":9,
           "camera_notes":null,"lighting_notes":"Bounce off the ice.","sound_notes":null,"vfx_required":false,
           "vfx_notes":null,"storyboard_url":null,"is_completed":true,"takes_needed":2,"takes_completed":2,
           "sort_order":2,"updated_at":"\(now)"},
          {"id":"99999999-9999-4999-8999-000000000004","project_id":"\(projectA)","scene_id":"66666666-6666-4666-8666-000000000003",
           "shot_number":"3A","shot_type":"wide","shot_movement":"static","lens":"35mm",
           "description":"The launch noses in through broken ice.","dialogue_ref":null,"duration_seconds":14,
           "camera_notes":"Locked off on the quay.","lighting_notes":null,"sound_notes":null,"vfx_required":false,
           "vfx_notes":null,"storyboard_url":null,"is_completed":false,"takes_needed":2,"takes_completed":0,
           "sort_order":3,"updated_at":"\(now)"},
          {"id":"99999999-9999-4999-8999-000000000005","project_id":"\(projectA)","scene_id":"66666666-6666-4666-8666-000000000003",
           "shot_number":"3B","shot_type":"over_shoulder","shot_movement":"rack_focus","lens":"75mm",
           "description":"Over Johan to Maren — rack as she decides not to say it.","dialogue_ref":"You didn't have to call it in yourself.",
           "duration_seconds":11,"camera_notes":"Focus pull on the line.","lighting_notes":null,
           "sound_notes":null,"vfx_required":false,"vfx_notes":null,"storyboard_url":null,
           "is_completed":false,"takes_needed":4,"takes_completed":0,"sort_order":4,"updated_at":"\(now)"},
          {"id":"99999999-9999-4999-8999-000000000006","project_id":"\(projectA)","scene_id":"66666666-6666-4666-8666-000000000004",
           "shot_number":"4A","shot_type":"two_shot","shot_movement":"orbit","lens":"32mm",
           "description":"Slow orbit around them both as the lamp comes round.","dialogue_ref":null,
           "duration_seconds":40,"camera_notes":"One take if we can get it.","lighting_notes":"Practical lamp only.",
           "sound_notes":null,"vfx_required":false,"vfx_notes":null,"storyboard_url":null,
           "is_completed":false,"takes_needed":6,"takes_completed":0,"sort_order":5,"updated_at":"\(now)"}
        ]
        """
    }

    private static var characters: String {
        """
        [
          {"id":"77777777-7777-4777-8777-000000000001","project_id":"\(projectA)","name":"MAREN","full_name":"Maren Halvardsen",
           "age":"34","gender":"Female","description":"Keeps the light. Keeps most other things too.","backstory":null,
           "motivation":"To be believed once.","arc":null,"appearance":null,"personality_traits":["Guarded","Exact"],
           "quirks":null,"voice_notes":null,"avatar_url":null,"color":"#FF5F1F","is_main":true,
           "first_appearance":"Scene 1","cast_actor":"Ingrid Solheim","cast_notes":null,"sort_order":0,"updated_at":"\(now)"},
          {"id":"77777777-7777-4777-8777-000000000002","project_id":"\(projectA)","name":"JOHAN","full_name":"Johan Lie",
           "age":"41","gender":"Male","description":"Came back for the case. Says it's the case.","backstory":null,
           "motivation":"To close it and leave.","arc":null,"appearance":null,"personality_traits":["Patient"],
           "quirks":null,"voice_notes":null,"avatar_url":null,"color":"#8B5CF6","is_main":true,
           "first_appearance":"Scene 3","cast_actor":null,"cast_notes":"Offer out.","sort_order":1,"updated_at":"\(now)"},
          {"id":"77777777-7777-4777-8777-000000000003","project_id":"\(projectA)","name":"ELSE","full_name":"Else Halvardsen",
           "age":"71","gender":"Female","description":"Maren's mother. Remembers a different winter.","backstory":null,
           "motivation":null,"arc":null,"appearance":null,"personality_traits":[],"quirks":null,"voice_notes":null,
           "avatar_url":null,"color":"#06B6D4","is_main":false,"first_appearance":"Scene 9",
           "cast_actor":"Bjørg Antonsen","cast_notes":null,"sort_order":2,"updated_at":"\(now)"},
          {"id":"77777777-7777-4777-8777-000000000004","project_id":"\(projectA)","name":"HARBOURMASTER","full_name":null,
           "age":"50s","gender":null,"description":"Two scenes, one very good line.","backstory":null,"motivation":null,
           "arc":null,"appearance":null,"personality_traits":[],"quirks":null,"voice_notes":null,"avatar_url":null,
           "color":"#22C55E","is_main":false,"first_appearance":"Scene 6","cast_actor":null,"cast_notes":null,
           "sort_order":3,"updated_at":"\(now)"}
        ]
        """
    }

    private static var schedule: String {
        """
        [
          {"id":"aaaaaaaa-aaaa-4aaa-8aaa-000000000001","project_id":"\(projectA)","title":"Day 4 — Quay exteriors",
           "description":null,"event_type":"shooting","start_time":"\(offsetDay(0, hour: 7))","end_time":"\(offsetDay(0, hour: 18))",
           "all_day":false,"scene_ids":["66666666-6666-4666-8666-000000000003"],
           "location_id":"88888888-8888-4888-8888-000000000003","assigned_to":[],
           "call_time":"\(offsetDay(0, hour: 6))","wrap_time":"\(offsetDay(0, hour: 18))",
           "notes":"Tide window 11:00–14:00. Marine safety boat on standby all day.","color":null,"is_confirmed":true},
          {"id":"aaaaaaaa-aaaa-4aaa-8aaa-000000000002","project_id":"\(projectA)","title":"Camera test — 75mm rack",
           "description":null,"event_type":"setup","start_time":"\(offsetDay(0, hour: 19))","end_time":"\(offsetDay(0, hour: 21))",
           "all_day":false,"scene_ids":[],"location_id":null,"assigned_to":[],"call_time":null,"wrap_time":null,
           "notes":null,"color":null,"is_confirmed":false},
          {"id":"aaaaaaaa-aaaa-4aaa-8aaa-000000000003","project_id":"\(projectA)","title":"Day 5 — Lamp room nights",
           "description":null,"event_type":"shooting","start_time":"\(offsetDay(1, hour: 16))","end_time":"\(offsetDay(2, hour: 4))",
           "all_day":false,"scene_ids":["66666666-6666-4666-8666-000000000004"],
           "location_id":"88888888-8888-4888-8888-000000000002","assigned_to":[],
           "call_time":"\(offsetDay(1, hour: 15))","wrap_time":null,
           "notes":"Night shoot. Turnaround into Day 6 is tight — check with the AD.","color":null,"is_confirmed":true},
          {"id":"aaaaaaaa-aaaa-4aaa-8aaa-000000000004","project_id":"\(projectA)","title":"Recce — north shoreline",
           "description":null,"event_type":"location_scout","start_time":"\(offsetDay(3, hour: 9))","end_time":"\(offsetDay(3, hour: 13))",
           "all_day":false,"scene_ids":[],"location_id":null,"assigned_to":[],"call_time":null,"wrap_time":null,
           "notes":null,"color":null,"is_confirmed":false},
          {"id":"aaaaaaaa-aaaa-4aaa-8aaa-000000000005","project_id":"\(projectB)","title":"Table read",
           "description":null,"event_type":"rehearsal","start_time":"\(offsetDay(4, hour: 11))","end_time":"\(offsetDay(4, hour: 14))",
           "all_day":false,"scene_ids":[],"location_id":null,"assigned_to":[],"call_time":null,"wrap_time":null,
           "notes":"Full cast.","color":null,"is_confirmed":true}
        ]
        """
    }

    private static var locations: String {
        """
        [
          {"id":"88888888-8888-4888-8888-000000000001","project_id":"\(projectA)","name":"Halvard Point — ice field",
           "address":"Halvard Point, Troms","location_type":"EXT","contact_name":"Site warden",
           "contact_phone":"+47 400 00 000","is_confirmed":true},
          {"id":"88888888-8888-4888-8888-000000000002","project_id":"\(projectA)","name":"Lighthouse interior (build)",
           "address":"Stage 2","location_type":"INT","contact_name":null,"contact_phone":null,"is_confirmed":true},
          {"id":"88888888-8888-4888-8888-000000000003","project_id":"\(projectA)","name":"Halvard Quay",
           "address":"Havnegata 1","location_type":"EXT","contact_name":"Harbourmaster",
           "contact_phone":"+47 400 00 001","is_confirmed":false}
        ]
        """
    }

    // MARK: - Screen routing
    //
    // `-ss-route <name>` jumps straight to a screen on launch, which is how each
    // one gets screenshotted in the simulator without driving the UI by hand.
    // Also the quickest way to land on the screen you are working on.

    static var initialRoute: String? {
        let args = ProcessInfo.processInfo.arguments
        guard let index = args.firstIndex(of: "-ss-route"), index + 1 < args.count else { return nil }
        return args[index + 1]
    }

    @MainActor
    static func applyInitialRoute(to router: Router) {
        guard isActive, let route = initialRoute else { return }

        let project = Project(
            id: projectA,
            title: "The Long Winter",
            logline: "A lighthouse keeper's daughter finds a body in the ice — and the only witness is the man she left behind.",
            synopsis: nil,
            genre: ["Thriller", "Drama"],
            format: "feature",
            targetLengthMinutes: 104,
            status: .preProduction,
            posterURL: nil,
            coverURL: nil,
            createdBy: userID,
            createdAt: Date(),
            updatedAt: Date()
        )

        switch route {
        case "today":
            router.selectedTab = .today
        case "settings":
            router.selectedTab = .settings
        case "hub":
            router.open(project)
        case "editor", "editor-typing":
            router.open(project)
            router.push(.editor(scriptID: scriptA, scriptTitle: "The Long Winter"))
        case "scenes":
            router.open(project)
            router.push(.scenes)
        case "shots":
            router.open(project)
            router.push(.shots)
        case "schedule":
            router.open(project)
            router.push(.schedule)
        case "characters":
            router.open(project)
            router.push(.characters)
        default:
            break
        }
    }
}
#endif
