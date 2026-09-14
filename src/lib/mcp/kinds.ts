/**
 * Every kind of record the MCP server can list, read, create, update and
 * delete through its generic record tools.
 *
 * Screenplay Studio has well over a hundred tables, most of them the same
 * shape: rows that belong to a project. Rather than a hand-written tool per
 * table, each kind is described here once — table, owner, and the columns a
 * client may write — and the record tools in `tools/records.ts` do the rest.
 * Adding a table to the MCP server is adding an entry to this file.
 *
 * The field lists are the security boundary as much as documentation: a
 * client can only write the columns listed. Ownership columns (`project_id`,
 * `created_by`, ...) are never listed; the server sets them from the
 * authenticated user and the project the client has been checked against.
 *
 * Field specs are compact strings:
 *   'text' 'int' 'number' 'bool' 'date' 'datetime' 'time' 'uuid' 'json'
 *   'text[]' 'uuid[]'     — value types
 *   'a|b|c'               — one of these values
 *   trailing '!'          — required when creating
 */

import { randomBytes } from 'crypto';

export type KindScope =
  /** Rows carry a project_id; access follows project membership. */
  | 'project'
  /** Rows belong to the calling user (or to a parent row they own). */
  | 'user'
  /** Site-wide data. Platform admins only. */
  | 'platform';

export type KindGroup =
  | 'story' | 'planning' | 'production' | 'people' | 'documents'
  | 'creator' | 'stage' | 'personal' | 'admin';

export interface RecordKind {
  table: string;
  group: KindGroup;
  about: string;
  scope: KindScope;
  fields: Record<string, string>;
  /** Column that names a row in listings. */
  title: string;
  /** Default ordering; prefix with '-' for descending. */
  order?: string;
  /** Text columns matched by the `query` option of list_records. */
  search?: string[];
  /** Column set to the calling user's id on create. */
  stamp?: string;
  /** For user-scoped kinds: the column holding the owner's id. */
  owner?: string;
  /** For user-scoped kinds owned through a parent row. */
  parent?: { column: string; kind: string };
  primaryKey?: string;
  /** Writes need project owner/admin rather than any editor. */
  manage?: boolean;
  /** Listing and reading only. */
  readOnly?: boolean;
  /** Extra hints per field, shown by describe_kinds. */
  hints?: Record<string, string>;
  /** Values filled in on create when the client left them out. */
  defaults?: () => Record<string, unknown>;
}

const LOCATION_TYPE = 'INT|EXT|INT_EXT|EXT_INT';

