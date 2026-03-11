-- ============================================================
--  CHANGELOG & RELEASE TRACKING SYSTEM
--  Screenplay Studio — Platform Version History
--  Run in: Supabase Dashboard > SQL Editor
--  Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout
-- ============================================================
--
--  Tables:
--    changelog_releases  — one row per version (e.g. "1.4.0")
--    changelog_entries   — individual change items per release
--
--  Functions:
--    publish_release(v_number TEXT)
--      → marks a release as published and bumps site_settings.site_version
--
--  RLS:
--    Public read for published releases & entries
--    Admin-only write (same UUID as the rest of the platform)
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE changelog_release_status AS ENUM ('draft', 'published', 'yanked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE changelog_entry_type AS ENUM (
    'feature',      -- brand new capability
    'improvement',  -- existing feature made better
    'fix',          -- bug squashed
    'performance',  -- faster / lighter
    'security',     -- hardening, policy changes
    'breaking',     -- something changed in a way that affects existing behaviour
    'deprecation',  -- something is going away soon
    'internal'      -- infrastructure/dev-only change (hidden from public UI)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE changelog_area AS ENUM (
    'editor',
    'scripts',
    'scenes',
    'characters',
    'locations',
    'production',
    'schedule',
    'cast',
    'budget',
    'gear',
    'storyboard',
    'community',
    'challenges',
    'courses',
    'gamification',
    'collaboration',
    'documents',
    'versioning',
    'formats',
    'arc_planner',
    'work_tracking',
    'festival',
    'blog',
    'admin',
    'auth',
    'database',
    'performance',
    'api',
    'ui'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ──────────────────────────────────────────────────────────────
-- 2. changelog_releases — one row per platform version
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS changelog_releases (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Semantic version string: MAJOR.MINOR.PATCH
  version        TEXT        NOT NULL UNIQUE,

  -- Short title shown as the release headline e.g. "The Community Drop"
  title          TEXT        NOT NULL,

  -- Optional longer description / release notes intro paragraph
  summary        TEXT,

  -- Release type for UI badge
  release_type   TEXT        NOT NULL DEFAULT 'minor'
    CHECK (release_type IN ('major', 'minor', 'patch', 'hotfix')),

  status         changelog_release_status NOT NULL DEFAULT 'draft',

  -- When this was (or will be) shipped
  released_at    TIMESTAMPTZ,

  -- Optional blog post link
  blog_post_slug TEXT,

  -- Denormalized entry counts (filled by trigger)
  feature_count     INTEGER DEFAULT 0,
  improvement_count INTEGER DEFAULT 0,
  fix_count         INTEGER DEFAULT 0,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE changelog_releases IS
  'One row per platform release. publish_release() marks it published and
   bumps site_settings.site_version to this version string.';

CREATE INDEX IF NOT EXISTS idx_changelog_releases_status
  ON changelog_releases (status, released_at DESC);


-- ──────────────────────────────────────────────────────────────
-- 3. changelog_entries — individual change items per release
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS changelog_entries (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id   UUID         NOT NULL REFERENCES changelog_releases(id) ON DELETE CASCADE,

  -- Short one-line headline shown in the changelog list
  title        TEXT         NOT NULL,

  -- Optional longer description (markdown supported in the UI)
  description  TEXT,

  entry_type   changelog_entry_type NOT NULL DEFAULT 'feature',
  area         changelog_area       NOT NULL DEFAULT 'editor',

  -- Internal entries are logged but not shown in the public changelog UI
  is_public    BOOLEAN      NOT NULL DEFAULT true,

  -- Optional: link to related blog post section or docs page
  link_url     TEXT,

  -- Pull request / issue number for dev reference
  pr_number    INTEGER,

  sort_order   INTEGER      NOT NULL DEFAULT 0,

  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE changelog_entries IS
  'Individual changes within a release. Every feature, fix, and improvement
   gets its own row. Group them by release_id.';

CREATE INDEX IF NOT EXISTS idx_changelog_entries_release
  ON changelog_entries (release_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_type
  ON changelog_entries (entry_type, area);


-- ──────────────────────────────────────────────────────────────
-- 4. RLS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE changelog_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelog_entries  ENABLE ROW LEVEL SECURITY;

-- Public can read published releases
DROP POLICY IF EXISTS "changelog_releases_public_read" ON changelog_releases;
CREATE POLICY "changelog_releases_public_read" ON changelog_releases
  FOR SELECT USING (status = 'published');

-- Admin can do everything with releases
DROP POLICY IF EXISTS "changelog_releases_admin_all" ON changelog_releases;
CREATE POLICY "changelog_releases_admin_all" ON changelog_releases
  FOR ALL USING (auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

-- Public can read entries for published releases (and only public entries)
DROP POLICY IF EXISTS "changelog_entries_public_read" ON changelog_entries;
CREATE POLICY "changelog_entries_public_read" ON changelog_entries
  FOR SELECT USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM changelog_releases r
      WHERE r.id = release_id AND r.status = 'published'
    )
  );

-- Admin can do everything with entries
DROP POLICY IF EXISTS "changelog_entries_admin_all" ON changelog_entries;
CREATE POLICY "changelog_entries_admin_all" ON changelog_entries
  FOR ALL USING (auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);


-- ──────────────────────────────────────────────────────────────
-- 5. TRIGGER: auto-update updated_at on releases
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_changelog_release_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS changelog_releases_updated_at ON changelog_releases;
CREATE TRIGGER changelog_releases_updated_at
  BEFORE UPDATE ON changelog_releases
  FOR EACH ROW EXECUTE FUNCTION update_changelog_release_updated_at();


-- ──────────────────────────────────────────────────────────────
-- 6. TRIGGER: keep denormalized entry counts in sync
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_changelog_release_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_release_id UUID;
BEGIN
  -- Works on both INSERT and DELETE
  v_release_id := COALESCE(NEW.release_id, OLD.release_id);

  UPDATE changelog_releases SET
    feature_count     = (SELECT COUNT(*) FROM changelog_entries WHERE release_id = v_release_id AND entry_type = 'feature'     AND is_public = true),
    improvement_count = (SELECT COUNT(*) FROM changelog_entries WHERE release_id = v_release_id AND entry_type = 'improvement' AND is_public = true),
    fix_count         = (SELECT COUNT(*) FROM changelog_entries WHERE release_id = v_release_id AND entry_type = 'fix'         AND is_public = true),
    updated_at        = now()
  WHERE id = v_release_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_changelog_counts ON changelog_entries;
CREATE TRIGGER trg_sync_changelog_counts
  AFTER INSERT OR UPDATE OR DELETE ON changelog_entries
  FOR EACH ROW EXECUTE FUNCTION sync_changelog_release_counts();


-- ──────────────────────────────────────────────────────────────
-- 7. FUNCTION: publish_release(version_string)
--    Marks the release published, sets released_at, and bumps
--    site_settings.site_version to the new version.
--    Only callable by authenticated users (admin enforced by RLS).
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION publish_release(v_version TEXT)
RETURNS changelog_releases
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_release changelog_releases%ROWTYPE;
BEGIN
  -- Verify caller is admin
  IF auth.uid() != 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid THEN
    RAISE EXCEPTION 'Unauthorized: only admin can publish releases';
  END IF;

  -- Find and update the release
  UPDATE changelog_releases
  SET status      = 'published',
      released_at = COALESCE(released_at, now()),
      updated_at  = now()
  WHERE version = v_version
  RETURNING * INTO v_release;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Release version % not found', v_version;
  END IF;

  -- Bump the global site version
  INSERT INTO site_settings (key, value, updated_at)
  VALUES ('site_version', v_version, now())
  ON CONFLICT (key) DO UPDATE
    SET value      = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at;

  RETURN v_release;
END;
$$;

COMMENT ON FUNCTION publish_release(TEXT) IS
  'Marks a changelog release as published and updates site_settings.site_version.
   Call from the admin panel when a release is ready to go live.
   Example: SELECT publish_release(''2.6.0'');';


-- ──────────────────────────────────────────────────────────────
-- 8. HELPER VIEW: public changelog feed
--    Returns released versions with their entry counts, newest first.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public_changelog AS
SELECT
  r.id,
  r.version,
  r.title,
  r.summary,
  r.release_type,
  r.released_at,
  r.blog_post_slug,
  r.feature_count,
  r.improvement_count,
  r.fix_count,
  r.feature_count + r.improvement_count + r.fix_count AS total_changes
FROM changelog_releases r
WHERE r.status = 'published'
ORDER BY r.released_at DESC;

GRANT SELECT ON public_changelog TO authenticated, anon;


-- ──────────────────────────────────────────────────────────────
-- 9. SEED DATA — full version history of the platform
--    (all released as published with historical dates)
-- ──────────────────────────────────────────────────────────────

-- ── Releases ─────────────────────────────────────────────────

INSERT INTO changelog_releases
  (version, title, summary, release_type, status, released_at)
VALUES

  ('1.0.0', 'The Beginning', 
   'The original Screenplay Studio launch. Screenplay formatting that doesn''t make you want to throw your laptop out the window, real-time collaboration that actually works, and a project management layer that respects how productions actually operate.',
   'major', 'published', '2025-01-15 12:00:00+00'),

  ('1.1.0', 'The Community Drop',
   'Writers deserve a place to share work, get feedback, and compete. The Community Hub changes the platform from a private tool into a living ecosystem where scripts get read, rated, and — eventually — made.',
   'minor', 'published', '2025-02-10 12:00:00+00'),

  ('1.2.0', 'Full Pre-Production',
   'The shot list, storyboard, continuity sheet, call sheets, and Day Out of Days. Everything the AD and DP need to turn a script into a shooting plan without leaving the platform.',
   'minor', 'published', '2025-03-05 12:00:00+00'),

  ('1.3.0', 'Cast & Payroll',
   'Manage your actors like a production company. Full cast profiles, pay rates in any currency, a payment ledger with overdue detection, and a locked-down document vault for contracts and permits.',
   'minor', 'published', '2025-03-28 12:00:00+00'),

  ('1.4.0', 'Gamification',
   'Writing is hard. XP, badges, streaks, and levels are a small bribe to keep going. They work. Don''t overthink it.',
   'minor', 'published', '2025-04-18 12:00:00+00'),

  ('1.5.0', 'The Learning Studio',
   'A full course system built into the platform. Enroll, track progress lesson by lesson, earn XP on completion, and — once you hit level 10 — create your own courses for the community.',
   'minor', 'published', '2025-05-12 12:00:00+00'),

  ('1.6.0', 'Series & Arc Planning',
   'TV writers needed a writers room tool, not just a script editor. The Arc & Episode Planner adds a visual season grid, arc tracking, episode-by-episode status, and showrunner lock controls.',
   'minor', 'published', '2025-06-03 12:00:00+00'),

  ('1.7.0', 'Stage & Audio',
   'Screenplay format is not the only format. Stage play mode and audio drama / podcast mode are now first-class citizens with their own element types, export formats, and format-specific metadata.',
   'minor', 'published', '2025-06-25 12:00:00+00'),

  ('1.8.0', 'Broadcast Mode',
   'News, promos, and live TV scripts use a two-column A/V format that has nothing in common with screenplays. Broadcast mode adds the full A/V editor, SUPER elements, VO/SOT distinction, and a broadcast contacts database.',
   'minor', 'published', '2025-07-14 12:00:00+00'),

  ('1.9.0', 'Work Time Tracking',
   'Know how many hours you actually spent on a project. Heartbeat-based session tracking with smart idle detection, per-context breakdown, and team-visible hours for project owners.',
   'minor', 'published', '2025-08-01 12:00:00+00'),

  ('2.0.0', 'The Big Two',
   'A major release: Git-inspired script branching, the Festival Bridge for the festival circuit, advanced script versioning with diff and merge, and the full production tools suite brought to full maturity.',
   'major', 'published', '2025-09-20 12:00:00+00'),

  ('2.1.0', 'Subcommunities',
   'The Community Hub gets depth. Genre-specific and topic-specific subcommunities with their own feeds, moderators, charter rules, and dedicated chat channels.',
   'minor', 'published', '2025-10-08 12:00:00+00'),

  ('2.2.0', 'White-Label & Client Customisation',
   'Run Screenplay Studio under your own company name and logo. Custom domains, branded emails, color themes, and per-workspace feature visibility. Built for agencies and production companies.',
   'minor', 'published', '2025-10-30 12:00:00+00'),

  ('2.3.0', 'Feature Flags & Labs',
   'Gradual rollouts, opt-in experiments, and emergency kill switches. Every new feature now goes through the flags system. Users get a Labs tab to opt into betas early.',
   'minor', 'published', '2025-11-14 12:00:00+00'),

  ('2.4.0', 'Folders & Organization',
   'Personal project folders with nesting support, dashboard-level shared folders for teams, and a full drag-and-drop tree for organizing a large project slate without scrolling forever.',
   'minor', 'published', '2025-12-02 12:00:00+00'),

  ('2.5.0', 'Production Operations',
   'The continuity sheet, call sheets, Day Out of Days, script coverage, and table read tracking are now fully integrated into shoot day planning. Props and costume tracking per scene via the scene breakdown panel.',
   'minor', 'published', '2026-01-09 12:00:00+00'),

  ('2.6.0', 'The Changelog',
   'Meta milestone: the platform now has a proper versioned changelog with release notes, change categorization by type and area, and a public feed. The site version number in the footer is now live and kept automatically in sync.',
   'minor', 'published', '2026-03-11 12:00:00+00')

ON CONFLICT (version) DO NOTHING;


-- ── Entries for v1.0.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.0.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Script editor with industry-standard element types', 'Scene headings, action, dialogue, character, parenthetical, transition, shot, and internal note elements. Each line is a separate database record enabling conflict-free real-time editing.', 'feature', 'editor', 1),
  ('Real-time multi-user collaboration', 'Multiple writers can edit simultaneously. Changes arrive via WebSocket in milliseconds. Cursor presence shows where each collaborator is in the document.', 'feature', 'collaboration', 2),
  ('Projects with role-based access control', 'Owner, Admin, Editor, Viewer roles enforced at the database level via Row Level Security on every table.', 'feature', 'editor', 3),
  ('Scene management panel', 'Bird''s eye view of all scenes. Drag to reorder, click to navigate, track page count and screen time estimates, add color coding and tags.', 'feature', 'scenes', 4),
  ('Character bible', 'Full character profiles with biography, arc notes, relationships, and auto-population from script parsing.', 'feature', 'characters', 5),
  ('Location database', 'Master location library with GPS, contact info, rental rates, photo gallery, permit tracking, and reuse across scenes.', 'feature', 'locations', 6),
  ('Production schedule (calendar)', 'Full calendar with event types: shooting, rehearsal, table read, scout, meeting, and more. Call times, wrap times, crew assignment.', 'feature', 'schedule', 7),
  ('Ideas board (Kanban)', 'SPARK → EXPLORING → PROMISING → IN SCRIPT → SHELVED columns. Category, priority, tags, reference URLs, and collaborator assignment per card.', 'feature', 'editor', 8),
  ('Budget tracker', 'Line-item budget with above-the-line / below-the-line categories, estimated vs actual tracking, and variance warnings.', 'feature', 'budget', 9),
  ('Auto-save on every keystroke', 'No Save button. Every edit is persisted immediately. You will never lose work.', 'feature', 'editor', 10),
  ('Threaded comments on any entity', 'Attach threaded discussion to scenes, characters, shots, locations, ideas, and more. Realtime delivery. Resolved/unresolved tracking.', 'feature', 'collaboration', 11),
  ('Project invitations by email', 'Invite collaborators by email. Invitation status tracked (pending, accepted, declined, expired). Auto-cleanup.', 'feature', 'collaboration', 12),
  ('Auto-create project owner and first script on signup', 'Database triggers handle profile creation on signup, owner membership on project create, and Draft 1 script creation automatically.', 'feature', 'database', 13),
  ('Full-text search across scripts', 'GIN index on script content for millisecond full-text search with English stemming. Trigram index on character names for fuzzy matching.', 'feature', 'scripts', 14),
  ('Industry revision color system', 'WHITE, BLUE, PINK, YELLOW, GREEN, GOLDENROD, BUFF, SALMON, CHERRY… snapshot-based revision history with full JSONB element snapshots per revision.', 'feature', 'versioning', 15)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.1.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.1.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Community Hub — share scripts publicly', 'Publish any script to the Community with fine-grained permission flags: allow comments, suggestions, edits, distros, or free use.', 'feature', 'community', 1),
  ('Community categories', 'Feature Film, Short Film, TV/Series, Web Series, Documentary, Animation, Horror, Comedy, Drama, Sci-Fi tags for browsing and discovery.', 'feature', 'community', 2),
  ('Upvote system', 'One upvote per user per post. toggle_community_upvote() handles it atomically — no race conditions, no double votes.', 'feature', 'community', 3),
  ('Community comments & suggestions', 'Threaded comments and line-level suggestions on shared scripts. Hidden-not-deleted moderation for admin.', 'feature', 'community', 4),
  ('Script Distros (forks)', 'Writers can fork any script with allow_distros enabled, creating a visible lineage of interpretations.', 'feature', 'community', 5),
  ('Free-Use Library', 'Mark a script allow_free_use to place it in the library. Any filmmaker can produce it without asking. Copyright disclaimer required.', 'feature', 'community', 6),
  ('Script Productions', 'Filmmakers submit produced films back to the original script page. Admin-moderated (pending → approved/rejected).', 'feature', 'community', 7),
  ('Weekly Writing Challenges (automated)', 'Auto-launches every Monday. ensure_weekly_challenge() picks a theme, sets the submission/voting/reveal schedule. compute_challenge_results() ranks winners.', 'feature', 'challenges', 8),
  ('Challenge theme pool with 20 seed themes', 'The Last Day, Wrong Number, Silent Protagonist, Time Loop, Found Footage, and 15 more. Tracks usage count so repeats are spaced out.', 'feature', 'challenges', 9),
  ('Community blog', 'Blog post system with sections-based JSONB structure, threaded comments, view counter, and admin-only authoring.', 'feature', 'blog', 10)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.2.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.2.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Shot list per scene', 'Full shot records: shot type, movement, lens, description, camera/lighting/sound notes, VFX flag, takes needed vs completed, storyboard URL.', 'feature', 'storyboard', 1),
  ('Storyboard panels', 'Visual storyboard linked to shots. Frame images, panel notes, audio cues, transition types, camera framing overlay. Exportable as PDF.', 'feature', 'storyboard', 2),
  ('Shoot days module', 'Day-by-day production plans with call times, per-department crew calls, scenes per day, page estimates, and location assignments.', 'feature', 'schedule', 3),
  ('Continuity sheet', 'Per-character continuity tracking: costume, hair, makeup, props, wounds, reference photo. Linked to specific scenes and characters.', 'feature', 'production', 4),
  ('Call sheets', 'Structured call sheet generator: general call, base camp, hospital, parking, weather note, crew calls as JSONB, advanced schedule.', 'feature', 'production', 5),
  ('Day Out of Days (DOOD)', 'Actor scheduling grid using industry codes: SW (start/work), W (work), WF (work/finish), H (hold), T (travel), etc.', 'feature', 'production', 6),
  ('Multi-location markers', 'Attach multiple physical locations to a single scripted location. Exterior shot here, interior shot there.', 'feature', 'locations', 7),
  ('Scene breakdown fields', 'Props, costumes, makeup notes, special effects, stunts, vehicles, animals, sound notes, music cues, VFX notes — all stored per scene for production breakdown.', 'feature', 'scenes', 8)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.3.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.3.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Cast members module', 'Full actor profiles with character roles, contact info, photo, bio, availability, and custom JSONB metadata.', 'feature', 'cast', 1),
  ('Pay rates in any currency', 'Hourly, daily, weekly, monthly, flat, or per-episode rates. Any ISO currency code. DECIMAL(12,2) precision — no rounding errors.', 'feature', 'cast', 2),
  ('Contract status pipeline', 'negotiating → pending → signed → on_set → completed → released. Track every actor through the deal lifecycle.', 'feature', 'cast', 3),
  ('Cast payment ledger', 'Per-payment records with period dates, due dates, paid timestamp, and status: unpaid / paid / overdue / cancelled.', 'feature', 'cast', 4),
  ('Overdue payment detection', 'Any payment past its due date with unpaid status is flagged. Keeps productions out of trouble.', 'feature', 'cast', 5),
  ('Cast document vault', 'NDA, contract, work agreement, ID proof, insurance certificate, work permit, citizenship docs. Expiry date tracking with notifications.', 'feature', 'cast', 6),
  ('Cast budget integration', 'Payment totals roll up to the props_costumes / below-the-line budget categories automatically.', 'improvement', 'budget', 7)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.4.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.4.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('XP system', '+50 for publishing, +5 per upvote, +100 for challenge submit, +500/300/150 for placing 1st/2nd/3rd, +200 for finishing a script, +25 for finishing an act.', 'feature', 'gamification', 1),
  ('Level progression', 'XP feeds into levels. Level 10 unlocks course creation. Level 25 earns Master Craftsman badge.', 'feature', 'gamification', 2),
  ('Badge system', 'First Script, Community Voice, Challenge Winner, Triple Threat, Distro King, Free Use Hero, Speed Writer, Streak Master, Course Creator, Master Craftsman.', 'feature', 'gamification', 3),
  ('Daily login streaks', 'Consecutive-day tracking with escalating XP reward (10→50 XP/day over 7 days). Breaking a streak hurts. That is the point.', 'feature', 'gamification', 4),
  ('user_gamification table', 'Stores xp, level, streak_current, streak_longest, badges (JSONB), and last_activity per user.', 'feature', 'gamification', 5)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.5.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.5.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Course LMS: courses, sections, lessons', 'Full learning management system. SYSTEM and USER course types. Lessons support video, text, exercise, and quiz formats.', 'feature', 'courses', 1),
  ('Enrollment & progress tracking', 'Enroll, track per-lesson completion, auto-calculate progress %, set completed_at on first 100%. Trigger-driven — no manual syncing.', 'feature', 'courses', 2),
  ('Course ratings', 'rate_course() handles race-condition-safe average calculation. Stored as rating_sum + rating_count for accurate running average.', 'feature', 'courses', 3),
  ('Level 10+ course creation gate', 'Community users can publish courses once they hit level 10. Keeps quality high by requiring investment in the platform first.', 'feature', 'courses', 4),
  ('Seed courses: 3 system courses', 'Screenplay Formatting Fundamentals (45min, beginner), Writing Compelling Themes (60min, intermediate), Three-Act Structure Deep Dive (50min, beginner).', 'feature', 'courses', 5),
  ('XP rewards per course', 'Completing a course awards XP as configured per course. System courses: 175–200 XP.', 'improvement', 'gamification', 6)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.6.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.6.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Arc & Episode Planner', 'Visual season grid: episodes as columns, arcs as rows. See where every story thread peaks, resolves, or goes thin. For TV, limited series, and anthology.', 'feature', 'arc_planner', 1),
  ('Arc types & statuses', 'Arc types: character, plot, thematic, world-building. Statuses: seeded, building, climax, resolved.', 'feature', 'arc_planner', 2),
  ('Episode records', 'Episode number, title, season, script link, logline, cold open notes, airdate, production status.', 'feature', 'arc_planner', 3),
  ('Showrunner lock controls', 'Admins can lock arcs and episodes to prevent accidental continuity breaks by writers.', 'feature', 'arc_planner', 4),
  ('Character roles per episode', 'Tag characters as series regular, recurring, guest star, co-star, day player, or under-five per episode. Track billing order across a season.', 'feature', 'characters', 5)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.7.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.7.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Stage play format mode', 'Dedicated mode with ACT headers, theatrical SCENE headings, STAGE DIRECTION, character cues, and SONG CUE markers. Exports as a proper stage manuscript.', 'feature', 'formats', 1),
  ('Audio drama / podcast format', 'NARRATOR, SOUND EFFECT, MUSIC CUE, AMBIENCE elements. Format metadata: stereo/binaural, runtime, target platform.', 'feature', 'formats', 2),
  ('Custom script element types', 'Define your own element labels, font styles, indent levels, print visibility, and color swatches per project.', 'feature', 'editor', 3),
  ('Format-correct exports', 'All export formats respect the project''s script type — stage plays export as manuscripts, audio dramas as scripts-for-ears.', 'improvement', 'scripts', 4)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.8.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.8.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Broadcast script mode', 'Two-column A/V editor. VIDEO (left) + AUDIO (right). SUPER elements, VO vs SOT, SCENE/SEGMENT headers, total time calculator.', 'feature', 'formats', 1),
  ('Broadcast contacts database', 'Store reporters, anchors, producers, and stations with contact info, station affiliation, relationship notes. Link to broadcast projects.', 'feature', 'production', 2),
  ('Broadcast patch distribution', 'Distribute incremental corrections to the team without re-sending the full script.', 'feature', 'production', 3)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.9.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.9.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Heartbeat-based work session tracking', 'Every 30 seconds a heartbeat credits 30 seconds to your session. Gap detection (>20min), idle detection (>10min), 5min thinking-grace.', 'feature', 'work_tracking', 1),
  ('Per-tab session keys', 'Each browser tab generates a unique session_key in sessionStorage. Simultaneous tabs tracked separately. Eliminates replay attacks.', 'feature', 'work_tracking', 2),
  ('Work context tracking', 'Sessions record which part of the app you are in: script, documents, arc-planner, etc.', 'feature', 'work_tracking', 3),
  ('Team-visible hours for project owners', 'Project owners can see hours for every team member. Broken down by day, context, and in aggregate.', 'feature', 'work_tracking', 4),
  ('Analytics views', 'work_hours_by_day, work_hours_by_user, work_hours_by_context, admin_work_stats views for dashboard and admin panel.', 'feature', 'work_tracking', 5),
  ('Stale session cleanup function', 'cleanup_stale_work_sessions() removes sessions >24h old with <60s credited. Safe to call via pg_cron.', 'feature', 'work_tracking', 6)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.0.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.0.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Git-inspired script branching', 'Create named branches (Director Cut, Studio Draft, etc.), edit independently, merge back with conflict resolution, diff any two branches at element level.', 'feature', 'versioning', 1),
  ('Festival Bridge', 'Track festival submissions: deadline, fee, status (researching → won), materials checklist, contact, result date. Full festival strategy dashboard.', 'feature', 'festival', 2),
  ('Community-maintained festival directory', 'Historical acceptance rates, average scores, and submission tips from other members who entered.', 'feature', 'festival', 3),
  ('Project templates', 'Save any project as a template. Clones script structure, character archetypes, budget categories, and more. System templates for Feature, Pilot, Short, Doc, Stage Play.', 'feature', 'production', 4),
  ('Development pipeline tracker', 'Milestones from Premise through Distribution. Status, target date, completion date, notes per milestone. Single-glance development slate view.', 'feature', 'production', 5),
  ('Script coverage tool', 'Formal coverage with logline, genre, premise, structure notes, character assessments, dialogue rating, budget estimate, and recommendation (pass/consider/recommend).', 'feature', 'scripts', 6),
  ('Table read planner', 'Schedule and track table reads. Attendance, notes, pages read, version of script used.', 'feature', 'production', 7),
  ('Mood board with section tagging', 'Visual board for reference images. Images can be tagged to board sections: general, characters, locations, atmosphere, costumes, props.', 'improvement', 'production', 8)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.1.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.1.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Subcommunities', 'Genre and topic-specific spaces inside the Community Hub. Own feed, chat, moderators, charter, and challenge filter.', 'feature', 'community', 1),
  ('Subcommunity moderator controls', 'Moderators can pin posts, remove charter-violating content, set description and icon.', 'feature', 'community', 2),
  ('Public / private subcommunity modes', 'Public subcommunities are join-on-click. Private ones require a join request and mod approval.', 'feature', 'community', 3),
  ('Community chat rooms', 'General community chat, per-challenge chat, and per-subcommunity channels. Real-time, persisted history, scrollable.', 'feature', 'community', 4),
  ('Community file uploads', 'Share reference images, script excerpts, research docs, and portfolio links in community posts and channels.', 'feature', 'community', 5)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.2.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.2.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Client customisation / white-labeling', 'Custom logo, colors, company name, domain, email sender, welcome screen, and feature visibility per workspace.', 'feature', 'ui', 1),
  ('Sidebar layout presets', 'Save named sidebar arrangements: Writing Mode (full-screen), Review Mode (annotations + comments), Production Mode (scene list + schedule). Per-user, persisted.', 'feature', 'ui', 2),
  ('Contributor/credits roster', 'Credit everyone on the project including non-platform users. Generates formatted credits export. Feeds festival submission data export.', 'feature', 'production', 3),
  ('Project channels (Slack-style)', 'Per-project Slack-like discussion channels. Text, files, reactions, threads, @mentions, pinned messages. Real-time delivery.', 'feature', 'collaboration', 4)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.3.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.3.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Feature flags system', 'GLOBAL / USER / PROJECT / BETA flag types. Admin controls rollout percentage. Emergency kill switch without a deployment.', 'feature', 'admin', 1),
  ('Labs tab in account settings', 'Users can opt into beta features from their account settings. Features tagged BETA appear here.', 'feature', 'ui', 2),
  ('Security & Legal module', 'Platform-level ToS/Privacy Policy documents with version tracking. Users prompted to re-accept on new versions.', 'feature', 'auth', 3),
  ('Admin panel — site settings', 'Maintenance mode, registration toggle, storage quotas, rate limits, community moderation thresholds, challenge auto-generation toggle, XP multipliers, announcement banner.', 'feature', 'admin', 4)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.4.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.4.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Personal project folders with nested support', 'Create folders, nest subfolders, assign colors. Per-user — your organizational scheme is invisible to other team members.', 'feature', 'ui', 1),
  ('Dashboard folders for teams', 'Shared taxonomy visible to the whole organization. Group by client, season, genre, or status.', 'feature', 'ui', 2),
  ('Drag-and-drop folder tree', 'Move projects and folders around without touching a settings page. Reordering is instant.', 'improvement', 'ui', 3)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.5.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.5.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Props & costumes per scene in the breakdown panel', 'Each scene record now has dedicated props[] and costumes[] fields. Populating these from the scene breakdown panel feeds the continuity sheet automatically.', 'feature', 'scenes', 1),
  ('Gear module — full equipment inventory', 'Camera, lens, lighting, sound, grip, post/DIT, VFX items. Own/rent/borrow. Vendor contact. Daily/weekly rate. Insurance value. Serial number. Attach to specific shoot days.', 'feature', 'gear', 2),
  ('Gear rolls up to budget', 'Gear rental costs automatically feed the props_costumes / equipment budget categories when records are linked.', 'improvement', 'budget', 3),
  ('Annotations on script elements', 'Sticky-note annotations directly on individual script elements: note, question, suggestion, flag, approved types. Resolved tracking. Sidebar grouped by scene.', 'feature', 'editor', 4),
  ('Script element type note — non-printing', 'NOTE type elements are saved in the database and visible in the editor but stripped from all PDF exports.', 'improvement', 'scripts', 5)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.6.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.6.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Changelog & release system', 'changelog_releases and changelog_entries tables. Change types: feature, improvement, fix, performance, security, breaking, deprecation, internal. Areas cover every module.', 'feature', 'admin', 1),
  ('publish_release() function', 'One call to mark a release published AND bump site_settings.site_version in a single atomic operation. Admin-only, SECURITY DEFINER.', 'feature', 'admin', 2),
  ('Denormalized entry counts with trigger sync', 'feature_count, improvement_count, fix_count on each release are auto-maintained by a trigger. No manual counting.', 'feature', 'database', 3),
  ('public_changelog view', 'Clean public-facing view of all published releases with total change counts. Granted to authenticated and anon roles.', 'feature', 'api', 4),
  ('Site version bumped to 2.6.0', 'site_settings.site_version updated from 0.1.0 to 2.6.0. The footer version number is now live and kept automatically in sync with every future publish_release() call.', 'improvement', 'admin', 5),
  ('Full version history seeded', 'All 16 prior releases (v1.0.0 through v2.5.0) seeded with 80+ individual change entries covering every feature on the platform.', 'feature', 'admin', 6)
) AS v(title, description, entry_type, area, sort_order);


-- ──────────────────────────────────────────────────────────────
-- 10. BUMP SITE VERSION to 2.6.0
-- ──────────────────────────────────────────────────────────────

INSERT INTO site_settings (key, value, updated_at)
VALUES ('site_version', '2.6.0', now())
ON CONFLICT (key) DO UPDATE
  SET value      = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at;


-- ──────────────────────────────────────────────────────────────
-- USAGE NOTES
-- ──────────────────────────────────────────────────────────────
--
-- To add a new release:
--
--   1. Insert the release row (status = 'draft'):
--      INSERT INTO changelog_releases (version, title, summary, release_type)
--      VALUES ('2.7.0', 'The Next Thing', 'Summary here.', 'minor');
--
--   2. Insert entries against it:
--      INSERT INTO changelog_entries (release_id, title, description, entry_type, area)
--      SELECT id, 'New feature name', 'What it does.', 'feature', 'editor'
--      FROM changelog_releases WHERE version = '2.7.0';
--
--   3. When ready to ship, call:
--      SELECT publish_release('2.7.0');
--      → marks published, sets released_at = now(), bumps site_version to 2.7.0
--
-- ============================================================
