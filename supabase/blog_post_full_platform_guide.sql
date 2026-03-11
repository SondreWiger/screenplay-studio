-- ============================================================
--  BLOG POST: The Complete Screenplay Studio Feature Guide
--  Run in: Supabase Dashboard > SQL Editor
--  Author ID: f0e0c4a4-0833-4c64-b012-15829c087c77  (admin)
-- ============================================================

INSERT INTO blog_posts (
  slug,
  title,
  excerpt,
  cover_image_url,
  sections,
  tags,
  status,
  published_at,
  author_id,
  allow_comments
)
VALUES (
  'complete-platform-guide-every-feature',

  'Every Single Feature on Screenplay Studio — The Insanely Detailed Guide',

  'From the script editor to cast payroll, from weekly writing challenges to gamification — this is the definitive guide to everything Screenplay Studio can do for you. Buckle up.',

  NULL,

  $sections$
[
  {
    "order": 1,
    "heading": "Welcome — What Even Is This Place?",
    "body": "Screenplay Studio is not just another writing app.\n\nIt started as a simple screenplay editor and quietly grew into a full production platform — the kind of thing that handles your script on Monday, your shoot schedule on Tuesday, your actor contracts on Wednesday, your community feedback on Thursday, and your weekly writing challenge on Friday. Oh, and it tracks how many hours you actually spent working instead of staring at the wall.\n\nThis guide covers EVERYTHING. Every table, every toggle, every policy, every feature, every tiny setting that most users never find. It is long. It is detailed. It is for the obsessives, the power users, the curious, and the people who clicked the question mark and expected more than a tooltip.\n\nReady? Let's go."
  },
  {
    "order": 2,
    "heading": "Projects — The Container for Everything",
    "body": "Every piece of work on Screenplay Studio lives inside a Project. A project is your production — a film, a series, a short, a play, a podcast. When you create a project you give it a title, a type (film, TV, short, doc, etc.), a logline, and optionally a cover image.\n\nThe moment you hit Create, three things happen automatically:\n\n1. You are added as the Owner of that project.\n2. An initial script draft titled [Your Project Title] — Draft 1 is created for you inside the project.\n3. You land on the project dashboard with the full suite of tools ready to go.\n\nProjects support: scripts, scenes, characters, locations, shot lists, the production schedule, ideas board, budget, cast & payroll, documents, annotations, work sessions, shoot days, gear lists, arc/episode management, project channels, project members, contributors, and more.\n\nYou can archive projects (they disappear from your dashboard but are not deleted), and owners/admins can permanently delete them. Deletion cascades — everything inside the project is removed from the database."
  },
  {
    "order": 3,
    "heading": "Project Roles & Permissions — Who Does What",
    "body": "Every person on a project has a role. There are four:\n\n— OWNER: Full control. Can do everything including delete the project and manage all member roles. There is only one owner per project (the creator).\n— ADMIN: Almost-owner. Can manage members, edit all content, and delete most things. Cannot remove the owner or delete the project itself.\n— EDITOR: Can read and write all content (scripts, shots, schedule, etc.) but cannot manage team members or delete the project.\n— VIEWER: Read-only. They can see everything but cannot change a single character.\n\nThe Row Level Security policies on every table enforce these rules at the database level — not just in the UI. Even if someone tried to call the API directly, the database simply refuses if their role does not allow it.\n\nInvitations are sent by email. The invitee receives a link, clicks it, and lands on the project already in their dashboard. Invitation records track status (pending, accepted, declined, expired) and are cleaned up automatically."
  },
  {
    "order": 4,
    "heading": "The Script Editor — Your New Writing Home",
    "body": "The script editor is the beating heart of the platform. It uses an element-based model: each line of your script is a separate record in the database with a type, content, and sort order. This means real-time collaboration works without merge conflicts — two writers literally editing different elements at the same time, both seeing each other's changes instantly.\n\nElement types:\n— SCENE HEADING (slugline): INT. COFFEE SHOP — DAY. The classic.\n— ACTION: Descriptive prose. What we see, what we hear.\n— DIALOGUE: What a character says.\n— CHARACTER: The name above a dialogue block.\n— PARENTHETICAL: The (beat), (sighs), (looking away) in brackets.\n— TRANSITION: CUT TO:, SMASH CUT TO:, DISSOLVE TO:, FADE OUT.\n— SHOT: Close-up, insert, POV — shot callouts within action.\n— NOTE: A non-printing internal note to yourself or collaborators.\n\nEvery keystroke is saved. Not periodically — on every change. You will never lose work.\n\nThe editor supports keyboard shortcuts for quickly switching between element types, folding/hiding scenes, and navigating by scene heading. There is also a full-text search index (GIN on PostgreSQL) so you can search across your entire script instantly.\n\nScript elements are sorted by a sort_order integer — dragging a block reorders it in real time."
  },
  {
    "order": 5,
    "heading": "Custom Script Element Types — Make the Format Yours",
    "body": "Standard screenplay format is not the only format. Screenplay Studio supports custom element type definitions per project, so you can define your own labels, styles, and indent rules.\n\nThis means a stage play can have BLOCKING and STAGE DIRECTION elements. An audio drama can have SOUND EFFECT and NARRATOR elements. A corporate video can have LOWER THIRD and B-ROLL elements.\n\nEach custom type stores:\n— A name and display label\n— Font style flags (bold, italic, all-caps)\n— Indent level (left-edge, center, right-of-center)\n— Whether it prints when exporting\n— A color swatch for the editor sidebar\n\nCustom types are project-level — they apply to that project only and do not affect your other projects."
  },
  {
    "order": 6,
    "heading": "Stage Play Format — The Stage is Yours",
    "body": "Stage play formatting is its own world. No sluglines, no camera directions — instead you have acts, scenes, stage directions, and sometimes a very different dialogue layout depending on the tradition (British vs American, naturalistic vs Brechtian).\n\nScreenplay Studio supports a dedicated stage play mode. When you create a project of type Stage Play, the editor unlocks stage-specific element types and hides film-centric ones. You get:\n— ACT headers\n— SCENE headings (not sluglines — proper theatrical scene labels)\n— STAGE DIRECTION blocks\n— CHARACTER cues in the theatre tradition\n— Parenthetical delivery notes\n— SONG CUE markers for musicals\n\nThe export formatter respects all of this, producing a document that looks like a proper stage manuscript, not a screenplay."
  },
  {
    "order": 7,
    "heading": "Audio Drama & Podcast Format",
    "body": "Screenplays for ears are a growing medium — full-cast audio dramas, scripted podcasts, radio plays, and immersive audio fiction.\n\nScreenplay Studio has a dedicated audio drama mode. Script elements in this mode include:\n— NARRATOR blocks (the omniscient storytelling voice)\n— SOUND EFFECT cues with description and duration hints\n— MUSIC CUE markers\n— AMBIENCE notes (scene-setting sonic environment)\n— Standard DIALOGUE with full character/parenthetical support\n\nThe audio drama schema also stores format metadata: whether the production is stereo or binaural, estimated episode runtime, series/standalone flag, and target platform (podcast, radio, streaming).\n\nThis makes Screenplay Studio the only screenplay tool that treats audio drama as a first-class format instead of a weird corner case."
  },
  {
    "order": 8,
    "heading": "Broadcast Format — For the Airwaves",
    "body": "Broadcast scripting (news, live TV, promotional content, broadcast promos) uses a two-column A/V format that is nothing like screenplay format. The left column describes the video; the right column has the audio/copy.\n\nScreenplay Studio supports broadcast script mode with:\n— VIDEO column (left) + AUDIO column (right) side-by-side editing\n— SUPER (on-screen text/lower third) elements\n— VO (voiceover) vs SOT (sound-on-tape) distinction\n— SCENE/SEGMENT headers\n— TOTAL TIME calculator based on estimated read time\n\nBroadcast contacts (reporters, anchors, producers, stations) can be stored and linked to broadcast projects, complete with contact info, station affiliation, and relationship notes.\n\nThe broadcast patch feature allows incremental changes (corrections/inserts) to be distributed to a team without re-sending the full script."
  },
  {
    "order": 9,
    "heading": "Scenes — Structure Your Story",
    "body": "Scenes are the structural backbone of your screenplay. Every scene lives inside a script and represents a single unbroken unit of dramatic action — one place, one time, one set of events.\n\nEach scene record stores:\n— Scene number (auto-generated or manual)\n— Interior/exterior flag\n— Location reference (links to the location database)\n— Time of day (day, night, morning, afternoon, dusk, etc.)\n— Scene summary / description\n— Estimated page count\n— Estimated screen time in seconds\n— A topic / thematic label\n— Tags (array of freeform strings)\n— Color coding for visual organization\n— Sort order within the script\n\nThe scene panel gives you a bird's-eye view of your entire story — you can drag to reorder, click to jump to that scene in the editor, add notes, and track which scenes are fully written vs placeholder.\n\nScenes can also be broken down for production: linked to locations, linked to characters (automatic from the script), flagged as day-exterior for scheduling purposes."
  },
  {
    "order": 10,
    "heading": "Characters — Give Them Life",
    "body": "The Characters section is a full character bible tool built into every project.\n\nFor each character you can store:\n— Full name + any aliases / nicknames\n— Age and description\n— A profile photo or reference image URL\n— A detailed biography (backstory, motivations, secrets)\n— Character arc notes (where they start vs where they end)\n— Character type: protagonist, antagonist, supporting, minor, bit part, etc.\n— Their scene appearances (auto-populated by parsing the script)\n— Relationships to other characters (with relationship type and notes)\n— Actor casting notes and the linked cast member (when you move into production)\n\nCharacter names are indexed with trigram search (pg_trgm) so even a partial name search is instant.\n\nThe character roles feature goes deeper: for TV/episodic projects, you can tag which episodes a character appears in, their billing order (series regular, recurring, guest star, co-star, day player, under five), and their arc trajectory across a season."
  },
  {
    "order": 11,
    "heading": "Locations — Build Your World",
    "body": "The Locations database is your master location library for the entire project.\n\nEach location stores:\n— Name and address\n— Type: interior, exterior, combo\n— Category: practical location, studio/stage, mixed\n— GPS coordinates (lat/lng) for mapping\n— Contact info for the location owner/manager\n— Rental rate (daily, weekly, hourly) with currency\n— Parking and accessibility notes\n— Equipment/power availability\n— A photo gallery (array of image URLs)\n— General production notes\n— Permit status and permit document links\n\nMulti-Location Markers extend this further: a single scene can have multiple location markers pointing to different real-world places used for the same scripted location (e.g. the exterior of the house is shot at Address A, the interior at Studio B).\n\nLocations are reusable across scenes — link the same coffee shop to 12 different scenes and updating the location record updates the info everywhere."
  },
  {
    "order": 12,
    "heading": "Shot Lists — Think Like a Director",
    "body": "Every scene can have a full shot list. Each shot is a record with:\n\n— Shot number (A1, A2, … per scene)\n— Shot type: wide / medium / close-up / extreme close-up / insert / POV / reaction / two-shot / over-the-shoulder / aerial / underwater (the full professional vocabulary)\n— Shot movement: static / pan / tilt / dolly / handheld / crane / steadicam / drone / zoom\n— Lens (e.g. 35mm, 50mm, anamorphic 2x)\n— Description of what the shot shows (the actual image)\n— Dialogue reference (which line of dialogue this shot covers)\n— Estimated duration in seconds\n— Camera notes (frame rate, filters, rigs, operator notes)\n— Lighting notes\n— Sound notes\n— VFX required flag + VFX description\n— Storyboard image URL\n— Reference image URLs (array)\n— Takes needed vs takes completed\n— Completion flag\n\nShot lists are sortable by drag-and-drop. They integrate with the Storyboard module and the Shoot Day planner — shots from a scene automatically appear on the shoot day that scene is scheduled for."
  },
  {
    "order": 13,
    "heading": "Storyboards — Shot by Shot Visualization",
    "body": "The Storyboard Shots feature extends the shot list with visual storytelling tools.\n\nEach storyboard shot can have:\n— A frame image (drawn, photographed reference, or AI-generated)\n— Panel notes\n— Audio/music cues\n— Transition type to the next panel (cut, dissolve, wipe)\n— Camera framing guide overlay\n\nThe storyboard view renders your shot list as a horizontal strip of panels — the classic animatic/pre-viz format directors and DPs use in prep. You can export this as a PDF storyboard document for distribution to your crew.\n\nStoryboard shots are linked to your script scenes and shot records, so the entire pre-production pipeline — script → scene → shot list → storyboard — flows seamlessly."
  },
  {
    "order": 14,
    "heading": "The Production Schedule — From Script to Set",
    "body": "The Production Schedule is a full calendar tool for managing your shoot.\n\nEach calendar event stores:\n— Title and description\n— Event type: shooting, rehearsal, table read, location scout, tech scout, production meeting, costume fitting, makeup test, audition, pickup, post-production, wrap party, other\n— Start and end timestamps (with timezone)\n— All-day flag\n— Scene IDs being shot that day (links to scene records)\n— Location (links to location database)\n— Crew/cast assigned (array of user IDs)\n— Call time and wrap time (separate from the event start/end)\n— General notes\n— Color coding (for differentiating shoot days, meetings, etc.)\n— Confirmed flag (pending vs locked schedule)\n— Weather backup plan\n\nThe schedule feeds into the Shoot Days module, sends availability-check notifications to cast and crew, and can be exported as a call sheet PDF."
  },
  {
    "order": 15,
    "heading": "Shoot Days — Day-by-Day Planning",
    "body": "Shoot Days are structured daily production plans — more detailed than calendar events, designed to produce a proper day-of plan for your crew.\n\nEach shoot day captures:\n— Date and shoot day number (Day 1, Day 2…)\n— General call time\n— Crew call times (first unit, second unit, department calls)\n— Scenes scheduled for that day\n— Estimated pages per scene\n— Locations used\n— Special equipment requirements\n— Notes and contingencies\n\nShoot day records link to the production schedule (the calendar) and to the Shot List — so the DP's team can pull up the complete shot list for their scenes from the shoot day view.\n\nA daily hours tracker shows estimated vs actual shoot duration so you can spot if you're consistently running over."
  },
  {
    "order": 16,
    "heading": "Gear Management — Don't Forget the Camera",
    "body": "The Gear module is your equipment inventory and rental tracker.\n\nEach gear item stores:\n— Item name and category (camera body, lens, lighting, sound, grip, post/DIT, VFX, misc)\n— Quantity\n— Ownership: own / rent / borrow\n— Vendor / rental house name and contact\n— Daily / weekly rental rate with currency\n— Total cost (auto-calculated from shoot days × rate)\n— Insurance value\n— Serial number / asset tag\n— Notes and condition flags\n\nGear items can be attached to specific shoot days — so Monday's kit list is different from Friday's (second unit day with a drone).\n\nThe gear module rolls up to your budget: rental costs feed directly into the budget categories you define, so your below-the-line numbers stay accurate."
  },
  {
    "order": 17,
    "heading": "Ideas Board — Capture the Magic",
    "body": "The Ideas Board is a Kanban-style brainstorming space attached to every project.\n\nIdeas live in columns based on status:\n— SPARK: The raw, unfiltered idea. Write it down before it evaporates.\n— EXPLORING: Worth thinking about more.\n— PROMISING: This could be something.\n— IN SCRIPT: The idea has been incorporated into the actual script.\n— SHELVED: Not right for now, but not killed.\n\nEach idea card stores:\n— Title and description\n— Category: story, character, scene, dialogue, visual, location, theme, structure, other\n— Priority (0–10 numeric, controls sort order within the column)\n— Tags\n— Reference URLs (mood board links, research articles, YouTube clips)\n— File attachments\n— A color swatch for visual grouping\n— Assignment to a specific collaborator\n\nThe Ideas Board is separate from your script so it stays messy and uninhibited. The best stuff makes it into the script; the rest stays archived for when you inevitably need it."
  },
  {
    "order": 18,
    "heading": "Budget Tracker — Know Your Numbers",
    "body": "The Budget module gives every project a real financial tracking system.\n\nBudget items are organized into categories:\n— Above the line (story/script rights, producers, director, cast)\n— Below the line (crew, equipment, locations, transportation, art department, wardrobe, hair/makeup, stunts, VFX, music, post-production)\n— Post-production\n— Marketing\n— Contingency\n— Other\n\nEach line item stores:\n— Description\n— Category\n— Estimated amount\n— Actual amount (filled in as you spend)\n— Variance (auto-calculated)\n— vendor/payee\n— Notes\n— Purchase order number\n— Receipt URL\n\nThe budget rolls up to a summary showing total estimated vs actual spend across all categories, with variance warnings when you go over. Currency is configurable per item (for multi-country productions).\n\nGear rental costs, cast payment totals, and crew rates from other modules feed into the budget automatically when you link records."
  },
  {
    "order": 19,
    "heading": "Cast Members & Payroll — Your Actors, Your Ledger",
    "body": "The Cast & Payroll module is a full actor management system that would normally require dedicated production software.\n\nEach cast member record stores:\n— Full name\n— Character roles (array of character names — because one actor can play multiple roles)\n— Email and phone\n— Profile photo URL\n— Bio / professional biography\n— Availability notes\n— General notes from the production team\n\nPay rate info:\n— Pay amount (DECIMAL with 12 digits of precision — no rounding errors)\n— Pay unit: hourly / daily / weekly / monthly / flat deal / per episode\n— Pay currency (supports any ISO currency code — USD, EUR, NOK, GBP, JPY, etc.)\n\nContract status tracks where each actor is in the deal:\n— NEGOTIATING: In discussions.\n— PENDING: Offer made, waiting for signature.\n— SIGNED: Deal closed, contract executed.\n— ON SET: Currently in production.\n— COMPLETED: Filming done.\n— RELEASED: Term over, all obligations met.\n\nCustom metadata (JSONB) lets you store any additional per-actor structured data your production needs — think union affiliation, agent contact, IMDB link, reel URL."
  },
  {
    "order": 20,
    "heading": "Cast Payments — The Payment Ledger",
    "body": "Every payment to every cast member is tracked in the Cast Payments ledger.\n\nEach payment record stores:\n— Cast member reference\n— Amount + currency\n— Description (Week 1 pay, Episode 3 fee, etc.)\n— Period start and end dates (for weekly/episode payments)\n— Due date\n— Paid-at timestamp\n— Status: UNPAID / PAID / OVERDUE / CANCELLED\n— Notes\n\nThe status field is what powers your payroll dashboard: you can filter to see all overdue payments across all cast members at once, which is exactly the kind of thing that saves productions from lawsuits.\n\nOverdue detection: any payment with a due_date in the past and status = unpaid is flagged. You can run bulk status updates as you process payments.\n\nThe payment ledger totals roll up to the overall cast budget line, keeping your budget and your payroll in sync."
  },
  {
    "order": 21,
    "heading": "Cast Documents — The Paper Trail That Protects You",
    "body": "Every document related to a cast member lives in their document vault.\n\nDocument types supported:\n— NDA (non-disclosure agreement)\n— CONTRACT (the main deal memo or long-form contract)\n— WORK AGREEMENT (a shorter agreement for day players)\n— ID PROOF (driver licence, passport, etc.)\n— INSURANCE (certificate of insurance from the actor's loan-out)\n— WORK PERMIT (union permits, child actor permits, etc.)\n— CITIZENSHIP (for visas and international productions)\n— NEGOTIATION (deal points correspondence, rider terms)\n— OTHER\n\nEach document stores:\n— Document type\n— Title\n— File URL (linked to your storage bucket)\n— Original file name\n— Notes\n— Expiry date (critical for permits and insurance certificates — you get notified when these are approaching)\n\nAll documents are access-controlled by project role: owners/admins can read everything, editors can read but not delete sensitive docs, viewers are blocked entirely."
  },
  {
    "order": 22,
    "heading": "Annotations — Notes Right on the Page",
    "body": "Annotations let you attach sticky-note-style comments directly to specific script elements — a particular line of action, a piece of dialogue, a scene heading.\n\nEach annotation stores:\n— The script element it is attached to\n— The text of the note\n— The author\n— An annotation type: note, question, suggestion, flag, approved\n— A resolved flag (once the note is addressed, mark it done)\n— Resolved by (who resolved it)\n\nAnnotations are separate from the inline Comments feature (which can be attached to any entity). Annotations are specifically for in-script feedback — the kind that an editor, script supervisor, or writing partner would leave during notes sessions.\n\nThe annotation sidebar shows all open annotations for the current script, grouped by scene, with quick-navigation to jump to each."
  },
  {
    "order": 23,
    "heading": "Comments — Notes on Anything",
    "body": "The Comments system is the general-purpose discussion layer. Unlike annotations (which attach to script elements), comments can attach to any entity in the system: scenes, shots, characters, locations, ideas, budget items, documents, schedule entries.\n\nComments support:\n— Full threaded replies (parent_id for nesting)\n— Comment types: note / question / suggestion / approval / rejection / flag\n— Resolved / unresolved tracking\n— Who resolved it and when\n\nAll comments on a project are accessible in a unified inbox view — you can see everything that needs your attention without hunting through individual pages.\n\nRealtime: comments use Supabase Realtime under the hood, so replies from collaborators appear instantly without a page refresh."
  },
  {
    "order": 24,
    "heading": "Revision History — Never Lose a Word",
    "body": "The Revision History feature saves complete snapshots of your script at named revision points.\n\nEach revision stores:\n— Version number\n— Revision color (the standard industry system):\n  — WHITE: First draft\n  — BLUE: Second revision\n  — PINK: Third revision\n  — YELLOW: Fourth revision\n  — GREEN: Fifth revision\n  — GOLDENROD: Sixth revision\n  — BUFF: Seventh revision\n  — SALMON: Eighth revision\n  — CHERRY: Ninth revision\n  — TAN, IVORY, WHITE (second cycle) for subsequent revisions\n— Revision notes (what changed)\n— A full JSONB snapshot of every script element at that point in time\n— Who created the revision\n\nYou can compare any two revisions, restore a previous version as a new draft, or export a specific revision as a PDF.\n\nThis is the standard WGA/guild revision tracking system used on professional productions — your script now speaks the same language as a union writer's room."
  },
  {
    "order": 25,
    "heading": "Version Control (Advanced Versioning)",
    "body": "Beyond the revision snapshot system, the Versioning module adds a Git-inspired branching concept for scripts.\n\nYou can:\n— Create named branches of your script (e.g. Director Cut, Studio Draft, European Version)\n— Make changes on a branch without affecting the main script\n— Merge branches back (with conflict resolution UI)\n— View the diff between any two branches at the element level\n\nThis is invaluable when you have multiple stakeholders requesting different versions simultaneously: the studio wants fewer characters, the director wants a longer third act, the foreign co-production needs a location change. Branches keep you sane.\n\nEach version/branch record tracks its parent version, creation date, author, and a description of what this version is for."
  },
  {
    "order": 26,
    "heading": "Work Time Tracking — Log Every Hour",
    "body": "Screenplay Studio tracks how much time you actually spend working on a project. Not reported time — actual measured time.\n\nHere is how it works: when you open a project, a work session is created with a unique session key (generated in your browser, stored in sessionStorage — so each browser tab gets its own session). Every 30 seconds, a heartbeat is sent to the server. The server adds 30 seconds to your session duration — but only if:\n— The heartbeat is not more than 20 minutes late (gap detection)\n— You have not been idle for more than 10 minutes (idle detection)\n— A short break grace period of up to 5 minutes is credited (so stepping away to think counts)\n\nWhat is tracked per session:\n— User ID\n— Project ID\n— Context (which part of the app you are in: script, documents, arc-planner, etc.)\n— Date\n— Total seconds accumulated\n— Last heartbeat timestamp\n\nProject owners can see work hours for all team members. The data is broken down by day, by context (how much time in the script vs the documents vs the schedule), and in aggregate.\n\nViews available:\n— work_hours_by_day: daily totals per user per project (last 90 days)\n— work_hours_by_user: all-time hours, days worked, first/last session\n— work_hours_by_context: time split by context\n— admin_work_stats: platform-wide production activity\n\nSessions that go stale (no heartbeat for 24+ hours, under 60 seconds credited) are automatically cleaned up."
  },
  {
    "order": 27,
    "heading": "Real-Time Collaboration — Write Together, Right Now",
    "body": "Screenplay Studio is built for simultaneous multi-user editing. It is not a single-editor-with-comments system — multiple people can type at the same time.\n\nThe collaboration infrastructure:\n— Script elements are individual database rows subscribed to via Supabase Realtime\n— Changes from any collaborator arrive via a WebSocket channel within milliseconds\n— Each user's cursor position (which element they are editing and where in the text) is broadcast via the user_presence table\n— Presence avatars appear in the editor showing where each collaborator currently is\n\nThe user_presence table stores:\n— User ID and project ID\n— Current page\n— Current element ID they are focused on\n— Cursor position (character offset)\n— Online/offline status\n— Last seen timestamp\n\nPresence pins expire automatically — if a user's tab closes or they go offline, their presence dot disappears within seconds.\n\nThe following tables are on the Supabase Realtime publication: script_elements, user_presence, comments, ideas, scenes, shots, production_schedule."
  },
  {
    "order": 28,
    "heading": "Project Documents — Your File Cabinet",
    "body": "Every project has a document vault separate from cast documents — this is for general production documents: deal memos, location agreements, insurance certificates, research materials, mood boards, pitch decks, distribution agreements.\n\nDocuments store:\n— Title and description\n— Document type (with a flexible system of categories)\n— File URL and file name\n— Version number\n— Status (draft, pending review, approved, executed, expired)\n— Expiry date\n— Who uploaded it and when\n— Notes\n\nProject documents are visible to all team members based on role. Viewers can read; editors can upload new versions; admins can delete.\n\nDocuments are stored in Supabase Storage buckets with RLS policies ensuring only authorized project members can access the files."
  },
  {
    "order": 29,
    "heading": "Project Channels — Team Communication",
    "body": "Project Channels are per-project discussion spaces — think Slack channels but built directly into the project context.\n\nEach project can have multiple channels. Default channels: General, Script Notes, Production. You can add topic-specific channels: Locations, Budget, VFX, etc.\n\nChannels support:\n— Text messages\n— File attachments\n— Reactions (emoji)\n— Threaded replies\n— @mentions\n— Pinned messages\n— Message history (persisted, searchable)\n\nChannels use Supabase Realtime for instant delivery. Messages are associated with the project so they do not bleed between projects, and channel access is controlled by project membership."
  },
  {
    "order": 30,
    "heading": "Personal Project Folders — Your Own Organization System",
    "body": "Your project dashboard can get crowded if you are on a lot of productions. Personal folders let you organize your own view of your projects.\n\nFolders are personal — they belong to you and only you. They are not visible to other project members. You can:\n— Create folders with names and colors\n— Move any project you are a member of into a folder\n— Nest folders (subfolders supported)\n— Rename and recolor folders\n— Move folders around using drag-and-drop\n\nThe folder tree is stored per user, not per project, so your organizational scheme stays yours regardless of how the project owner has things set up."
  },
  {
    "order": 31,
    "heading": "Dashboard Folders — Admin-Level Project Organization",
    "body": "Separate from personal folders, Dashboard Folders are admin-level categorization visible to the whole team. These are used to group projects by production company, season, client, genre, or status.\n\nFor agencies and production companies running multiple projects simultaneously, dashboard folders give the whole company a shared taxonomy: all of Client A's projects together, all comedy shorts in one folder, all series in another.\n\nDashboard folder access is controlled by role: only owners and admins can create/rename/delete dashboard folders."
  },
  {
    "order": 32,
    "heading": "Contributors — Credit the Whole Team",
    "body": "Contributors is a credits-style roster for everyone who worked on a project — including people who are not Screenplay Studio users.\n\nEach contributor record stores:\n— Name\n— Role / department (director, DP, editor, composer, gaffer, boom op, etc.)\n— Whether they are a platform user (and if so, linked to their profile)\n— Contribution dates\n— Credit billing (as it would appear on screen)\n— Notes\n\nThe contributors list generates a formatted credits document you can export. It is also used internally for the project completion workflow and for the festival submission data export.\n\nContributors are separate from project members (who have system access) — a cinematographer who never logs into the platform can still be properly credited."
  },
  {
    "order": 33,
    "heading": "Development Tools — The Path from Idea to Greenlight",
    "body": "The Development Tools section tracks where a project sits in the development pipeline.\n\nDevelopment milestones include:\n— Premise / logline\n— Treatment\n— Step outline\n— First draft\n— Notes period\n— Revision drafts (numbered)\n— Table read\n— Final draft (locked)\n— Packaging (attaching elements: director, lead cast)\n— Financing\n— Pre-production\n— Production\n— Post-production\n— Delivery\n— Distribution\n\nEach milestone has a status (todo, in-progress, completed, skipped), target date, completion date, and notes.\n\nThe development tracker gives producers and executives a single-glance status view for an entire development slate — no more chasing emails to find out which draft you're on."
  },
  {
    "order": 34,
    "heading": "Arc & Episode Planning — Think in Episodes",
    "body": "For TV series, limited series, and anthology content, the Arc & Episode Planner is your writers room tool.\n\nArcs represent story threads that run across multiple episodes — character arcs, A-plots, B-plots, season-long mythology. Each arc has:\n— A title and description\n— A color (for visual distinction in the grid)\n— Start and end episode\n— Arc type: character / plot / thematic / world-building\n— Status: seeded / building / climax / resolved\n\nEpisodes store:\n— Episode number and title\n— Season number\n— Script link (each episode links to its own script)\n— Logline\n— Cold open / act structure notes\n— Airdate (planned or actual)\n— Production status\n\nThe visual arc grid shows all your episodes as columns and all your arcs as rows — you can see at a glance which episodes drive which story threads, where your arcs peak and resolve, and where your season feels thin.\n\nAdmin controls let showrunners lock arcs and episodes to prevent writers from accidentally breaking series continuity."
  },
  {
    "order": 35,
    "heading": "Client Customisation — Your Brand on the Platform",
    "body": "Client Customisation (also called white-labeling) allows production companies and agencies to present Screenplay Studio under their own branding.\n\nCustomisable elements:\n— Logo (replaces the Screenplay Studio logo in the header)\n— Primary and accent colors (CSS variables applied globally)\n— Company name (shown in the tab title and browser metadata)\n— Custom domain (serve the app from yourcompany.io)\n— Email sender name for notifications (From: YourCompany instead of Screenplay Studio)\n— Welcome screen art and messaging\n— Feature visibility toggles (hide features your clients do not need)\n\nClient customisation is stored per organisation/workspace. When a user belongs to a white-labelled workspace, they see the client branding everywhere.\n\nThis feature is Pro-tier only."
  },
  {
    "order": 36,
    "heading": "Feature Flags — Experimental and Opt-In Features",
    "body": "Feature flags control which features are enabled for which users or projects.\n\nFlag types:\n— GLOBAL: Enabled platform-wide (admin controls these)\n— USER: Opt-in per user (visible in Account Settings → Labs)\n— PROJECT: Enabled per project (project owner enables in Project Settings)\n— BETA: Features in beta testing, invite-only\n\nEach flag stores:\n— Flag key (machine-readable name)\n— Display name and description\n— Default state (on/off)\n— Who has overridden it\n\nFeature flags allow gradual rollouts: a new feature can go to 5% of users first, then 25%, then everyone. They also allow emergency disablement without a deployment — if a new feature breaks something in production, flipping a flag turns it off instantly.\n\nAs a user, you will see a Labs section in your account settings showing all available opt-in experiments."
  },
  {
    "order": 37,
    "heading": "Security & Legal — Locked Down",
    "body": "Screenplay Studio takes security seriously. Here is the full picture:\n\nROW LEVEL SECURITY (RLS) is enabled on every single table in the database. This is a PostgreSQL feature where the database itself enforces who can read, insert, update, or delete every row. Even if someone bypasses the application layer, the database refuses unauthorized access.\n\nAUTHENTICATION: Supabase Auth handles login — email/password, magic links, and OAuth providers (Google, GitHub). JWTs are used for all API calls; the auth.uid() function in RLS policies verifies the caller's identity at query execution time.\n\nDATA ISOLATION: Projects are completely isolated. A user who is not a member of a project cannot read a single scene, character, or document from it. The RLS policies check project membership on every query.\n\nADMIN CONTROLS: There is a single admin UUID hardcoded into critical policies (the platform admin). This admin can see and manage all content for moderation purposes, but normal users have no elevated access to each other's data.\n\nLEGAL DOCUMENTS: The security & legal module stores platform-level legal documents (Terms of Service, Privacy Policy, acceptable use policies) with version tracking. Users are prompted to re-accept terms when new versions are published.\n\nSECURITY DEFINER FUNCTIONS: Sensitive database functions (like cast payment processing, challenge result computation, and heartbeat handling) run as SECURITY DEFINER — they execute with elevated privileges but only do exactly what they are designed to do, with no client-controllable inputs that could be abused."
  },
  {
    "order": 38,
    "heading": "Sidebar Layouts — Make the Editor Yours",
    "body": "The sidebar is where most of your navigation and tooling lives — scene list, character list, notes, annotations, comments, etc.\n\nSidebar Layouts lets you save custom arrangements:\n— Which panels are open or collapsed\n— The order of panels\n— Whether the sidebar is narrow, wide, or hidden\n— A name for the layout (e.g. Writing Mode, Review Mode, Production Mode)\n\nYou can switch between saved layouts with one click. Switching from Writing Mode (sidebar hidden, full-screen editor) to Review Mode (scene list + annotations + comments) takes half a second.\n\nLayouts are saved per user, not per project, so your preferred writing setup follows you across your productions."
  },
  {
    "order": 39,
    "heading": "Pro Subscription — Unlock Everything",
    "body": "Screenplay Studio has a free tier and a Pro tier. Here is the breakdown:\n\nFREE TIER:\n— 3 active projects\n— 1 collaborator per project\n— Core script editor (all element types)\n— Scene management\n— Characters and locations\n— Ideas board\n— Community access (read)\n\nPRO TIER (subscription, monthly or annual):\n— Unlimited projects\n— Unlimited collaborators per project\n— Shot lists and storyboards\n— Production schedule and shoot days\n— Budget tracker\n— Cast & Payroll module\n— Cast Documents vault\n— Work time tracking\n— Revision history with industry colors\n— Advanced versioning (branches)\n— Arc & episode planner (for TV/series)\n— Broadcast, Audio Drama, Stage Play modes\n— Client Customisation / white-labeling\n— Advanced development tools\n— Festival Bridge\n— Priority support\n— Export to PDF (all document types)\n\nPro status is stored on the user profile and checked via RLS policies and application-layer guards. When a Pro subscription lapses, projects are read-only (not deleted) until the subscription is reinstated."
  },
  {
    "order": 40,
    "heading": "The Community Hub — Where Writers Meet",
    "body": "The Community Hub is the public-facing social layer of Screenplay Studio. It is where writers share their work, give and receive feedback, compete in challenges, and find collaborators.\n\nThe Community is separate from your private projects — nothing from your project appears in the Community unless you explicitly publish it.\n\nThe Hub has five main areas:\n1. Shared Scripts (community_posts)\n2. Writing Challenges\n3. The Free-Use Library\n4. Script Productions (films made from free scripts)\n5. Subcommunities (genre-specific groups)\n\nAll community content is publicly readable without an account. Writing, voting, and submitting requires a free account."
  },
  {
    "order": 41,
    "heading": "Community Script Sharing — Put Your Work Out There",
    "body": "You can publish any script to the Community as a community post. You control exactly what others can do with it via permission flags:\n\n— ALLOW COMMENTS: Others can leave feedback comments on your script. Default on.\n— ALLOW SUGGESTIONS: Others can leave line-level suggestions (separate from regular comments). Default on.\n— ALLOW EDITS: Others can directly propose edits to your script (collaborative distro-style editing). Default off.\n— ALLOW DISTROS: Others can fork your script and publish their own version (crediting you as the source). Default off.\n— ALLOW FREE USE: Your script is placed in the Free-Use Library — anyone can produce a film from it for free. Default off.\n— COPYRIGHT DISCLAIMER ACCEPTED: Required before Free Use can be enabled.\n\nPublished posts appear in the Community feed. They can be tagged with categories: Feature Film, Short Film, TV/Series, Web Series, Documentary, Animation, Horror, Comedy, Drama, Sci-Fi.\n\nEngagement metrics:\n— View count (incremented on each page view)\n— Upvote count (one upvote per user, togglable)\n— Comment count\n— Distro count"
  },
  {
    "order": 42,
    "heading": "Upvotes & Community Voting — The Best Script Wins",
    "body": "The upvote system is simple and clean: one upvote per user per post, togglable. Click to upvote, click again to remove.\n\nUnder the hood, the toggle_community_upvote() RPC function handles this atomically — it checks for an existing upvote, adds or removes it, and updates the denormalized upvote_count on the post in one database transaction. No race conditions, no double-votes.\n\nUpvote counts feed into the Community feed sort order: you can browse by Recent, Most Upvoted This Week, Most Upvoted All Time, or Category.\n\nChallenge voting (separate from community post upvotes) follows a stricter rule: one vote per user per challenge, enforced by a UNIQUE constraint on (user_id, challenge_id) in the challenge_votes table."
  },
  {
    "order": 43,
    "heading": "Script Distros — Build on Each Other",
    "body": "Distros are forks. When a writer marks their script as allow_distros = true, other community members can create their own version — a distro — based on the original.\n\nA distro:\n— Credits the original post/author automatically\n— Is published as a separate community post\n— Can be further distro'd if the distro author also enables it\n— Increments the distro_count on the original post\n\nThe distro chain creates a visible lineage: Original → Distro A → Distro B. Readers can follow the chain and see how different writers interpreted the same source material.\n\nDistros are popular for premise sharing (a writer publishes a premise/premise script and others write different executions of it) and for translation/adaptation challenges."
  },
  {
    "order": 44,
    "heading": "The Free-Use Library & Script Productions",
    "body": "The Free-Use Library is one of the most unusual features on the platform — and one of the most valuable for emerging filmmakers.\n\nA writer can mark their script as allow_free_use = true (after accepting the copyright disclaimer). This places the script in the Free-Use Library, where any filmmaker can download it and produce a film from it, for free, without asking permission.\n\nThis creates a virtuous cycle: writers who want their work produced can make it freely available; filmmakers who want a quality script without development costs can find one immediately.\n\nWhen a film is made from a free-use script, the filmmaker submits it as a Script Production:\n— Title of the film\n— Description\n— URL (YouTube, Vimeo, festival site, etc.)\n— Thumbnail image\n\nSubmissions are reviewed by the admin (status: pending → approved/rejected). Approved productions appear on the original script's page and in the Community productions feed.\n\nThis creates a portfolio for both the writer (evidence their scripts get made) and the filmmaker (credits attached to a verifiable source script)."
  },
  {
    "order": 45,
    "heading": "Weekly Writing Challenges — Sharpen Your Craft",
    "body": "Every Monday at 00:00 UTC, a new Weekly Writing Challenge launches automatically.\n\nHere is how the full lifecycle works:\n\nMONDAY 00:00 — Challenge launches. The ensure_weekly_challenge() database function runs, picks a challenge theme from the pool (favoring least-used themes, with randomness as tiebreaker), creates the challenge record, and publishes the prompt.\n\nFRIDAY 21:00 — Submissions close. No new submissions accepted.\n\nSATURDAY 23:59 — Voting closes. Community members vote for their favorite submission. One vote per person per challenge. Votes are tracked in the challenge_votes table with a UNIQUE constraint enforcing the one-vote rule.\n\nSUNDAY 12:00 — Results revealed. The compute_challenge_results() function recounts all votes, assigns placements (1st, 2nd, 3rd, etc. — ties broken by submission time), and marks the winners.\n\nChallenge themes in the pool (a sample):\n— The Last Day / Wrong Number / The Room / Silent Protagonist / 24 Hours\n— Strangers on a Train / The Letter / Midnight / The Job Interview\n— Found Footage / Time Loop / The Heist / First Contact / The Dinner Party\n— Unreliable Narrator / Two Timelines / The Chase / Bottle Episode\n— Backwards / The Audition\n— (+ more added by admin over time)\n\nEach theme has a difficulty tag (beginner, intermediate, advanced) and an optional genre hint and constraint. Themes track how many times they have been used so variants are not repeated too often.\n\nChallenge rewards: PRO prize structure is configurable per challenge by admin. Winners earn XP (feeds into the Gamification system) and a winner badge on their profile."
  },
  {
    "order": 46,
    "heading": "Community Chat & File Uploads — Stay Connected",
    "body": "The Community Chat is a live chat room attached to the Community Hub (separate from the per-project channels). It has:\n— A general Community channel\n— Challenge-specific chat rooms (automatically created per weekly challenge)\n— Subcommunity channels\n\nMessages are real-time via Supabase Realtime. Messages are stored in the database (not ephemeral) so you can scroll history.\n\nFile Uploads in the community allow members to share:\n— Reference images and mood board assets\n— Script excerpts (PDF)\n— Research documents\n— Portfolio links\n\nFiles are stored in a community-specific Supabase Storage bucket. Uploaded files are associated with the uploader's profile and a community post or channel. RLS ensures users can only delete their own uploads; admin can remove anything."
  },
  {
    "order": 47,
    "heading": "Subcommunities — Find Your Tribe",
    "body": "Subcommunities are genre- or topic-specific spaces within the Community Hub. Think subreddits, but for screenwriters.\n\nEach subcommunity has:\n— A name, slug, description, and icon\n— A type (genre, format, craft topic, regional, etc.)\n— A charter (community rules)\n— Moderators (users with elevated rights within the subcommunity)\n— Member join/leave\n— A dedicated feed of community posts tagged to that subcommunity\n— A dedicated chat channel\n— Challenge submissions filtered to that genre\n\nJoining a subcommunity is free. Moderators can pin posts, remove content that violates the charter, and set the subcommunity's description and icon.\n\nSubcommunities support public (anyone can join) and private (join by request) modes."
  },
  {
    "order": 48,
    "heading": "Gamification — XP, Badges & Streaks",
    "body": "Writing is a lonely discipline that benefits enormously from positive reinforcement. The Gamification module adds a progress and achievement system underneath everything you do on the platform.\n\nEARNING XP:\n— Publishing a community post: +50 XP\n— Receiving an upvote: +5 XP\n— Completing a weekly challenge: +100 XP\n— Placing 1st/2nd/3rd in a challenge: +500/+300/+150 XP\n— Completing a script (marking it done): +200 XP\n— Daily login streak (consecutive days): +10 XP/day building to +50 XP/day at 7-day streak\n— Completing a course: XP value set per course\n— First time finishing an act: +25 XP\n\nLEVELS: XP feeds into a level system. Levels are displayed on your profile and in community posts. Reaching level 10 is the minimum requirement to create community courses.\n\nBADGES: Specific achievements unlock badge icons shown on your profile:\n— First Script (complete your first script)\n— Community Voice (first published community post)\n— Challenge Winner (place 1st in any challenge)\n— Triple Threat (place in 3 separate challenges)\n— Distro King (5 of your scripts get distro'd)\n— Free Use Hero (one of your free-use scripts gets produced)\n— Speed Writer (complete a challenge submission in under 2 hours)\n— Streak Master (30-day daily login streak)\n— Course Creator (publish your first course)\n— Master Craftsman (level 25)\n\nSTREAKS: Consecutive-day usage streaks are tracked and displayed. Breaking a streak is... not great. The streak system incentivizes daily writing habits, which is the single most effective writer behavior change."
  },
  {
    "order": 49,
    "heading": "Courses — Learn the Craft",
    "body": "The Courses module is a full learning management system built into the platform.\n\nStructure:\n— COURSE: The top-level container. Has a title, description, short description, cover image, difficulty (beginner/intermediate/advanced/expert), estimated minutes, XP reward, and tags.\n— SECTION: A chapter within a course. Has a title and sort order.\n— LESSON: Individual lesson within a section. Types: video, text, exercise, quiz. Has a title, content (markdown or video embed), and optional source URL.\n\nENROLLMENT: Users click Enroll on any published course. This creates a course_enrollment record with:\n— Enrollment date\n— Progress percentage (auto-calculated)\n— Last accessed timestamp\n— Completion date\n— Rating (1–5 stars, via the rate_course() function)\n\nLESSON PROGRESS: Each lesson completed is tracked in course_lesson_progress. Completing lessons automatically updates the enrollment progress percentage via a database trigger.\n\nCOURSE TYPES:\n— SYSTEM: Official Screenplay Studio courses (created by admin/platform team)\n— USER: Community-created courses (available to level 10+ users)\n\nRatings: The rate_course() function handles rating with proper average calculation — it subtracts the old rating before adding the new one, keeping rating_sum and rating_count accurate without race conditions.\n\nSystem courses preloaded on the platform:\n— Screenplay Formatting Fundamentals (45 min, beginner, 200 XP)\n— Writing Compelling Themes (60 min, intermediate, 150 XP)\n— Three-Act Structure Deep Dive (50 min, beginner, 175 XP)"
  },
  {
    "order": 50,
    "heading": "The Blog — Stories Behind the Build",
    "body": "The Screenplay Studio Blog exists for one reason: to document what is being built, why it was built, and what comes next.\n\nBlog posts support:\n— A title, slug, and excerpt\n— A cover image\n— Sections (JSONB array of {heading, body, order} — the same structure you are reading right now)\n— Tags\n— Status: draft / published / archived\n— Comment section (threaded, moderated)\n— View counter\n\nBlog comments support:\n— Threading (reply to a comment)\n— Pinning (admin can pin important comments to the top)\n— Hiding (admin can remove spam/violations without deleting)\n— Logged-in only posting (no anonymous noise)\n\nAccess policies:\n— Anyone can read published posts (logged in or not)\n— Only logged-in users can comment\n— Only the admin can create, edit, or delete posts\n— Users can edit their own comments; admin can delete any comment\n\nThis blog post itself is a test of the blog system — and somehow the most meta thing on the platform."
  },
  {
    "order": 51,
    "heading": "Festival Bridge — Submit to Festivals",
    "body": "The Festival Bridge module connects your finished project to the film festival circuit.\n\nIt stores:\n— Festival name, location, and website\n— Submission deadline\n— Submission fee\n— Submission status: researching / preparing / submitted / confirmed / declined / screening / won / not selected\n— Submission date\n— Result date\n— Category/award track (e.g. Best Short Film, Best Screenplay, Grand Jury)\n— Notes\n— Contact at the festival\n— Submission materials checklist (logline done, screener uploaded, press kit ready, etc.)\n\nThe Festival Bridge dashboard shows your entire festival strategy at a glance: which festivals you are targeting, which deadlines are coming up, which submissions are pending, and which films are screening where.\n\nInternational festival data (using the festival_bridge migration tables) connects to a community-maintained directory of festivals with their historical acceptance rates, average scores, and submission tips shared by other members who entered."
  },
  {
    "order": 52,
    "heading": "Project Templates — Start Smart",
    "body": "Starting a new project from scratch is inefficient if you always need the same structure. Project Templates solve this.\n\nYou can save any project as a template:\n— The script structure (scenes, elements) is saved\n— Character archetypes (if you have recurring character types)\n— Location types\n— Standard shot list templates\n— Budget category structure with common line items pre-populated\n— Ideas board initial columns\n— Production schedule event types relevant to your workflow\n\nWhen creating a new project, choose a template and everything is cloned into the new project. Edit from there.\n\nSystem templates (provided by the platform) cover common formats:\n— Feature Film: three-act breakdown with act 1/2/3 scenes pre-labeled\n— TV Pilot: cold open + 4 acts + tag structure\n— Short Film (10-15 min): lean 2-act structure\n— Documentary: interview setup + B-roll structure\n— Stage Play: two-act structure with scene/beat breakdown\n\nCustom templates you create are private to your account by default, or you can publish them to the Community for others to use."
  },
  {
    "order": 53,
    "heading": "Multi-Location Markers — One Scene, Many Places",
    "body": "A scripted location is often not a single real-world place. The coffee shop where your protagonist has their breakdown was actually shot:\n— Exterior: a cafe in Brooklyn\n— Interior booth scenes: a studio set in Burbank\n— Counter scenes: a different cafe in Williamsburg\n\nMulti-Location Markers let you attach multiple physical location records to a single scripted location (and by extension, to the scenes that use that location).\n\nEach marker stores:\n— The scripted location it refers to\n— The physical location record (from the locations database)\n— Which portion of scenes use this physical location (exterior / interior / close-ups / etc.)\n— Notes for the AD and location manager\n\nThis is a small feature with enormous practical value: scouting reports, call sheets, and location release forms can be generated per physical location rather than per scripted location, which matches how actual production management works."
  },
  {
    "order": 54,
    "heading": "Full-Text Search — Find Anything",
    "body": "Screenplay Studio supports full-text search across your script content, powered by PostgreSQL's native GIN indexes.\n\nThe script_elements table has a GIN full-text search index on the content column:\n  idx_script_elements_content_search using gin(to_tsvector('english', content))\n\nThis means searching for a word or phrase returns results in milliseconds across scripts of any length. The search respects stemming (searching for 'run' finds 'running', 'ran', 'runs') and stop-word filtering.\n\nCharacter names are indexed with trigram (pg_trgm) search:\n  idx_characters_name_search using gin(name gin_trgm_ops)\n\nThis enables fuzzy name matching — searching for 'Samantha' can surface 'Sam', 'Sami, 'Sammy' etc. Great for tracking down a character whose name changed mid-draft.\n\nCommunity posts, blog posts, and courses are also full-text searchable via their respective indexes."
  },
  {
    "order": 55,
    "heading": "The Admin Kingdom — Site Settings",
    "body": "The admin has a site-wide settings panel that controls platform-level defaults and toggles.\n\nSite settings include:\n— Platform name and tagline (for white-label deployments)\n— Maintenance mode flag (takes the whole platform into a read-only maintenance screen)\n— Registration open/closed flag\n— Default feature flag states (the starting values for all feature toggles)\n— Email configuration (SMTP settings for notifications)\n— Storage quotas per tier (free vs Pro file storage limits)\n— Rate limits per endpoint\n— Community moderation settings (auto-hide threshold for reported content, cooldown periods)\n— Challenge auto-generation toggle (turn off auto-weekly if you want manual control)\n— XP multiplier for special events (double XP weekends, etc.)\n— Announcement banner text and status\n\nSite settings are stored in the site_settings_schema table with a single row (one global config). The admin UUID is the only user who can read or write to this table."
  },
  {
    "order": 56,
    "heading": "Auto-Trigger Magic — The Invisible Glue",
    "body": "The database has a network of trigger functions that keep everything consistent automatically. Here is the complete list:\n\nON USER SIGNUP: handle_new_user() auto-creates a profiles row populated from OAuth metadata (name, avatar URL, email).\n\nON PROJECT CREATED: handle_new_project() auto-inserts the creator as project owner in project_members.\n\nON PROJECT CREATED: handle_new_project_script() auto-creates the first draft script titled [Project Title] — Draft 1.\n\nON CAST MEMBER UPDATE: update_cast_member_updated_at() keeps updated_at current.\n\nON ANY UPDATE: update_updated_at_column() runs on profiles, projects, scripts, script_elements, characters, locations, scenes, shots, production_schedule, ideas, budget_items, comments, and others.\n\nON CHALLENGE VOTE: cascade updates vote_count on the submission.\n\nON COMMUNITY UPVOTE TOGGLE: toggle_community_upvote() atomically updates upvote_count.\n\nON COURSE LESSON COMPLETION: sync_course_progress() recalculates the enrollment progress percentage and sets completed_at on first 100% completion.\n\nON COURSE ENROLLMENT: bump_course_enrollment() increments enrollment_count on the course.\n\nNone of this is application logic you have to remember and call — it just happens. The database enforces its own consistency."
  },
  {
    "order": 57,
    "heading": "The Big Picture — Who Is This Platform For?",
    "body": "After all of that — and congratulations for making it this far — here is the answer to the question we should have started with.\n\nScreenplay Studio is for:\n\nTHE SOLO WRITER: who wants a distraction-free, properly formatted, auto-saving script editor that does not cost $400/year and does not require a desktop app.\n\nTHE WRITING TEAM: who needs real-time co-authoring, inline comments, role-based access, and a shared schedule — without the back-and-forth of emailing Word documents.\n\nTHE INDIE FILMMAKER: who needs the script AND the production tools AND the cast payroll AND the schedule AND the documents in one place, because they cannot afford separate software for each department.\n\nTHE SHOWRUNNER: who needs arc tracking, episode management, a season-level view, a writers room communication tool, and role-controlled access for a team of 12 writers.\n\nTHE WRITING STUDENT: who wants to build a portfolio, get feedback from the community, participate in weekly challenges, earn XP for actually writing, and learn from structured courses.\n\nTHE PRODUCTION COMPANY: who needs client whitelabeling, project templates, multi-project dashboard folders, a full team permission system, and centralized document storage.\n\nTHE HOBBYIST: who just wants to write something fun, share it with the community, and see if it gets upvoted. No judgment. Some of the best scripts on the platform come from this group.\n\nWhatever you are making — feature, short, series, podcast, play, or the one-page sketch you wrote at 2am — Screenplay Studio is built to hold all of it. Welcome to the platform."
  }
]
$sections$::jsonb,

  ARRAY[
    'guide',
    'features',
    'platform',
    'tutorial',
    'screenwriting',
    'production',
    'community',
    'gamification',
    'courses',
    'payroll',
    'collaboration'
  ],

  'published',

  NOW(),

  'f0e0c4a4-0833-4c64-b012-15829c087c77',

  true
);
