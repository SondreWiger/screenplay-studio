-- ════════════════════════════════════════════════════════════
-- Broadcast Schema Patch — run this if you already applied
-- migration_broadcast.sql and need the missing columns
-- ════════════════════════════════════════════════════════════

-- 1. broadcast_comms_channels: add description + created_by
ALTER TABLE broadcast_comms_channels ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE broadcast_comms_channels ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. broadcast_stream_ingests: add connection timestamps + audio metadata + is_active
ALTER TABLE broadcast_stream_ingests ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;
ALTER TABLE broadcast_stream_ingests ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;
ALTER TABLE broadcast_stream_ingests ADD COLUMN IF NOT EXISTS audio_sample_rate INTEGER;
ALTER TABLE broadcast_stream_ingests ADD COLUMN IF NOT EXISTS audio_channels INTEGER;
ALTER TABLE broadcast_stream_ingests ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 3. broadcast_stream_outputs: no changes needed (uses status field)

-- Notes:
-- broadcast_stories.prompter_text was NOT added — the prompter page
-- now correctly reads script_text from stories and prompter_text from
-- broadcast_rundown_items (which already has that column).
--
-- broadcast_rundowns.air_date was never a column — the code incorrectly
-- used .order('air_date') but the column is show_date. Code is fixed.