export const KINDS: Record<string, RecordKind> = {
  // ── Story ────────────────────────────────────────────────────────────────
  characters: {
    table: 'characters', group: 'story', scope: 'project', title: 'name', order: 'sort_order', stamp: 'created_by',
    about: 'People in the story: bios, arcs, motivations, casting notes.',
    search: ['name', 'full_name', 'description', 'backstory'],
    fields: {
      name: 'text!', full_name: 'text', role: 'text', age: 'text', gender: 'text', description: 'text', backstory: 'text',
      motivation: 'text', arc: 'text', relationships: 'json', appearance: 'text', personality_traits: 'text[]', quirks: 'text',
      voice_notes: 'text', avatar_url: 'text', color: 'text', is_main: 'bool', first_appearance: 'text', cast_actor: 'text',
      cast_notes: 'text', sort_order: 'int', actor_photo_url: 'text', inspo_images: 'json', reference_folders: 'json',
      cast_member_id: 'uuid', stats: 'json', abilities: 'text[]',
    },
    hints: { role: 'protagonist, antagonist, supporting, minor ...', relationships: '[{ character_id, type, description }]', stats: 'Video game stat block, e.g. { "strength": 7 }' },
  },
  locations: {
    table: 'locations', group: 'story', scope: 'project', title: 'name', order: 'name', stamp: 'created_by',
    about: 'Story and shooting locations: address, contacts, permits, logistics.',
    search: ['name', 'description', 'address'],
    fields: {
      name: 'text!', description: 'text', address: 'text', location_type: LOCATION_TYPE, photos: 'text[]', contact_name: 'text',
      contact_phone: 'text', contact_email: 'text', availability_notes: 'text', permits_required: 'bool', permit_notes: 'text',
      parking_info: 'text', power_available: 'bool', sound_notes: 'text', lighting_notes: 'text', cost_per_day: 'number',
      is_confirmed: 'bool', tags: 'text[]',
    },
  },
  scenes: {
    table: 'scenes', group: 'story', scope: 'project', title: 'scene_heading', order: 'sort_order', stamp: 'created_by',
    about: 'Scene breakdown rows (corkboard cards): synopsis, cast, props, costumes, SFX, VFX, stunts. Use sync_scenes to create them from a script.',
    search: ['scene_heading', 'synopsis', 'notes', 'location_name'],
    fields: {
      script_id: 'uuid', script_element_id: 'uuid', scene_number: 'text', scene_heading: 'text', location_type: LOCATION_TYPE,
      location_name: 'text', time_of_day: 'text', synopsis: 'text', page_count: 'number', estimated_duration_minutes: 'int',
      shooting_duration_minutes: 'int', location_id: 'uuid', cast_ids: 'uuid[]', extras_count: 'int', props: 'text[]',
      costumes: 'text[]', makeup_notes: 'text', special_effects: 'text[]', stunts: 'text', vehicles: 'text[]', animals: 'text[]',
      sound_notes: 'text', music_cues: 'text[]', vfx_notes: 'text', mood: 'text', weather_required: 'text',
      special_equipment: 'text[]', notes: 'text', is_completed: 'bool', sort_order: 'int', color: 'text',
    },
    hints: { cast_ids: 'Character ids appearing in the scene', script_element_id: 'The scene_heading element this row mirrors' },
  },
  seasons: {
    table: 'series_seasons', group: 'story', scope: 'project', title: 'title', order: 'sort_order',
    about: 'Seasons of an episodic project. Episodes are scripts with metadata.episode_season.',
    fields: { season_number: 'int!', title: 'text', logline: 'text', synopsis: 'text', color: 'text', sort_order: 'int' },
  },
  treatment: {
    table: 'treatment', group: 'story', scope: 'project', title: 'logline', stamp: 'created_by',
    about: 'The prose treatment / series bible. One row per project.',
    search: ['logline', 'premise', 'synopsis'],
    fields: {
      logline: 'text', tagline: 'text', premise: 'text', theme: 'text', tone: 'text', genre: 'text', format: 'text',
      budget_level: 'text', world: 'text', rules_of_world: 'text', atmosphere: 'text', visual_style: 'text', synopsis: 'text',
      episode_breakdown: 'json', character_arcs: 'json', timeline: 'json', plot_threads: 'json', custom_sections: 'json',
      market_context: 'text', comparable_titles: 'text', writer_bio: 'text', notes: 'text',
    },
  },
  world_entities: {
    table: 'world_entities', group: 'story', scope: 'project', title: 'name', order: 'name', stamp: 'created_by',
    about: 'Worldbuilding wiki entries: lore, factions, magic systems, species, items, events.',
    search: ['name', 'content'],
    fields: {
      name: 'text!', category: 'lore|faction|location|magic|species|item|event|character|other', content: 'text',
      properties: 'json', tags: 'text[]', avatar_url: 'text', color: 'text', parent_id: 'uuid',
    },
  },
  world_relationships: {
    table: 'world_entity_relationships', group: 'story', scope: 'project', title: 'relationship_type',
    about: 'Links between worldbuilding entries (e.g. faction "rules" location).',
    fields: { source_id: 'uuid!', target_id: 'uuid!', relationship_type: 'text!', description: 'text' },
  },

  // ── Planning & mapping ───────────────────────────────────────────────────
  ideas: {
    table: 'ideas', group: 'planning', scope: 'project', title: 'title', order: 'column_order', stamp: 'created_by',
    about: 'The project ideas board: sparks that develop into story material.',
    search: ['title', 'description'],
    fields: {
      title: 'text!', description: 'text',
      category: 'plot|character|dialogue|visual|sound|location|prop|costume|effect|theme|other',
      status: 'spark|developing|ready|used|discarded', priority: 'int', tags: 'text[]', references: 'text[]',
      attachments: 'text[]', color: 'text', column_order: 'int', assigned_to: 'uuid', image_url: 'text',
      linked_scene_ids: 'uuid[]', linked_character_ids: 'uuid[]',
    },
  },
  mindmap_nodes: {
    table: 'mindmap_nodes', group: 'planning', scope: 'project', title: 'label', stamp: 'created_by',
    about: 'Nodes on the project mind map canvas.',
    search: ['label', 'notes'],
    fields: {
      label: 'text!', node_type: 'text', character_id: 'uuid', x: 'number', y: 'number', width: 'number', height: 'number',
      color: 'text', shape: 'text', font_size: 'int', image_url: 'text', notes: 'text', group_id: 'uuid', is_locked: 'bool', z_index: 'int',
    },
    hints: { node_type: 'character, group or note', shape: 'rounded, circle, diamond or rectangle', x: 'Canvas position; space nodes ~220px apart' },
    defaults: () => ({ x: 0, y: 0 }),
  },
  mindmap_edges: {
    table: 'mindmap_edges', group: 'planning', scope: 'project', title: 'label', stamp: 'created_by',
    about: 'Connections between mind map nodes.',
    fields: {
      source_node_id: 'uuid!', target_node_id: 'uuid!', label: 'text', color: 'text', line_style: 'solid|dashed|dotted',
      thickness: 'int', arrow_type: 'text', animated: 'bool', notes: 'text',
    },
  },
  moodboard_items: {
    table: 'mood_board_items', group: 'planning', scope: 'project', title: 'title', stamp: 'created_by',
    about: 'Mood board cards: images, notes, links, colour swatches.',
    search: ['title', 'content'],
    fields: {
      item_type: 'text', title: 'text', content: 'text', image_url: 'text', link_url: 'text', color: 'text', x: 'number',
      y: 'number', width: 'number', height: 'number', rotation: 'number', z_index: 'int', opacity: 'number', tags: 'text[]',
      board_section: 'text',
    },
    hints: { item_type: 'image, note, link or color' },
    defaults: () => ({ x: 0, y: 0, width: 240, height: 180 }),
  },
  moodboard_connections: {
    table: 'mood_board_connections', group: 'planning', scope: 'project', title: 'label', stamp: 'created_by',
    about: 'Lines between mood board items.',
    fields: { source_item_id: 'uuid!', target_item_id: 'uuid!', label: 'text', color: 'text', line_style: 'solid|dashed|dotted' },
  },
  map_markers: {
    table: 'location_markers', group: 'planning', scope: 'project', title: 'name', stamp: 'created_by',
    about: 'Pins on the project location map.',
    fields: {
      name: 'text!', lat: 'number!', lng: 'number!', description: 'text', marker_type: 'text', location_id: 'uuid',
      location_ids: 'uuid[]', color: 'text', icon: 'text', tags: 'json',
    },
  },
  map_routes: {
    table: 'location_routes', group: 'planning', scope: 'project', title: 'name', stamp: 'created_by',
    about: 'Routes drawn on the location map (unit moves, travel).',
    fields: { name: 'text!', route_type: 'text', color: 'text', coordinates: 'json', notes: 'text' },
    hints: { coordinates: '[[lat, lng], [lat, lng], ...]' },
  },

  // ── Development ──────────────────────────────────────────────────────────
  notes_rounds: {
    table: 'script_notes_rounds', group: 'documents', scope: 'project', title: 'title', order: 'round_number', stamp: 'created_by',
    about: 'A round of development notes (e.g. "Studio notes, draft 2").',
    fields: { title: 'text!', script_id: 'uuid', status: 'open|in_progress|closed', round_number: 'int', notes_from: 'text', due_date: 'date' },
  },
  notes: {
    table: 'script_notes', group: 'documents', scope: 'project', title: 'content', stamp: 'created_by',
    about: 'Individual notes within a notes round.',
    search: ['content'],
    fields: {
      round_id: 'uuid!', content: 'text!', category: 'story|character|dialogue|structure|format|general', scene_ref: 'text',
      page_ref: 'text', status: 'open|addressed|deferred|rejected', assigned_to: 'uuid',
    },
  },
  coverage: {
    table: 'script_coverage', group: 'documents', scope: 'project', title: 'script_title', order: '-created_at', stamp: 'created_by',
    about: 'Script coverage reports with grades and a recommendation.',
    fields: {
      reader_name: 'text', script_title: 'text', draft_date: 'date', logline: 'text', short_synopsis: 'text', full_synopsis: 'text',
      grade_premise: 'text', grade_structure: 'text', grade_dialogue: 'text', grade_characters: 'text', grade_theme: 'text',
      grade_pacing: 'text', grade_originality: 'text', recommendation: 'pass|consider|recommend', comments: 'text',
    },
    hints: { grade_premise: 'excellent, good, fair or poor' },
  },
  submissions: {
    table: 'script_submissions', group: 'documents', scope: 'project', title: 'recipient_name', order: '-date_sent', stamp: 'created_by',
    about: 'Submission tracker: agents, managers, festivals, production companies.',
    fields: {
      recipient_name: 'text!', recipient_type: 'text', script_id: 'uuid', date_sent: 'date', status: 'text', notes: 'text',
      response_date: 'date', next_follow_up: 'date',
    },
  },
  documents: {
    table: 'project_documents', group: 'documents', scope: 'project', title: 'title', order: '-updated_at', stamp: 'created_by',
    about: 'Free-form project documents: notes, outlines, research, treatments.',
    search: ['title', 'content'],
    fields: {
      title: 'text!', content: 'text', doc_type: 'plain_text|notes|outline|treatment|research', folder_id: 'uuid',
      is_pinned: 'bool', tags: 'text[]', metadata: 'json',
    },
  },
  document_folders: {
    table: 'project_folders', group: 'documents', scope: 'project', title: 'name', order: 'sort_order', stamp: 'created_by',
    about: 'Folders for project documents.',
    fields: { name: 'text!', parent_folder_id: 'uuid', color: 'text', sort_order: 'int' },
  },
  comments: {
    table: 'comments', group: 'documents', scope: 'project', title: 'content', order: '-created_at', stamp: 'created_by',
    about: 'Comments attached to anything in a project (entity_type + entity_id).',
    search: ['content'],
    fields: {
      entity_type: 'text!', entity_id: 'uuid!', content: 'text!', parent_id: 'uuid',
      comment_type: 'note|suggestion|issue|resolved', is_resolved: 'bool',
    },
    hints: { entity_type: 'script_element, scene, character, location, shot, ...' },
  },

  // ── Production ───────────────────────────────────────────────────────────
  shots: {
    table: 'shots', group: 'production', scope: 'project', title: 'shot_number', order: 'sort_order', stamp: 'created_by',
    about: 'Shot list: shot type, movement, lens, notes, takes.',
    search: ['description', 'camera_notes'],
    fields: {
      scene_id: 'uuid', shot_number: 'text', description: 'text',
      shot_type: 'wide|full|medium_wide|medium|medium_close|close_up|extreme_close|over_shoulder|two_shot|pov|aerial|insert|cutaway|establishing|tracking|dolly|crane|steadicam|handheld|static|dutch_angle',
      shot_movement: 'static|pan_left|pan_right|tilt_up|tilt_down|dolly_in|dolly_out|truck_left|truck_right|crane_up|crane_down|zoom_in|zoom_out|follow|orbit|whip_pan|rack_focus',
      lens: 'text', dialogue_ref: 'text', duration_seconds: 'int', camera_notes: 'text', lighting_notes: 'text', sound_notes: 'text',
      vfx_required: 'bool', vfx_notes: 'text', storyboard_url: 'text', reference_urls: 'text[]', is_completed: 'bool',
      takes_needed: 'int', takes_completed: 'int', sort_order: 'int', storyboard_notes: 'text',
    },
  },
  storyboard: {
    table: 'storyboard_frames', group: 'production', scope: 'project', title: 'title', order: 'sort_order', stamp: 'created_by',
    about: 'Storyboard frames, optionally tied to a shot or scene.',
    fields: {
      title: 'text!', shot_id: 'uuid', scene_id: 'uuid', sort_order: 'int', image_url: 'text', reference_images: 'json',
      notes: 'text', duration_hint: 'text', camera_notes: 'text',
    },
  },
  schedule: {
    table: 'production_schedule', group: 'production', scope: 'project', title: 'title', order: 'start_time', stamp: 'created_by',
    about: 'Calendar events: shooting, rehearsals, scouts, meetings, travel.',
    search: ['title', 'description', 'notes'],
    fields: {
      title: 'text!', start_time: 'datetime!', end_time: 'datetime!', description: 'text',
      event_type: 'shooting|rehearsal|location_scout|meeting|setup|wrap|travel|break|other', all_day: 'bool',
      scene_ids: 'uuid[]', location_id: 'uuid', assigned_to: 'uuid[]', call_time: 'datetime', wrap_time: 'datetime',
      notes: 'text', color: 'text', is_confirmed: 'bool', weather_backup_plan: 'text',
    },
  },
  shoot_days: {
    table: 'shoot_days', group: 'production', scope: 'project', title: 'title', order: 'day_number', stamp: 'created_by',
    about: 'Shooting days (stripboard days). Add scenes and cast with shoot_day_scenes / shoot_day_cast.',
    fields: {
      day_number: 'int!', shoot_date: 'date', title: 'text', call_time: 'time', wrap_time: 'time', location: 'text',
      notes: 'text', status: 'planned|confirmed|completed|cancelled',
    },
  },
  shoot_day_scenes: {
    table: 'shoot_day_scenes', group: 'production', scope: 'project', title: 'scene_heading', order: 'sort_order',
    about: 'Scenes scheduled on a shoot day.',
    fields: {
      shoot_day_id: 'uuid!', scene_heading: 'text!', scene_element_id: 'uuid', scene_number: 'text', script_id: 'uuid',
      estimated_pages: 'number', sort_order: 'int', notes: 'text',
    },
  },
  shoot_day_cast: {
    table: 'shoot_day_cast', group: 'production', scope: 'project', title: 'character_name', order: 'sort_order',
    about: 'Cast calls on a shoot day.',
    fields: {
      shoot_day_id: 'uuid!', character_name: 'text!', actor_name: 'text', call_time: 'time', on_set_time: 'time',
      makeup_call: 'time', notes: 'text', sort_order: 'int',
    },
  },
  call_sheets: {
    table: 'call_sheets', group: 'production', scope: 'project', title: 'title', order: 'shoot_date', stamp: 'created_by',
    about: 'Daily call sheets.',
    fields: {
      shoot_date: 'date!', title: 'text', general_call: 'time', base_camp: 'text', nearest_hospital: 'text', parking: 'text',
      weather_note: 'text', scenes_today: 'text[]', crew_calls: 'json', advanced_schedule: 'json', general_notes: 'text',
      is_published: 'bool',
    },
    hints: { crew_calls: '[{ name, role, call_time }]' },
  },
  budget: {
    table: 'budget_items', group: 'production', scope: 'project', title: 'description', order: 'sort_order', stamp: 'created_by',
    about: 'Budget line items: estimated vs actual, vendors, invoices.',
    search: ['description', 'vendor', 'notes'],
    fields: {
      description: 'text!',
      category: 'above_the_line|below_the_line|production|post_production|talent|locations|equipment|props_costumes|catering|transportation|insurance|marketing|contingency|other',
      subcategory: 'text', estimated_amount: 'number', actual_amount: 'number', quantity: 'int', unit_cost: 'number',
      vendor: 'text', invoice_ref: 'text', is_income: 'bool', is_paid: 'bool', due_date: 'date', notes: 'text', sort_order: 'int',
    },
  },
  gear: {
    table: 'shoot_gear', group: 'production', scope: 'project', title: 'name', order: 'category', stamp: 'created_by',
    about: 'Equipment list: cameras, lenses, grip, lighting, rentals.',
    fields: {
      name: 'text!', category: 'text', quantity: 'int', unit: 'text', ownership: 'owned|rented|provided|tbc', vendor: 'text',
      daily_rate: 'number', total_cost: 'number', shoot_day_id: 'uuid', notes: 'text', status: 'confirmed|pending|cancelled',
    },
  },
  continuity: {
    table: 'continuity_entries', group: 'production', scope: 'project', title: 'character_name',
    about: 'Continuity log per scene and character: costume, hair, makeup, props, wounds.',
    fields: {
      scene_id: 'uuid', character_id: 'uuid', character_name: 'text', scene_label: 'text', costume: 'text', hair: 'text',
      makeup: 'text', props: 'text', wounds: 'text', notes: 'text', image_url: 'text',
    },
  },
  day_out_of_days: {
    table: 'dood_entries', group: 'production', scope: 'project', title: 'character_name', order: 'shoot_date',
    about: 'Day Out of Days: which character works which date.',
    fields: { character_name: 'text!', shoot_date: 'date!', character_id: 'uuid', status: 'SW|W|WF|SWF|H|T|F', notes: 'text' },
    hints: { status: 'SW start-work, W work, WF work-finish, SWF start-work-finish, H hold, T travel, F fitting' },
  },
  safety: {
    table: 'safety_plan_items', group: 'production', scope: 'project', title: 'description', stamp: 'created_by',
    about: 'On-set safety plan: risks, mitigations, sign-off.',
    fields: {
      description: 'text!', scene_id: 'uuid', scene_label: 'text',
      category: 'stunt|pyrotechnics|heights|vehicles|water|animals|hazmat|electrical|weather|crowd|general',
      risk_level: 'low|medium|high|critical', mitigation: 'text', responsible_dept: 'text', responsible_person: 'text',
      signed_off_by: 'text', signed_off_at: 'datetime', is_cleared: 'bool', notes: 'text',
    },
  },
  camera_reports: {
    table: 'camera_reports', group: 'production', scope: 'project', title: 'roll_number', order: '-report_date', stamp: 'created_by',
    about: 'Camera and sound reports.',
    fields: {
      report_type: 'camera|sound', report_date: 'date', roll_number: 'text', magazine: 'text', stock: 'text', camera_id: 'text',
      takes: 'json', sound_takes: 'json', operator: 'text', loader: 'text', general_notes: 'text',
    },
  },
  table_reads: {
    table: 'table_read_sessions', group: 'production', scope: 'project', title: 'session_name', order: '-session_date', stamp: 'created_by',
    about: 'Timed table read sessions.',
    fields: { session_name: 'text!', session_date: 'date', total_seconds: 'int', scene_timings: 'json', notes: 'text' },
  },
  pro_tool_records: {
    table: 'pro_tool_records', group: 'production', scope: 'project', title: 'title', order: 'sort_order', stamp: 'created_by',
    about: 'Rows in the Pro tool suite (accounting, clearances, deliverables, ...). Call describe_kinds with kind "pro_tool_records" to see every tool and its fields.',
    search: ['title'],
    fields: { tool: 'text!', title: 'text!', status: 'text', data: 'json', sort_order: 'int' },
    hints: { tool: 'A Pro tool slug, e.g. accounting', data: "Field values keyed by the tool's field keys" },
    defaults: () => ({ data: {} }),
  },

  // ── People ───────────────────────────────────────────────────────────────
  cast: {
    table: 'cast_members', group: 'people', scope: 'project', title: 'name', order: 'name', stamp: 'created_by',
    about: 'Actors: contact, availability, pay, contract status.',
    search: ['name', 'bio', 'notes'],
    fields: {
      name: 'text!', character_roles: 'text[]', email: 'text', phone: 'text', photo_url: 'text', bio: 'text', notes: 'text',
      availability: 'text', pay_amount: 'number', pay_unit: 'text', pay_currency: 'text', contract_status: 'text', metadata: 'json',
    },
  },
  cast_documents: {
    table: 'cast_documents', group: 'people', scope: 'project', title: 'title', stamp: 'created_by',
    about: 'Contracts, releases and other documents for a cast member.',
    fields: { cast_member_id: 'uuid!', title: 'text!', doc_type: 'text', file_url: 'text', file_name: 'text', notes: 'text', expires_at: 'date' },
  },
  credits: {
    table: 'external_credits', group: 'people', scope: 'project', title: 'name',
    about: 'Credits for people who are not Screenplay Studio users.',
    fields: { name: 'text!', production_role: 'text!', character_name: 'text', external_url: 'text', avatar_url: 'text' },
  },
  share_links: {
    table: 'project_share_links', group: 'people', scope: 'project', title: 'name', order: '-created_at', stamp: 'created_by', manage: true,
    about: 'Read-only share links and invite links. The token is generated for you; the link is {site}/share/{token}.',
    fields: {
      name: 'text!', script_id: 'uuid', can_view_script: 'bool', can_view_characters: 'bool', can_view_scenes: 'bool',
      can_view_schedule: 'bool', can_view_documents: 'bool', can_view_notes: 'bool', can_edit_notes: 'bool', is_invite: 'bool',
      invite_role: 'viewer|commenter|editor', is_active: 'bool', expires_at: 'datetime',
    },
    defaults: () => ({ token: randomBytes(24).toString('base64url') }),
  },
  channels: {
    table: 'project_channels', group: 'people', scope: 'project', title: 'name', order: 'sort_order', stamp: 'created_by', manage: true,
    about: 'Project chat channels. Read and post messages with read_messages / send_message.',
    fields: { name: 'text!', description: 'text', is_default: 'bool', sort_order: 'int' },
  },

  // ── Stage ────────────────────────────────────────────────────────────────
  stage_cues: {
    table: 'stage_cues', group: 'stage', scope: 'project', title: 'cue_number', order: 'sort_order', stamp: 'created_by',
    about: 'Lighting, sound and other cues for a stage production.',
    fields: {
      cue_type: 'lighting|sound|music|follow_spot|special_effect|automation|video!', cue_number: 'text!', description: 'text',
      act_number: 'int', scene_ref: 'text', script_element_id: 'uuid', timing_note: 'text', duration_note: 'text',
      operator: 'text', notes: 'text', sort_order: 'int',
    },
  },
  ensemble: {
    table: 'stage_ensemble_members', group: 'stage', scope: 'project', title: 'actor_name', order: 'sort_order',
    about: 'Stage company: principals, ensemble, understudies, swings.',
    fields: {
      actor_name: 'text!', actor_user_id: 'uuid', character_name: 'text',
      ensemble_group: 'Principal|Ensemble|Understudy|Dance Captain|Swing|Alternate|Other', vocal_range: 'text',
      dance_skills: 'text[]', availability: 'text', contact_email: 'text', notes: 'text', sort_order: 'int',
    },
  },
  production_team: {
    table: 'stage_production_team', group: 'stage', scope: 'project', title: 'name', order: 'sort_order',
    about: 'Stage production team: director, stage manager, designers.',
    fields: {
      name: 'text!', role: 'text!', user_id: 'uuid',
      department: 'Direction|Stage Management|Lighting|Sound|Musical Direction|Choreography|Design|Technical|Marketing|Other',
      contact_email: 'text', phone: 'text', notes: 'text', sort_order: 'int',
    },
  },

  // ── Content creator ──────────────────────────────────────────────────────
  thumbnails: {
    table: 'thumbnails', group: 'creator', scope: 'project', title: 'title', order: 'sort_order',
    about: 'Thumbnail concepts and A/B variants.',
    fields: {
      title: 'text!', image_url: 'text', is_primary: 'bool', text_overlay: 'text', font_style: 'text', color_scheme: 'text[]',
      notes: 'text', a_b_test_group: 'text', click_rate: 'number', impressions: 'int', clicks: 'int', sort_order: 'int',
    },
  },
  video_seo: {
    table: 'video_seo', group: 'creator', scope: 'project', title: 'video_title',
    about: 'Video title, description, tags and publishing metadata.',
    fields: {
      video_title: 'text', video_description: 'text', tags: 'text[]', category: 'text', default_language: 'text',
      target_keywords: 'text[]', hashtags: 'text[]', end_screen_elements: 'json', cards: 'json', publish_date: 'datetime',
      visibility: 'public|unlisted|private|scheduled', made_for_kids: 'bool', age_restricted: 'bool',
    },
  },
  broll: {
    table: 'broll_items', group: 'creator', scope: 'project', title: 'description', order: 'sort_order',
    about: 'B-roll needed for a video.',
    fields: {
      description: 'text!', scene_id: 'uuid', source: 'text', source_url: 'text', duration_seconds: 'int',
      timestamp_start: 'int', timestamp_end: 'int', status: 'needed|found|filmed|edited', notes: 'text', tags: 'text[]', sort_order: 'int',
    },
  },
  sponsors: {
    table: 'sponsor_segments', group: 'creator', scope: 'project', title: 'sponsor_name', order: 'sort_order',
    about: 'Sponsor reads and deliverables.',
    fields: {
      sponsor_name: 'text!', segment_type: 'pre_roll|mid_roll|post_roll|integration', start_time: 'int', end_time: 'int',
      script_text: 'text', talking_points: 'text[]', cta_link: 'text', promo_code: 'text', payment_amount: 'number',
      payment_status: 'text', due_date: 'date', notes: 'text', is_disclosed: 'bool', sort_order: 'int',
    },
  },
  hooks: {
    table: 'content_hooks', group: 'creator', scope: 'project', title: 'content', order: 'sort_order',
    about: 'Opening hooks, intros, CTAs and outros.',
    fields: {
      hook_type: 'opening_hook|intro|cta|outro|transition!', content: 'text!', duration_seconds: 'int', timestamp: 'int',
      notes: 'text', is_template: 'bool', sort_order: 'int',
    },
  },
  chapters: {
    table: 'video_chapters', group: 'creator', scope: 'project', title: 'title', order: 'timestamp',
    about: 'Video chapter markers.',
    fields: { title: 'text!', timestamp: 'int!', description: 'text', sort_order: 'int' },
    hints: { timestamp: 'Seconds from the start' },
  },
  upload_checklist: {
    table: 'upload_checklist', group: 'creator', scope: 'project', title: 'item_text', order: 'sort_order',
    about: 'Pre-publish checklist for a video.',
    fields: { item_text: 'text!', is_completed: 'bool', category: 'text', sort_order: 'int', completed_at: 'datetime' },
  },

  // ── Personal ─────────────────────────────────────────────────────────────
  idea_boards: {
    table: 'idea_boards', group: 'personal', scope: 'user', owner: 'owner_id', title: 'title', order: '-updated_at',
    about: 'Your personal idea boards (outside any project).',
    search: ['title', 'description'],
    fields: {
      title: 'text!', description: 'text', emoji: 'text', color: 'text', linked_project_id: 'uuid', is_archived: 'bool',
      parent_id: 'uuid', root_board_id: 'uuid',
    },
  },
  idea_nodes: {
    table: 'idea_nodes', group: 'personal', scope: 'user', parent: { column: 'board_id', kind: 'idea_boards' },
    title: 'type', order: 'sort_order', stamp: 'created_by',
    about: 'Blocks on one of your idea boards. Filter by board_id when listing.',
    fields: { board_id: 'uuid!', type: 'text', content: 'json!', sort_order: 'number' },
    hints: { type: 'text, heading, todo, image, link, ...', content: 'e.g. { "text": "..." }' },
  },
  work_logs: {
    table: 'work_logs', group: 'personal', scope: 'user', owner: 'user_id', title: 'log_date', order: '-log_date',
    about: 'Your writing log (pages, words, minutes per day). Feeds streaks and accountability.',
    fields: {
      log_date: 'date!', pages_written: 'number', scenes_created: 'int', words_written: 'int',
      session_minutes: 'int', manual_note: 'text', is_manual: 'bool',
    },
    defaults: () => ({ is_manual: true, pages_written: 0, scenes_created: 0, words_written: 0, session_minutes: 0 }),
  },
  notifications: {
    table: 'notifications', group: 'personal', scope: 'user', owner: 'user_id', title: 'title', order: '-created_at',
    about: 'Your notifications. Update `read` to mark them read.',
    fields: { read: 'bool', acted_on: 'bool' },
  },

  // ── Platform administration ──────────────────────────────────────────────
  feedback: {
    table: 'feedback_items', group: 'admin', scope: 'platform', title: 'title', order: '-created_at',
    about: 'Bug reports, feature requests and testimonials from users.',
    search: ['title', 'body'],
    fields: {
      type: 'bug_report|feature_request|testimonial|other!', title: 'text!', body: 'text!', status: 'text', priority: 'text',
      admin_note: 'text', is_approved: 'bool', is_public: 'bool', show_author_name: 'bool', linked_changelog_id: 'uuid', tags: 'text[]',
    },
  },
  support_tickets: {
    table: 'support_tickets', group: 'admin', scope: 'platform', title: 'subject', order: '-created_at',
    about: 'Support tickets. Reply with admin_reply_ticket.',
    search: ['subject'],
    fields: { status: 'open|in_progress|resolved|closed', priority: 'low|normal|high|urgent', category: 'text' },
  },
  ticket_messages: {
    table: 'ticket_messages', group: 'admin', scope: 'platform', title: 'content', order: 'created_at', readOnly: true,
    about: 'Messages on support tickets. Filter by ticket_id.',
    fields: {},
  },
  content_reports: {
    table: 'content_reports', group: 'admin', scope: 'platform', title: 'reason', order: '-created_at',
    about: 'User reports about content.',
    fields: { status: 'pending|reviewing|resolved|dismissed', resolution_notes: 'text', resolved_at: 'datetime' },
  },
  content_flags: {
    table: 'content_flags', group: 'admin', scope: 'platform', title: 'status', order: '-created_at', readOnly: true,
    about: 'Automod flags. Act on users with admin_moderate_user.',
    fields: {},
  },
  site_settings: {
    table: 'site_settings', group: 'admin', scope: 'platform', title: 'key', order: 'key', primaryKey: 'key',
    about: 'Key/value site settings (announcement banner, site_version, toggles).',
    fields: { key: 'text!', value: 'text!' },
  },
  feature_flags: {
    table: 'feature_flags', group: 'admin', scope: 'platform', title: 'name', order: 'key',
    about: 'Feature rollout tiers (alpha, beta, released, disabled).',
    fields: { key: 'text!', name: 'text!', description: 'text', tier: 'alpha|beta|released|disabled', category: 'text' },
  },
  changelog_releases: {
    table: 'changelog_releases', group: 'admin', scope: 'platform', title: 'version', order: '-created_at',
    about: 'Changelog releases. Set status "published" to ship one.',
    fields: {
      version: 'text!', title: 'text!', summary: 'text', release_type: 'text', status: 'draft|published|yanked',
      released_at: 'datetime', blog_post_slug: 'text',
    },
  },
  changelog_entries: {
    table: 'changelog_entries', group: 'admin', scope: 'platform', title: 'title', order: 'sort_order',
    about: 'Lines within a changelog release.',
    fields: {
      release_id: 'uuid!', title: 'text!', description: 'text',
      entry_type: 'feature|improvement|fix|performance|security|breaking|deprecation|internal!',
      area: 'editor|scripts|scenes|characters|locations|production|schedule|cast|budget|gear|storyboard|community|challenges|courses|gamification|collaboration|documents|versioning|formats|arc_planner|work_tracking|festival|blog|admin|auth|database|performance|api|ui!',
      is_public: 'bool', link_url: 'text', pr_number: 'int', sort_order: 'int',
    },
  },
  blog_posts: {
    table: 'blog_posts', group: 'admin', scope: 'platform', title: 'title', order: '-created_at', stamp: 'author_id',
    about: 'Blog posts. `sections` is an array of { heading?, body } blocks.',
    search: ['title', 'excerpt'],
    fields: {
      slug: 'text!', title: 'text!', excerpt: 'text', cover_image_url: 'text', sections: 'json', tags: 'text[]',
      status: 'draft|published|archived', published_at: 'datetime', allow_comments: 'bool',
    },
  },
  badges: {
    table: 'badges', group: 'admin', scope: 'platform', title: 'name', order: 'name', stamp: 'created_by',
    about: 'Profile badges that can be awarded to users.',
    fields: { name: 'text!', description: 'text', emoji: 'text', color: 'text', is_system: 'bool', system_role: 'text' },
  },
  user_badges: {
    table: 'user_badges', group: 'admin', scope: 'platform', title: 'badge_id', order: '-awarded_at', stamp: 'awarded_by',
    about: 'Badges awarded to users.',
    fields: { user_id: 'uuid!', badge_id: 'uuid!', display_slot: 'int' },
  },
  challenges: {
    table: 'community_challenges', group: 'admin', scope: 'platform', title: 'title', order: '-starts_at', stamp: 'created_by',
    about: 'Community writing challenges.',
    fields: {
      title: 'text!', description: 'text!', theme_id: 'uuid', challenge_type: 'weekly|custom', starts_at: 'datetime!',
      submissions_close_at: 'datetime!', voting_close_at: 'datetime!', reveal_at: 'datetime!', prize_title: 'text',
      prize_description: 'text', prize_data: 'json', week_number: 'int', year: 'int', is_featured: 'bool',
    },
  },
  user_bans: {
    table: 'user_bans', group: 'admin', scope: 'platform', title: 'reason', order: '-created_at', readOnly: true,
    about: 'Warnings, suspensions and bans. Change them with admin_moderate_user.',
    fields: {},
  },
  subscriptions: {
    table: 'subscriptions', group: 'admin', scope: 'platform', title: 'plan', order: '-created_at', readOnly: true,
    about: 'Pro subscriptions.',
    fields: {},
  },
  donations: {
    table: 'donations', group: 'admin', scope: 'platform', title: 'email', order: '-created_at', readOnly: true,
    about: 'Ko-Fi donations.',
    fields: {},
  },
  audit_log: {
    table: 'audit_log', group: 'admin', scope: 'platform', title: 'action', order: '-created_at', readOnly: true,
    about: 'Audit trail of sensitive actions, including everything done over MCP.',
    fields: {},
  },
};

