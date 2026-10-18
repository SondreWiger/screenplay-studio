package no.northem.screenplaystudio.data

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * DEBUG-only canned data — the same projects as DemoData.swift on iOS.
 *
 *   adb shell am start -n no.northem.screenplaystudio.debug/no.northem.screenplaystudio.MainActivity --ez ss-demo true
 *
 * gives a populated app with no backend, for screenshots and UI checks. It
 * hooks in at the transport layer and honours eq-filters, so the real
 * decoding and error paths still run. Release builds ignore the flag.
 */
object DemoData {
    private const val USER = "11111111-1111-4111-8111-111111111111"
    private const val PA = "22222222-2222-4222-8222-222222222222"
    private const val PB = "33333333-3333-4333-8333-333333333333"
    private const val SA = "44444444-4444-4444-8444-444444444444"
    private const val FOLDER = "ff000000-0000-4000-8000-000000000001"

    val session = AuthSession(
        accessToken = "demo",
        refreshToken = "demo",
        expiresAt = Long.MAX_VALUE / 2,
        user = AuthUser(USER, "demo@screenplaystudio.fun"),
    )

    fun respond(query: Query): String {
        if (query.method != "GET") {
            return if (query.body != null && "return=representation" in query.prefer) withIds(query.body) else "[]"
        }
        val source = if (query.table == "script_elements") elements() else table(query.table)
        val all = Supabase.json.parseToJsonElement(source).jsonArray
        val filters = query.equalityFilters
        val filtered = all.filter { row ->
            filters.all { (column, value) -> (row.jsonObject[column] as? JsonPrimitive)?.content == value }
        }
        return JsonArray(filtered).toString()
    }

    /** An insert echoes back its rows, with the ids the database would assign. */
    private fun withIds(body: String): String {
        val rows = Supabase.json.parseToJsonElement(body).jsonArray.map { row ->
            val obj = row.jsonObject
            if ("id" in obj) obj else kotlinx.serialization.json.JsonObject(obj + ("id" to JsonPrimitive(java.util.UUID.randomUUID().toString())))
        }
        return JsonArray(rows).toString()
    }

    private val NOW: String get() = PostgresDate.format(Instant.now())

    private fun day(offset: Long, hour: Int): String =
        PostgresDate.format(LocalDate.now().plusDays(offset).atTime(hour, 0).atZone(ZoneId.systemDefault()).toInstant())

    private val LINES = listOf(
        "scene_heading" to "EXT. HALVARD POINT LIGHTHOUSE - DAWN",
        "action" to "Ice all the way to the horizon. The lighthouse stands against it like something that refuses to be told.",
        "action" to "MAREN, 34, weatherproofed to the eyes, walks the frozen shoreline with a torch she doesn't need yet.",
        "character" to "MAREN",
        "parenthetical" to "(into a radio)",
        "dialogue" to "Station, this is Halvard Point. I've got something on the ice about two hundred metres out.",
        "action" to "Static. She waits. The wind takes the sound away from her.",
        "character" to "RADIO (V.O.)",
        "dialogue" to "Say again, Halvard Point.",
        "character" to "MAREN",
        "dialogue" to "I said there's a body.",
        "transition" to "CUT TO:",
        "scene_heading" to "INT. LIGHTHOUSE - KITCHEN - CONTINUOUS",
        "action" to "A kettle screams itself out on an unlit hob. Nobody comes.",
        "scene_heading" to "EXT. QUAY - DAY",
        "action" to "A police launch noses through the channel it broke coming in. JOHAN, 40s, steps off it before it's tied.",
        "character" to "JOHAN",
        "dialogue" to "You didn't have to call it in yourself.",
        "character" to "MAREN",
        "dialogue" to "There wasn't anybody else on the point.",
        "action" to "He looks at the lighthouse. Twenty years fold up between them and neither one mentions it.",
    )

    private fun elements(): String = buildJsonArray {
        LINES.forEachIndexed { index, (type, content) ->
            add(buildJsonObject {
                put("id", "55555555-5555-4555-8555-" + index.toString().padStart(12, '0'))
                put("script_id", SA)
                put("element_type", type)
                put("content", content)
                put("sort_order", index)
            })
        }
    }.toString()

