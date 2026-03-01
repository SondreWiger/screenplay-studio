-- ============================================================
-- Screenplay Studio — Migration: All Recent Feature Changes
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Safe to run multiple times (idempotent where possible)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. EPISODIC PROJECT SUPPORT
--    Columns: season_number, episode_count on projects table
--    These likely already exist if using the full schema.
--    This block is safe — uses IF NOT EXISTS.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS season_number  INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS episode_count  INTEGER DEFAULT NULL;

COMMENT ON COLUMN projects.season_number IS
  'For episodic series: which season this project represents (default 1)';
COMMENT ON COLUMN projects.episode_count IS
  'For episodic series: planned total episode count (null = open-ended)';


-- ──────────────────────────────────────────────────────────────
-- 2. ARC PLANNER — stored in projects.content_metadata (JSONB)
--    No column change needed: content_metadata is already JSONB.
--    The arc map is stored as:
--      content_metadata->>'arc_map'  (JSON-encoded MindmapData)
--    Index for faster filtering when listing episodic projects:
-- ──────────────────────────────────────────────────────────────

-- Index so we can efficiently query episodic projects in the arc planner
CREATE INDEX IF NOT EXISTS idx_projects_script_type
  ON projects (script_type);

-- GIN index for content_metadata JSONB for fast arc_map existence checks
CREATE INDEX IF NOT EXISTS idx_projects_content_metadata_gin
  ON projects USING gin (content_metadata);

COMMENT ON COLUMN projects.content_metadata IS
  'Flexible JSONB store. Keys include: arc_map (ArcMindmap JSON), platform-specific metadata, etc.';


-- ──────────────────────────────────────────────────────────────
-- 3. SUPPORT TICKETS — "Report a Bug" feature
--    The 'bug' TicketCategory value already exists in the app
--    type system. Ensure the column can hold it if using an enum.
--    If category is TEXT (not an enum), nothing needed.
--    Check with: \d support_tickets
-- ──────────────────────────────────────────────────────────────

-- If you have an enum type for ticket_category, add 'bug' if not present:
-- (Uncomment if needed — safe to run only once)
--
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_category') THEN
--     ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'bug';
--   END IF;
-- END $$;

-- Ensure the support_tickets table has all required columns
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';


-- ──────────────────────────────────────────────────────────────
-- 4. OFFLINE SYNC QUEUE (IndexedDB — client-side only)
--    No server-side schema needed. The offline layer stores data
--    in the browser's IndexedDB (ss-offline db, idb package).
--    When back online, the sync queue pushes changes to Supabase
--    using the existing table RLS policies.
-- ──────────────────────────────────────────────────────────────

-- No SQL needed for offline/PWA support.


-- ──────────────────────────────────────────────────────────────
-- 5. ADMIN STATS — new queries used by the enhanced admin panel
--    Create helper views to make the admin queries fast.
-- ──────────────────────────────────────────────────────────────

-- View: daily signup counts (last 90 days)
CREATE OR REPLACE VIEW admin_signups_by_day AS
SELECT
  date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS signup_date,
  COUNT(*) AS signup_count
FROM profiles
WHERE created_at >= now() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1;

-- View: daily project creation counts (last 90 days)
CREATE OR REPLACE VIEW admin_projects_by_day AS
SELECT
  date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS created_date,
  COUNT(*) AS project_count
FROM projects
WHERE created_at >= now() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1;

-- View: script type distribution (script_type is on projects, not scripts)
CREATE OR REPLACE VIEW admin_script_type_breakdown AS
SELECT
  COALESCE(script_type::text, 'unknown') AS script_type,
  COUNT(*) AS total
FROM projects
GROUP BY 1
ORDER BY 2 DESC;

-- View: project type distribution
CREATE OR REPLACE VIEW admin_project_type_breakdown AS
SELECT
  COALESCE(project_type::text, 'unknown') AS project_type,
  COUNT(*) AS total
FROM projects
GROUP BY 1
ORDER BY 2 DESC;

-- View: ticket summary by category and status
CREATE OR REPLACE VIEW admin_ticket_summary AS
SELECT
  category,
  status,
  COUNT(*) AS total
FROM support_tickets
GROUP BY 1, 2
ORDER BY 3 DESC;