export type KindName = keyof typeof KINDS;

export interface FieldSpec {
  type: string;
  required: boolean;
  options?: string[];
}

export function parseField(spec: string): FieldSpec {
  const required = spec.endsWith('!');
  const type = required ? spec.slice(0, -1) : spec;
  if (type.includes('|')) return { type: 'enum', required, options: type.split('|') };
  return { type, required };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function checkValue(field: string, spec: FieldSpec, value: unknown): string | null {
  if (value === null) return spec.required ? `${field} cannot be null` : null;
  switch (spec.type) {
    case 'text': return typeof value === 'string' ? null : `${field} must be text`;
    case 'int': return Number.isInteger(value) ? null : `${field} must be a whole number`;
    case 'number': return typeof value === 'number' && !Number.isNaN(value) ? null : `${field} must be a number`;
    case 'bool': return typeof value === 'boolean' ? null : `${field} must be true or false`;
    case 'uuid': return isUuid(value) ? null : `${field} must be a uuid`;
    case 'date': return typeof value === 'string' && DATE_RE.test(value) ? null : `${field} must be a date like 2026-03-01`;
    case 'time': return typeof value === 'string' && TIME_RE.test(value) ? null : `${field} must be a time like 07:30`;
    case 'datetime':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? null : `${field} must be an ISO date-time like 2026-03-01T07:30:00Z`;
    case 'text[]':
      return Array.isArray(value) && value.every((v) => typeof v === 'string') ? null : `${field} must be a list of text`;
    case 'uuid[]':
      return Array.isArray(value) && value.every(isUuid) ? null : `${field} must be a list of uuids`;
    case 'enum':
      return spec.options!.includes(value as string) ? null : `${field} must be one of: ${spec.options!.join(', ')}`;
    case 'json': return null;
    default: return null;
  }
}

/**
 * Checks client-supplied values against a kind's writable fields.
 * Unknown or protected columns are an error rather than silently dropped,
 * so a typo does not look like a successful write.
 */
export function cleanRecord(
  kind: RecordKind,
  data: Record<string, unknown>,
  mode: 'create' | 'update',
): { values: Record<string, unknown>; errors: string[] } {
  const values: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const [field, value] of Object.entries(data)) {
    const raw = kind.fields[field];
    if (!raw) {
      errors.push(`"${field}" is not a writable field of ${kind.table}`);
      continue;
    }
    const problem = checkValue(field, parseField(raw), value);
    if (problem) errors.push(problem);
    else values[field] = value;
  }

  if (mode === 'create') {
    for (const [field, raw] of Object.entries(kind.fields)) {
      if (parseField(raw).required && (data[field] === undefined || data[field] === null)) {
        errors.push(`${field} is required`);
      }
    }
  } else if (Object.keys(data).length === 0) {
    errors.push('nothing to update');
  }

  return { values, errors };
}