    private fun table(name: String): String = when (name) {
        "projects" -> """
        [
          {"id":"$PA","title":"The Long Winter","logline":"A lighthouse keeper's daughter finds a body in the ice — and the only witness is the man she left behind.",
           "synopsis":null,"genre":["Thriller","Drama"],"format":"feature","target_length_minutes":104,
           "status":"pre_production","poster_url":null,"cover_url":null,"created_by":"$USER",
           "created_at":"$NOW","updated_at":"$NOW"},
          {"id":"$PB","title":"Nightshift","logline":"Two paramedics, one impossible call, twelve hours to sunrise.",
           "synopsis":null,"genre":["Drama"],"format":"short","target_length_minutes":18,
           "status":"development","poster_url":null,"cover_url":null,"created_by":"$USER",
           "created_at":"$NOW","updated_at":"$NOW"}
        ]
        """
        "profiles" -> """
        [{"id":"$USER","email":"demo@screenplaystudio.fun","full_name":"Demo Writer",
          "display_name":"Demo Writer","avatar_url":null,"bio":null,"role":"writer"}]
        """
        "scripts" -> """
        [{"id":"$SA","project_id":"$PA","title":"The Long Winter","version":3,
          "revision_color":"blue","is_active":true,"locked":false,"locked_by":null,
          "created_by":"$USER","created_at":"$NOW","updated_at":"$NOW"}]
        """
        "scenes" -> """
        [
          {"id":"66666666-6666-4666-8666-000000000001","project_id":"$PA","script_id":"$SA",
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
           "notes":"First shot of the film. Protect the dawn light.","is_completed":true,"sort_order":0,"updated_at":"$NOW"},

          {"id":"66666666-6666-4666-8666-000000000002","project_id":"$PA","script_id":"$SA",
           "scene_number":"2","scene_heading":"INT. LIGHTHOUSE - KITCHEN - CONTINUOUS","location_type":"INT",
           "location_name":"LIGHTHOUSE KITCHEN","time_of_day":"CONTINUOUS",
           "synopsis":"An empty room that says everything.","page_count":0.375,
           "estimated_duration_minutes":1,"shooting_duration_minutes":45,
           "location_id":"88888888-8888-4888-8888-000000000002","cast_ids":[],"extras_count":0,
           "props":["Enamel kettle","Tin mugs"],"costumes":[],"makeup_notes":null,
           "special_effects":["Practical steam"],"stunts":null,"vehicles":[],"animals":[],
           "sound_notes":"Kettle whistle carries into the next scene.","music_cues":[],"vfx_notes":null,
           "mood":"Absence.","weather_required":null,"special_equipment":[],"notes":null,
           "is_completed":true,"sort_order":1,"updated_at":"$NOW"},

          {"id":"66666666-6666-4666-8666-000000000003","project_id":"$PA","script_id":"$SA",
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
           "is_completed":false,"sort_order":2,"updated_at":"$NOW"},

          {"id":"66666666-6666-4666-8666-000000000004","project_id":"$PA","script_id":"$SA",
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
           "notes":"Longest dialogue scene. Give it a full day.","is_completed":false,"sort_order":3,"updated_at":"$NOW"}
        ]
        """
        "shots" -> """
        [
          {"id":"99999999-9999-4999-8999-000000000001","project_id":"$PA","scene_id":"66666666-6666-4666-8666-000000000001",
           "shot_number":"1A","shot_type":"establishing","shot_movement":"crane_up","lens":"24mm",
           "description":"Crane up from the ice to reveal the lighthouse against a colourless dawn.",
           "dialogue_ref":null,"duration_seconds":18,"camera_notes":"Start low, 40cm off the ice.",
           "lighting_notes":"Available light only.","sound_notes":null,"vfx_required":true,
           "vfx_notes":"Extend ice field.","storyboard_url":null,"is_completed":true,
           "takes_needed":3,"takes_completed":4,"sort_order":0,"updated_at":"$NOW"},
          {"id":"99999999-9999-4999-8999-000000000002","project_id":"$PA","scene_id":"66666666-6666-4666-8666-000000000001",
           "shot_number":"1B","shot_type":"medium","shot_movement":"follow","lens":"50mm",
           "description":"Track with Maren along the shoreline.","dialogue_ref":null,"duration_seconds":22,
           "camera_notes":"Steadicam.","lighting_notes":null,"sound_notes":"Radio playback.","vfx_required":false,
           "vfx_notes":null,"storyboard_url":null,"is_completed":true,"takes_needed":4,"takes_completed":6,
           "sort_order":1,"updated_at":"$NOW"},
          {"id":"99999999-9999-4999-8999-000000000003","project_id":"$PA","scene_id":"66666666-6666-4666-8666-000000000001",
           "shot_number":"1C","shot_type":"close_up","shot_movement":"static","lens":"85mm",
           "description":"Maren's face as the radio doesn't answer.","dialogue_ref":null,"duration_seconds":9,
           "camera_notes":null,"lighting_notes":"Bounce off the ice.","sound_notes":null,"vfx_required":false,
           "vfx_notes":null,"storyboard_url":null,"is_completed":true,"takes_needed":2,"takes_completed":2,
           "sort_order":2,"updated_at":"$NOW"},
          {"id":"99999999-9999-4999-8999-000000000004","project_id":"$PA","scene_id":"66666666-6666-4666-8666-000000000003",
           "shot_number":"3A","shot_type":"wide","shot_movement":"static","lens":"35mm",
           "description":"The launch noses in through broken ice.","dialogue_ref":null,"duration_seconds":14,
           "camera_notes":"Locked off on the quay.","lighting_notes":null,"sound_notes":null,"vfx_required":false,
           "vfx_notes":null,"storyboard_url":null,"is_completed":false,"takes_needed":2,"takes_completed":0,
           "sort_order":3,"updated_at":"$NOW"},
          {"id":"99999999-9999-4999-8999-000000000005","project_id":"$PA","scene_id":"66666666-6666-4666-8666-000000000003",
           "shot_number":"3B","shot_type":"over_shoulder","shot_movement":"rack_focus","lens":"75mm",
           "description":"Over Johan to Maren — rack as she decides not to say it.","dialogue_ref":"You didn't have to call it in yourself.",
           "duration_seconds":11,"camera_notes":"Focus pull on the line.","lighting_notes":null,
           "sound_notes":null,"vfx_required":false,"vfx_notes":null,"storyboard_url":null,
           "is_completed":false,"takes_needed":4,"takes_completed":0,"sort_order":4,"updated_at":"$NOW"},
          {"id":"99999999-9999-4999-8999-000000000006","project_id":"$PA","scene_id":"66666666-6666-4666-8666-000000000004",
           "shot_number":"4A","shot_type":"two_shot","shot_movement":"orbit","lens":"32mm",
           "description":"Slow orbit around them both as the lamp comes round.","dialogue_ref":null,
           "duration_seconds":40,"camera_notes":"One take if we can get it.","lighting_notes":"Practical lamp only.",
           "sound_notes":null,"vfx_required":false,"vfx_notes":null,"storyboard_url":null,
           "is_completed":false,"takes_needed":6,"takes_completed":0,"sort_order":5,"updated_at":"$NOW"}
        ]
        """
        "characters" -> """
        [
          {"id":"77777777-7777-4777-8777-000000000001","project_id":"$PA","name":"MAREN","full_name":"Maren Halvardsen",
           "age":"34","gender":"Female","description":"Keeps the light. Keeps most other things too.","backstory":null,
           "motivation":"To be believed once.","arc":null,"appearance":null,"personality_traits":["Guarded","Exact"],
           "quirks":null,"voice_notes":null,"avatar_url":null,"color":"#FF5F1F","is_main":true,
           "first_appearance":"Scene 1","cast_actor":"Ingrid Solheim","cast_notes":null,"sort_order":0,"updated_at":"$NOW"},
          {"id":"77777777-7777-4777-8777-000000000002","project_id":"$PA","name":"JOHAN","full_name":"Johan Lie",
           "age":"41","gender":"Male","description":"Came back for the case. Says it's the case.","backstory":null,
           "motivation":"To close it and leave.","arc":null,"appearance":null,"personality_traits":["Patient"],
           "quirks":null,"voice_notes":null,"avatar_url":null,"color":"#8B5CF6","is_main":true,
           "first_appearance":"Scene 3","cast_actor":null,"cast_notes":"Offer out.","sort_order":1,"updated_at":"$NOW"},
          {"id":"77777777-7777-4777-8777-000000000003","project_id":"$PA","name":"ELSE","full_name":"Else Halvardsen",
           "age":"71","gender":"Female","description":"Maren's mother. Remembers a different winter.","backstory":null,
           "motivation":null,"arc":null,"appearance":null,"personality_traits":[],"quirks":null,"voice_notes":null,
           "avatar_url":null,"color":"#06B6D4","is_main":false,"first_appearance":"Scene 9",
           "cast_actor":"Bjørg Antonsen","cast_notes":null,"sort_order":2,"updated_at":"$NOW"},
          {"id":"77777777-7777-4777-8777-000000000004","project_id":"$PA","name":"HARBOURMASTER","full_name":null,
           "age":"50s","gender":null,"description":"Two scenes, one very good line.","backstory":null,"motivation":null,
           "arc":null,"appearance":null,"personality_traits":[],"quirks":null,"voice_notes":null,"avatar_url":null,
           "color":"#22C55E","is_main":false,"first_appearance":"Scene 6","cast_actor":null,"cast_notes":null,
           "sort_order":3,"updated_at":"$NOW"}
        ]
        """
        "production_schedule" -> """
        [
          {"id":"aaaaaaaa-aaaa-4aaa-8aaa-000000000001","project_id":"$PA","title":"Day 4 — Quay exteriors",
           "description":null,"event_type":"shooting","start_time":"${day(0, 7)}","end_time":"${day(0, 18)}",
           "all_day":false,"scene_ids":["66666666-6666-4666-8666-000000000003"],
           "location_id":"88888888-8888-4888-8888-000000000003","assigned_to":[],
           "call_time":"${day(0, 6)}","wrap_time":"${day(0, 18)}",
           "notes":"Tide window 11:00–14:00. Marine safety boat on standby all day.","color":null,"is_confirmed":true},
          {"id":"aaaaaaaa-aaaa-4aaa-8aaa-000000000002","project_id":"$PA","title":"Camera test — 75mm rack",
           "description":null,"event_type":"setup","start_time":"${day(0, 19)}","end_time":"${day(0, 21)}",
           "all_day":false,"scene_ids":[],"location_id":null,"assigned_to":[],"call_time":null,"wrap_time":null,
           "notes":null,"color":null,"is_confirmed":false},
          {"id":"aaaaaaaa-aaaa-4aaa-8aaa-000000000003","project_id":"$PA","title":"Day 5 — Lamp room nights",
           "description":null,"event_type":"shooting","start_time":"${day(1, 16)}","end_time":"${day(2, 4)}",
           "all_day":false,"scene_ids":["66666666-6666-4666-8666-000000000004"],
           "location_id":"88888888-8888-4888-8888-000000000002","assigned_to":[],
           "call_time":"${day(1, 15)}","wrap_time":null,
           "notes":"Night shoot. Turnaround into Day 6 is tight — check with the AD.","color":null,"is_confirmed":true},
          {"id":"aaaaaaaa-aaaa-4aaa-8aaa-000000000004","project_id":"$PA","title":"Recce — north shoreline",
           "description":null,"event_type":"location_scout","start_time":"${day(3, 9)}","end_time":"${day(3, 13)}",
           "all_day":false,"scene_ids":[],"location_id":null,"assigned_to":[],"call_time":null,"wrap_time":null,
           "notes":null,"color":null,"is_confirmed":false},
          {"id":"aaaaaaaa-aaaa-4aaa-8aaa-000000000005","project_id":"$PB","title":"Table read",
           "description":null,"event_type":"rehearsal","start_time":"${day(4, 11)}","end_time":"${day(4, 14)}",
           "all_day":false,"scene_ids":[],"location_id":null,"assigned_to":[],"call_time":null,"wrap_time":null,
           "notes":"Full cast.","color":null,"is_confirmed":true}
        ]
        """
        "shoot_gear" -> """
        [
          {"id":"gg000000-0000-4000-8000-000000000001","project_id":"$PA",
           "name":"ARRI ALEXA Mini LF","category":"Camera","quantity":1,"unit":"body",
           "ownership":"rented","vendor":"Storyline Studios","daily_rate":1200,"total_cost":18000,
           "shoot_day_id":null,"notes":"LPL mount. Sensor mode: Open Gate.","status":"confirmed",
           "created_by":"$USER","created_at":"$NOW","updated_at":"$NOW"},
          {"id":"gg000000-0000-4000-8000-000000000002","project_id":"$PA",
           "name":"Signature Prime 40mm T1.8","category":"Lenses","quantity":1,"unit":"lens",
           "ownership":"rented","vendor":"Storyline Studios","daily_rate":350,"total_cost":5250,
           "shoot_day_id":null,"notes":null,"status":"confirmed",
           "created_by":"$USER","created_at":"$NOW","updated_at":"$NOW"},
          {"id":"gg000000-0000-4000-8000-000000000003","project_id":"$PA",
           "name":"Signature Prime 75mm T1.8","category":"Lenses","quantity":1,"unit":"lens",
           "ownership":"rented","vendor":"Storyline Studios","daily_rate":350,"total_cost":5250,
           "shoot_day_id":null,"notes":null,"status":"confirmed",
           "created_by":"$USER","created_at":"$NOW","updated_at":"$NOW"},
          {"id":"gg000000-0000-4000-8000-000000000004","project_id":"$PA",
           "name":"ARRI SkyPanel S60-C","category":"Lighting","quantity":3,"unit":"fixture",
           "ownership":"rented","vendor":"Grip & Light AS","daily_rate":120,"total_cost":5400,
           "shoot_day_id":null,"notes":"Bring diffusion frames.","status":"pending",
           "created_by":"$USER","created_at":"$NOW","updated_at":"$NOW"},
          {"id":"gg000000-0000-4000-8000-000000000005","project_id":"$PA",
           "name":"Sennheiser MKH 416","category":"Sound","quantity":2,"unit":"mic",
           "ownership":"owned","vendor":null,"daily_rate":null,"total_cost":null,
           "shoot_day_id":null,"notes":"Wind gags packed.","status":"confirmed",
           "created_by":"$USER","created_at":"$NOW","updated_at":"$NOW"},
          {"id":"gg000000-0000-4000-8000-000000000006","project_id":"$PA",
           "name":"OConnor 2575 Fluid Head","category":"Grip","quantity":1,"unit":"head",
           "ownership":"provided","vendor":null,"daily_rate":null,"total_cost":null,
           "shoot_day_id":null,"notes":null,"status":"confirmed",
           "created_by":"$USER","created_at":"$NOW","updated_at":"$NOW"},
          {"id":"gg000000-0000-4000-8000-000000000007","project_id":"$PA",
           "name":"DIT Station — MacBook Pro + Hedge Canister","category":"Post / DIT","quantity":1,"unit":"kit",
           "ownership":"owned","vendor":null,"daily_rate":null,"total_cost":null,
           "shoot_day_id":null,"notes":"Run dual-card offload after each setup.","status":"confirmed",
           "created_by":"$USER","created_at":"$NOW","updated_at":"$NOW"}
        ]
        """
        "gear_checkouts" -> """
        [
          {"id":"gc000000-0000-4000-8000-000000000001","gear_id":"gg000000-0000-4000-8000-000000000001",
           "project_id":"$PA","checked_out_by":"$USER",
           "checked_out_by_name":"Erik (1st AC)","checked_out_at":"${day(0, 7)}",
           "returned_at":null,"notes":"Prepping for quay shoot."},
          {"id":"gc000000-0000-4000-8000-000000000002","gear_id":"gg000000-0000-4000-8000-000000000005",
           "project_id":"$PA","checked_out_by":"$USER",
           "checked_out_by_name":"Kari (Boom Op)","checked_out_at":"${day(0, 7)}",
           "returned_at":null,"notes":null}
        ]
        """
        "project_folders" -> """
        [
          {"id":"$FOLDER","project_id":"$PA","name":"Research",
           "parent_id":null,"sort_order":0,"created_by":"$USER","created_at":"$NOW"}
        ]
        """
        "project_documents" -> """
        [
          {"id":"dd000000-0000-4000-8000-000000000001","project_id":"$PA",
           "folder_id":null,"title":"Treatment — v2","document_type":"treatment",
           "content":"A lighthouse keeper's daughter walks a frozen shore and finds a body in the ice.\n\nThe only witness is a man she left behind twenty years ago.\n\nThe Long Winter is a slow-burn thriller set against the absolute isolation of a Norwegian lighthouse station. Shot on 35mm-flavoured digital, it lives in the space between duty and guilt.",
           "is_pinned":true,"last_edited_by":"$USER","created_by":"$USER",
           "created_at":"$NOW","updated_at":"$NOW"},
          {"id":"dd000000-0000-4000-8000-000000000002","project_id":"$PA",
           "folder_id":null,"title":"Director's Notes — Day 4","document_type":"script_notes",
           "content":"The quay scene is the hinge. Everything before this is Maren alone; everything after is Maren and Johan. The transition has to land.\n\nKeep the police launch small in frame until the last moment. Let the audience feel the distance before we close it.\n\nRack focus on 3B — commit to it. If it doesn't work we'll cut around it.",
           "is_pinned":false,"last_edited_by":"$USER","created_by":"$USER",
           "created_at":"$NOW","updated_at":"$NOW"},
          {"id":"dd000000-0000-4000-8000-000000000003","project_id":"$PA",
           "folder_id":"$FOLDER","title":"Lighthouse reference — Slettnes","document_type":"research",
           "content":"Slettnes fyr (71°05'N) — the northernmost mainland lighthouse in the world. Built 1905.\n\nKeeper's quarters are modest. Stone and timber. The lamp room is copper-clad inside.\n\nUseful for set design reference. The proportions of the kitchen and the stairwell are close to what we need.",
           "is_pinned":false,"last_edited_by":"$USER","created_by":"$USER",
           "created_at":"$NOW","updated_at":"$NOW"}
        ]
        """
        else -> "[]"
    }
}
