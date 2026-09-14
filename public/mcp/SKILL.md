---
name: screenplay-studio
description: Write, plan and produce films, series, plays, podcasts and videos in Screenplay Studio through its MCP server. Use when the user wants to create or edit a screenplay or episode, develop a story (loglines, beat sheets, arcs, characters, worldbuilding, treatments), break down a script (scenes, props, cast, shots, storyboards), plan a production (schedule, shoot days, call sheets, budget, gear, locations, safety), run development notes, coverage and submissions, manage a project team, or administer the Screenplay Studio platform. Requires the screenplay-studio MCP tools.
---

# Screenplay Studio

Screenplay Studio is a screenwriting and pre-production app. Its MCP server lets you work inside the user's real projects: everything you create shows up in their app immediately, for their whole team.

## Before you start

1. If no `screenplay-studio` tools are available, tell the user to create a token at **Settings → Claude & MCP** in Screenplay Studio and connect it (the page shows the exact command). Stop there.
2. Orient yourself: `list_projects` → `get_project`. The overview tells you the project type, the scripts, the team, your role and how many of each record exist. Read before you write.
3. Your permissions are the user's. A viewer can only read; owners/admins manage the team. A `read` token cannot change anything — say so rather than retrying.

## The tools, by job

| Job | Tools |
| --- | --- |
| Find your way | `whoami`, `list_projects`, `get_project`, `search_project` |
| Projects | `create_project`, `update_project`, `delete_project` |
| Scripts | `list_scripts`, `create_script`, `update_script`, `read_script`, `write_script`, `edit_script`, `find_replace`, `script_stats`, `export_script` |
| Drafts | `save_draft`, `list_drafts`, `restore_draft` |
| Story planning | `get_beat_sheet`, `update_beat_sheet`, `get_arc_map`, `update_arc_map`, `sync_scenes` |
| Everything else | `describe_kinds`, `list_records`, `get_record`, `create_records`, `update_records`, `delete_records` |
| Team | `list_members`, `add_member`, `update_member`, `remove_member`, `read_messages`, `send_message` |
| Platform admin | `admin_stats`, `admin_find_users`, `admin_get_user`, `admin_update_user`, `admin_moderate_user`, `admin_reply_ticket`, `admin_notify` |

"Everything else" is one set of generic tools over many **record kinds**. Call `describe_kinds` for the list and `describe_kinds { kind }` for a kind's exact fields and allowed values before creating records you have not used yet.

## Writing scripts

Scripts are stored as ordered elements (scene_heading, action, character, dialogue, parenthetical, transition, ...). You exchange them as **Fountain**:

```fountain
INT. LIGHTHOUSE - NIGHT

Rain hammers the glass. MAYA (30s, soaked) forces the door.

MAYA
(breathless)
Is anyone here?

The lamp above her flickers on.

CUT TO:

EXT. CLIFF PATH - CONTINUOUS
```

Fountain essentials: scene headings start with INT./EXT./INT./EXT. or a leading `.`; character cues are ALL CAPS on their own line followed by dialogue; parentheticals in `( )`; transitions end in `TO:` or start with `>`; `> CENTERED <`; `# Act One` sections; `= synopsis` lines; `[[notes]]`; `===` page break. Keep a blank line between blocks.

- **Read**: `read_script` with `format: "outline"` for structure, `"fountain"` to read the pages, `"elements"` when you need element ids. For long scripts, read a range with `from_scene` / `to_scene`.
- **Add pages**: `write_script` (append by default, or `mode: "insert"` with `after` / `before` an element id).
- **Rewrite everything**: `write_script` with `mode: "replace"`. A draft of the old version is saved automatically; tell the user its name.
- **Surgical changes**: `edit_script` with operations (`update` content or type, `insert`, `delete`, `move`) by element id. Batch related edits into one call.
- **Renames and global fixes**: `find_replace` with `whole_word: true`; use `preview: true` first when the change is broad, and remember character cues are uppercase.
- **Before a big revision** call `save_draft` with a meaningful name, so the user can go back.
- A **locked** script refuses edits. Ask before unlocking with `update_script`.
- Scene numbers renumber automatically, unless the script uses production numbering like `12A` — then leave them alone.
- **Non-screenplay formats** (YouTube, podcast, audio drama, stage, comic) have their own element types (`hook`, `talking_point`, `sfx_cue`, `music_cue`, `lighting_cue`, `comic_panel`, ...). Write those with `edit_script` insert operations and explicit types; Fountain only covers screenplay elements.
- **Episodic projects**: each episode is a script. `create_script` with `season` and `episode_order`; seasons themselves are the `seasons` kind.

Write like a professional: present tense, visual action, lean paragraphs (≤ 4 lines), subtext in dialogue, one page ≈ one minute. Match the existing voice when continuing someone's script, and never overwrite their pages without being asked.

## Developing a story