/** Columns a filter may reference: writable fields plus the standard ones. */
export function filterableColumns(kind: RecordKind): Set<string> {
  const cols = new Set(Object.keys(kind.fields));
  cols.add(kind.primaryKey ?? 'id');
  if (kind.scope === 'project') cols.add('project_id');
  if (kind.stamp) cols.add(kind.stamp);
  if (kind.parent) cols.add(kind.parent.column);
  cols.add('created_at');
  cols.add('updated_at');
  return cols;
}

export const FILTER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'contains', 'is'] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export interface ParsedFilter {
  column: string;
  op: FilterOp;
  value: unknown;
}

/**
 * Turns `{ status: "open", priority: { gte: 2 }, tags: { contains: ["x"] } }`
 * into a flat list of column/operator/value triples.
 *
 * Platform kinds hold arbitrary columns that are not all listed as writable,
 * so they accept any column name that looks like one.
 */
export function parseFilter(kind: RecordKind, filter: Record<string, unknown>): { filters: ParsedFilter[]; errors: string[] } {
  const filters: ParsedFilter[] = [];
  const errors: string[] = [];
  const allowed = filterableColumns(kind);

  for (const [column, condition] of Object.entries(filter)) {
    const columnOk = kind.scope === 'platform' ? /^[a-z_][a-z0-9_]*$/.test(column) : allowed.has(column);
    if (!columnOk) {
      errors.push(`cannot filter ${kind.table} by "${column}"`);
      continue;
    }

    if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
      for (const [op, value] of Object.entries(condition)) {
        if (!(FILTER_OPS as readonly string[]).includes(op)) {
          errors.push(`unknown filter operator "${op}" on ${column} (use ${FILTER_OPS.join(', ')})`);
        } else {
          filters.push({ column, op: op as FilterOp, value });
        }
      }
    } else if (Array.isArray(condition)) {
      filters.push({ column, op: 'in', value: condition });
    } else if (condition === null) {
      filters.push({ column, op: 'is', value: null });
    } else {
      filters.push({ column, op: 'eq', value: condition });
    }
  }

  return { filters, errors };
}

/** A human/Claude readable description of a kind's fields. */
export function describeFields(kind: RecordKind): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, raw] of Object.entries(kind.fields)) {
    const spec = parseField(raw);
    let text = spec.type === 'enum' ? `one of ${spec.options!.join(' | ')}` : spec.type;
    if (spec.required) text += ' (required)';
    if (kind.hints?.[field]) text += ` — ${kind.hints[field]}`;
    out[field] = text;
  }
  return out;
}