-- View: platform-wide engagement summary (single-row summary)
CREATE OR REPLACE VIEW admin_platform_summary AS
SELECT
  (SELECT COUNT(*) FROM profiles)                       AS total_users,
  (SELECT COUNT(*) FROM profiles WHERE is_pro = true)   AS pro_users,
  (SELECT COUNT(*) FROM projects)                       AS total_projects,
  (SELECT COUNT(*) FROM scripts)                        AS total_scripts,
  (SELECT COUNT(*) FROM script_elements)                AS total_elements,
  (SELECT COUNT(*) FROM characters)                     AS total_characters,
  (SELECT COUNT(*) FROM locations)                      AS total_locations,
  (SELECT COUNT(*) FROM scenes)                         AS total_scenes,
  (SELECT COUNT(*) FROM shots)                          AS total_shots,
  (SELECT COUNT(*) FROM ideas)                          AS total_ideas,
  (SELECT COUNT(*) FROM budget_items)                   AS total_budget_items,
  (SELECT COUNT(*) FROM production_schedule)            AS total_schedule_events,
  (SELECT COUNT(*) FROM comments)                       AS total_comments,
  (SELECT COUNT(*) FROM support_tickets)                AS total_tickets,
  (SELECT COUNT(*) FROM support_tickets
   WHERE status IN ('open','in_progress'))              AS open_tickets,
  (SELECT COUNT(*) FROM support_tickets
   WHERE category = 'bug')                              AS bug_reports,
  (SELECT COUNT(*) FROM projects
   WHERE script_type = 'episodic')                      AS episodic_projects,
  (SELECT COUNT(*) FROM push_subscriptions)             AS push_subscriptions;

-- Grant read on admin views to authenticated role (adjust if using service_role)
GRANT SELECT ON admin_signups_by_day        TO authenticated;
GRANT SELECT ON admin_projects_by_day       TO authenticated;
GRANT SELECT ON admin_script_type_breakdown TO authenticated;
GRANT SELECT ON admin_project_type_breakdown TO authenticated;
GRANT SELECT ON admin_ticket_summary        TO authenticated;
GRANT SELECT ON admin_platform_summary      TO authenticated;


-- ──────────────────────────────────────────────────────────────
-- 6. RLS POLICIES for admin views
--    Only admin/moderator roles should be able to read these views.
--    The app already checks isStaff() in code, but defence-in-depth
--    at DB level is good practice.
-- ──────────────────────────────────────────────────────────────

-- Enable RLS on the views is not directly possible, but you can
-- wrap them in functions with SECURITY DEFINER.

-- Example: admin-only function for platform summary
CREATE OR REPLACE FUNCTION get_platform_summary()
RETURNS TABLE (
  total_users bigint, pro_users bigint, total_projects bigint,
  total_scripts bigint, total_elements bigint, total_characters bigint,
  total_locations bigint, total_scenes bigint, total_shots bigint,
  total_ideas bigint, total_budget_items bigint, total_schedule_events bigint,
  total_comments bigint, total_tickets bigint, open_tickets bigint,
  bug_reports bigint, episodic_projects bigint, push_subscriptions bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow admin/moderator roles
  IF (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY SELECT * FROM admin_platform_summary;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 7. PERFORMANCE INDEXES
--    Useful for all the new admin queries and feature queries.
-- ──────────────────────────────────────────────────────────────

-- Scripts: frequently filtered by project and type
CREATE INDEX IF NOT EXISTS idx_scripts_project_id
  ON scripts (project_id);

-- idx_scripts_script_type removed: script_type column does not exist on scripts table
-- (script_type lives on the projects table)

-- Profiles: pro user filtering
CREATE INDEX IF NOT EXISTS idx_profiles_is_pro
  ON profiles (is_pro);

CREATE INDEX IF NOT EXISTS idx_profiles_created_at
  ON profiles (created_at DESC);

-- Projects: created_at for trend queries
CREATE INDEX IF NOT EXISTS idx_projects_created_at
  ON projects (created_at DESC);

-- Support tickets: status + category combo for admin queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_category
  ON support_tickets (status, category);


-- ──────────────────────────────────────────────────────────────
-- 8. BETA BANNER dismissal — client-side (localStorage key
--    'ss_beta_banner_dismissed_v1'). No server storage needed.
-- ──────────────────────────────────────────────────────────────

-- No SQL needed.


-- ──────────────────────────────────────────────────────────────
-- SUMMARY OF ALL CHANGES
-- ──────────────────────────────────────────────────────────────
--
-- CLIENT-SIDE ONLY (no SQL needed):
--   • Offline PWA / IndexedDB sync layer (ss-offline db)
--   • Service Worker cache strategies
--   • Beta banner (localStorage)
--   • Arc Planner mind map UI (saves to projects.content_metadata)
--
-- DATABASE CHANGES:
--   • projects.season_number    — INTEGER, nullable (episodic season)
--   • projects.episode_count    — INTEGER, nullable (planned episodes)
--   • idx_projects_script_type  — index for episodic filtering
--   • idx_projects_content_metadata_gin — GIN index for arc_map access
--   • idx_scripts_project_id    — performance index
--   (idx_scripts_script_type removed — column not on scripts table)
--   • idx_profiles_is_pro       — performance index
--   • idx_profiles_created_at   — performance index
--   • idx_projects_created_at   — performance index
--   • idx_support_tickets_status_category — performance index
--   • admin_* views             — convenience read views for admin panel
--   • get_platform_summary()    — SECURITY DEFINER RPC for safe admin access
--
-- NO NEW TABLES CREATED.
-- All data uses existing Supabase tables.
-- ============================================================