- Logline, synopsis, genre, format and status live on the project: `update_project`.
- Treatment / series bible: kind `treatment` (one row per project).
- Characters: kind `characters` (`is_main`, `role`, `motivation`, `arc`, `backstory`, `relationships`).
- World: `world_entities` + `world_relationships`; locations: `locations`, pinned on the map with `map_markers` and `map_routes`.
- Ideas board: `ideas` (status `spark → developing → ready → used`).
- **Beat sheet**: `get_beat_sheet` shows the framework's beats and target pages. `update_beat_sheet { beats: { catalyst: { notes, linked_scene_ids } } }`. Frameworks: `save_the_cat`, `three_act`, `hero_journey`. Episodes use scope `ep_{scriptId}`, seasons `season_{n}`.
- **Arc map** (Arc Planner canvas): `update_arc_map` adds nodes (`episode`, `arc`, `character`, `theme`, `event`, `note`) and edges (`story-arc`, `subplot`, `character-link`, `conflict`, `cause-effect`). Give new nodes a `key` to connect them in the same call. Positions lay out automatically.
- **Mind map / mood board**: kinds `mindmap_nodes` + `mindmap_edges`, `moodboard_items` + `moodboard_connections` (space nodes ~220px apart).

## From script to shoot

Follow this order; each step feeds the next by id.

1. `sync_scenes` — one breakdown row (kind `scenes`) per scene heading, with INT/EXT, location and time of day.
2. Read the script and fill the breakdown with `update_records` on `scenes`: `synopsis`, `cast_ids` (character ids), `props`, `costumes`, `special_effects`, `vehicles`, `stunts`, `vfx_notes`, `page_count`, `estimated_duration_minutes`. Create missing `characters` / `locations` first so you can link them (`location_id`).
3. `shots` per scene (`scene_id`, `shot_type`, `shot_movement`, `lens`, `description`), then `storyboard` frames if wanted.
4. Scheduling: `shoot_days` (day_number, date, call/wrap time), then `shoot_day_scenes` and `shoot_day_cast` for each day. Group by location and time of day, keep actor days contiguous, put exteriors early. Calendar events go in `schedule`; `day_out_of_days` tracks who works which day.
5. `call_sheets`, `gear`, `safety` (stunts, water, heights, vehicles, pyrotechnics → risk level and mitigation), `continuity`, `camera_reports`, timed `table_reads`.
6. `budget` lines by category with `estimated_amount`; `actual_amount` as money is spent. Pro productions also have `pro_tool_records` (accounting, clearances, deliverables, ...) — `describe_kinds { kind: "pro_tool_records" }` lists each tool's fields.
7. People: `cast` (actors, availability, pay, contract status) with their `cast_documents`, `credits` for non-users, team members with `add_member`.

Use `create_records` with many rows per call rather than one call per row.

## Development and review

- Notes rounds: `notes_rounds` then `notes` (`round_id`, `category`, `scene_ref`, `status`).
- `coverage` reports (grades + `recommendation`: pass / consider / recommend) — be honest and specific.
- `submissions` to agents, managers, festivals (`status`, `next_follow_up`).
- `comments` attach to anything by `entity_type` + `entity_id`.
- `documents` (in `document_folders`) for outlines, research and notes; `share_links` for read-only links (the token is generated; link is `{site}/share/{token}`).

## Content creators and stage

- YouTube/TikTok/podcast: `hooks`, `chapters`, `video_seo`, `thumbnails`, `broll`, `sponsors`, `upload_checklist`.
- Stage: `stage_cues`, `ensemble`, `production_team`.

## The user's own space

Not tied to a project: personal `idea_boards` and their blocks `idea_nodes` (list with `filter: { board_id }`), the writing log `work_logs` (pages, words, minutes per day — feeds streaks), and `notifications` (update `read`).

Project chat channels are the `channels` kind; read and post with `read_messages` / `send_message`.

## Filtering and finding

`list_records` takes `filter`: exact (`{ "status": "open" }`), any-of (`{ "category": ["props", "vfx"] }`) or operators (`{ "estimated_amount": { "gte": 1000 } }`; `eq neq gt gte lt lte like ilike in contains is`). Use `query` for text search, `fields` to return fewer columns, and `offset` / `next_offset` to page. `search_project` searches script text and every major kind at once.

## Platform administration (admins only)

Only visible with an **admin** token held by a platform admin.

- Health: `admin_stats`. Accounts: `admin_find_users`, `admin_get_user`, `admin_update_user` (role, Pro, verification, storage).
- Moderation: `admin_moderate_user` (warn / suspend / ban / unban / unsuspend). Banning also IP-bans and removes the user from every project — always confirm first. Review `content_flags`, `content_reports` and `user_bans` via `list_records`.
- Support: list `support_tickets`, read `ticket_messages` (filter `ticket_id`), reply with `admin_reply_ticket`.
- Site content via records: `feedback`, `changelog_releases` + `changelog_entries`, `blog_posts`, `feature_flags`, `site_settings`, `badges` + `user_badges`, `challenges`. Read-only: `subscriptions`, `donations`, `audit_log`.
- `admin_notify` messages users; confirm the wording and audience first.

## Ground rules

- **Ask before anything irreversible**: `delete_project`, `delete_script`, `delete_records`, `remove_member`, `restore_draft`, `write_script` in replace mode, broad `find_replace`, `send_message`, `admin_moderate_user`, `admin_notify`. Delete tools want the exact title as confirmation — never guess it to get past the check.
- Work in the user's project, in their voice. Summarise what you changed (counts, names, draft saved) and link to the project URL from `get_project`.
- Every write is recorded in the audit log under the user's name.
- On an error, read the message: it names the missing field, the allowed values or the role you lack. Fix the call instead of retrying it unchanged.
