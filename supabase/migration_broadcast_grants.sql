-- ============================================================
-- Broadcast Tables — Missing GRANT fix
-- 
-- The original migration_broadcast.sql created all tables with 
-- RLS policies but never granted table-level access to the 
-- `authenticated` role. PostgREST requires GRANTs to expose 
-- tables in its schema cache.
--
-- Safe to re-run: GRANT is idempotent in PostgreSQL.
-- ============================================================

-- Core editorial tables
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_stories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_story_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_rundowns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_rundown_items TO authenticated;

-- Wire feeds
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_wire_feeds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_wire_stories TO authenticated;

-- Sources & devices
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_mos_devices TO authenticated;

-- Graphics
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_graphics_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_graphics_cues TO authenticated;

-- Logging & timing
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_as_run_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_timing_marks TO authenticated;

-- Stream ingest & output (the ones causing the error)
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_stream_ingests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_stream_outputs TO authenticated;

-- Vision mixer / switcher
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_switcher_state TO authenticated;

-- Comms / intercom
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_comms_channels TO authenticated;

-- Playout / master control
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_playout_items TO authenticated;

-- Contacts
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_contacts TO authenticated;

-- Grant execute on the helper function
GRANT EXECUTE ON FUNCTION is_broadcast_member(UUID) TO authenticated;

-- Enable Supabase Realtime on key broadcast tables (safe if already added)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_switcher_state; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stream_ingests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stream_outputs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_playout_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_rundown_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_as_run_log; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
