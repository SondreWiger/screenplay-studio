-- ════════════════════════════════════════════════════════════
-- Broadcast System v2 — Clean single migration
-- Safe to re-run (idempotent: DROP IF EXISTS + CREATE)
-- ════════════════════════════════════════════════════════════

-- ─── Helper: is_broadcast_member ───────────────────────────
-- Returns true if user owns the project or is a project member.
CREATE OR REPLACE FUNCTION is_broadcast_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM project_members WHERE project_id = p_project_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ════════════════════════════════════════════════════════════
-- 1. broadcast_stories
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_stories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL DEFAULT 'Untitled',
  body         JSONB,
  script_text  TEXT,
  status       TEXT NOT NULL DEFAULT 'draft',
  story_type   TEXT NOT NULL DEFAULT 'reader',
  priority     INT  NOT NULL DEFAULT 0,
  assigned_to  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source       TEXT,
  wire_story_id UUID,
  estimated_duration INT,
  embargo_until TIMESTAMPTZ,
  version      INT  NOT NULL DEFAULT 1,
  locked_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at    TIMESTAMPTZ,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_stories_project ON broadcast_stories(project_id);

ALTER TABLE broadcast_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_stories_select" ON broadcast_stories;
CREATE POLICY "broadcast_stories_select" ON broadcast_stories FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stories_insert" ON broadcast_stories;
CREATE POLICY "broadcast_stories_insert" ON broadcast_stories FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stories_update" ON broadcast_stories;
CREATE POLICY "broadcast_stories_update" ON broadcast_stories FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stories_delete" ON broadcast_stories;
CREATE POLICY "broadcast_stories_delete" ON broadcast_stories FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 2. broadcast_rundowns
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_rundowns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'Untitled Rundown',
  show_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  scheduled_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_end   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  actual_start    TIMESTAMPTZ,
  actual_end      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'planning',
  template_id     UUID,
  is_template     BOOLEAN NOT NULL DEFAULT FALSE,
  locked          BOOLEAN NOT NULL DEFAULT FALSE,
  locked_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_rundowns_project ON broadcast_rundowns(project_id);

ALTER TABLE broadcast_rundowns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_rundowns_select" ON broadcast_rundowns;
CREATE POLICY "broadcast_rundowns_select" ON broadcast_rundowns FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_rundowns_insert" ON broadcast_rundowns;
CREATE POLICY "broadcast_rundowns_insert" ON broadcast_rundowns FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_rundowns_update" ON broadcast_rundowns;
CREATE POLICY "broadcast_rundowns_update" ON broadcast_rundowns FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_rundowns_delete" ON broadcast_rundowns;
CREATE POLICY "broadcast_rundowns_delete" ON broadcast_rundowns FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 3. broadcast_rundown_items
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_rundown_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rundown_id       UUID NOT NULL REFERENCES broadcast_rundowns(id) ON DELETE CASCADE,
  story_id         UUID REFERENCES broadcast_stories(id) ON DELETE SET NULL,
  sort_order       INT NOT NULL DEFAULT 0,
  page_number      TEXT,
  segment_slug     TEXT,
  title            TEXT NOT NULL DEFAULT '',
  item_type        TEXT NOT NULL DEFAULT 'anchor_read',
  planned_duration INT NOT NULL DEFAULT 30,
  actual_duration  INT,
  back_time        TEXT,
  back_time_target TEXT,
  is_float         BOOLEAN NOT NULL DEFAULT FALSE,
  is_break         BOOLEAN NOT NULL DEFAULT FALSE,
  status           TEXT NOT NULL DEFAULT 'pending',
  camera           TEXT,
  audio_source     TEXT,
  audio_notes      TEXT,
  video_source     TEXT,
  graphics_id      UUID,
  graphics_notes   TEXT,
  prompter_text    TEXT,
  presenter        TEXT,
  reporter         TEXT,
  director_notes   TEXT,
  technical_notes  TEXT,
  production_notes TEXT,
  media_id         TEXT,
  media_in_point   TEXT,
  media_out_point  TEXT,
  media_duration   INT,
  color            TEXT,
  on_air_at        TIMESTAMPTZ,
  off_air_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_rundown_items_rundown ON broadcast_rundown_items(rundown_id);

ALTER TABLE broadcast_rundown_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_rundown_items_select" ON broadcast_rundown_items;
CREATE POLICY "broadcast_rundown_items_select" ON broadcast_rundown_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));
DROP POLICY IF EXISTS "broadcast_rundown_items_insert" ON broadcast_rundown_items;
CREATE POLICY "broadcast_rundown_items_insert" ON broadcast_rundown_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));
DROP POLICY IF EXISTS "broadcast_rundown_items_update" ON broadcast_rundown_items;
CREATE POLICY "broadcast_rundown_items_update" ON broadcast_rundown_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));
DROP POLICY IF EXISTS "broadcast_rundown_items_delete" ON broadcast_rundown_items;
CREATE POLICY "broadcast_rundown_items_delete" ON broadcast_rundown_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));

-- ════════════════════════════════════════════════════════════
-- 4. broadcast_sources
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  short_name      TEXT,
  source_type     TEXT NOT NULL DEFAULT 'camera',
  protocol        TEXT,
  connection_url  TEXT,
  ndi_source_name TEXT,
  srt_passphrase  TEXT,
  nmos_node_id    TEXT,
  nmos_sender_id  TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  tally_state     TEXT NOT NULL DEFAULT 'off',
  thumbnail_url   TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_sources_project ON broadcast_sources(project_id);

ALTER TABLE broadcast_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_sources_select" ON broadcast_sources;
CREATE POLICY "broadcast_sources_select" ON broadcast_sources FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_sources_insert" ON broadcast_sources;
CREATE POLICY "broadcast_sources_insert" ON broadcast_sources FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_sources_update" ON broadcast_sources;
CREATE POLICY "broadcast_sources_update" ON broadcast_sources FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_sources_delete" ON broadcast_sources;
CREATE POLICY "broadcast_sources_delete" ON broadcast_sources FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 5. broadcast_stream_ingests
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_stream_ingests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  label            TEXT,
  protocol         TEXT NOT NULL DEFAULT 'rtmp',
  ingest_url       TEXT NOT NULL DEFAULT 'rtmp://localhost:1935/live',
  stream_key       TEXT NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  pull_url         TEXT,
  status           TEXT NOT NULL DEFAULT 'idle',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  video_codec      TEXT,
  audio_codec      TEXT,
  width            INT,
  height           INT,
  fps              REAL,
  bitrate_kbps     INT,
  audio_sample_rate INT,
  audio_channels   INT,
  last_keyframe_at TIMESTAMPTZ,
  dropped_frames   INT NOT NULL DEFAULT 0,
  uptime_seconds   INT NOT NULL DEFAULT 0,
  auto_source      BOOLEAN NOT NULL DEFAULT TRUE,
  linked_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  connected_at     TIMESTAMPTZ,
  disconnected_at  TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_stream_ingests_project ON broadcast_stream_ingests(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_stream_ingests_key ON broadcast_stream_ingests(stream_key);

ALTER TABLE broadcast_stream_ingests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_stream_ingests_select" ON broadcast_stream_ingests;
CREATE POLICY "broadcast_stream_ingests_select" ON broadcast_stream_ingests FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stream_ingests_insert" ON broadcast_stream_ingests;
CREATE POLICY "broadcast_stream_ingests_insert" ON broadcast_stream_ingests FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stream_ingests_update" ON broadcast_stream_ingests;
CREATE POLICY "broadcast_stream_ingests_update" ON broadcast_stream_ingests FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stream_ingests_delete" ON broadcast_stream_ingests;
CREATE POLICY "broadcast_stream_ingests_delete" ON broadcast_stream_ingests FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 6. broadcast_stream_outputs
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_stream_outputs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  platform           TEXT NOT NULL DEFAULT 'custom',
  rtmp_url           TEXT,
  stream_key         TEXT,
  srt_url            TEXT,
  video_bitrate_kbps INT NOT NULL DEFAULT 4500,
  audio_bitrate_kbps INT NOT NULL DEFAULT 128,
  resolution         TEXT NOT NULL DEFAULT '1920x1080',
  fps                INT NOT NULL DEFAULT 30,
  status             TEXT NOT NULL DEFAULT 'idle',
  error_message      TEXT,
  started_at         TIMESTAMPTZ,
  uptime_seconds     INT NOT NULL DEFAULT 0,
  bytes_sent         BIGINT NOT NULL DEFAULT 0,
  is_primary         BOOLEAN NOT NULL DEFAULT FALSE,
  auto_start         BOOLEAN NOT NULL DEFAULT FALSE,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_stream_outputs_project ON broadcast_stream_outputs(project_id);

ALTER TABLE broadcast_stream_outputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_stream_outputs_select" ON broadcast_stream_outputs;
CREATE POLICY "broadcast_stream_outputs_select" ON broadcast_stream_outputs FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stream_outputs_insert" ON broadcast_stream_outputs;
CREATE POLICY "broadcast_stream_outputs_insert" ON broadcast_stream_outputs FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stream_outputs_update" ON broadcast_stream_outputs;
CREATE POLICY "broadcast_stream_outputs_update" ON broadcast_stream_outputs FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stream_outputs_delete" ON broadcast_stream_outputs;
CREATE POLICY "broadcast_stream_outputs_delete" ON broadcast_stream_outputs FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 7. broadcast_switcher_state
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_switcher_state (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  program_source_id      UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  preview_source_id      UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  transition_type        TEXT NOT NULL DEFAULT 'cut',
  transition_duration_ms INT NOT NULL DEFAULT 500,
  auto_transition        BOOLEAN NOT NULL DEFAULT FALSE,
  dsk_1_source_id        UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  dsk_1_on_air           BOOLEAN NOT NULL DEFAULT FALSE,
  dsk_2_source_id        UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  dsk_2_on_air           BOOLEAN NOT NULL DEFAULT FALSE,
  usk_1_type             TEXT,
  usk_1_source_id        UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  usk_1_on_air           BOOLEAN NOT NULL DEFAULT FALSE,
  audio_follow_video     BOOLEAN NOT NULL DEFAULT TRUE,
  ftb_active             BOOLEAN NOT NULL DEFAULT FALSE,
  pip_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  pip_source_id          UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  pip_position           TEXT DEFAULT 'bottom_right',
  pip_size               REAL NOT NULL DEFAULT 25.0,
  last_take_at           TIMESTAMPTZ,
  operator_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_switcher_state_project ON broadcast_switcher_state(project_id);

ALTER TABLE broadcast_switcher_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_switcher_state_select" ON broadcast_switcher_state;
CREATE POLICY "broadcast_switcher_state_select" ON broadcast_switcher_state FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_switcher_state_insert" ON broadcast_switcher_state;
CREATE POLICY "broadcast_switcher_state_insert" ON broadcast_switcher_state FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_switcher_state_update" ON broadcast_switcher_state;
CREATE POLICY "broadcast_switcher_state_update" ON broadcast_switcher_state FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_switcher_state_delete" ON broadcast_switcher_state;
CREATE POLICY "broadcast_switcher_state_delete" ON broadcast_switcher_state FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 8. broadcast_as_run_log
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_as_run_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rundown_id        UUID REFERENCES broadcast_rundowns(id) ON DELETE SET NULL,
  rundown_item_id   UUID REFERENCES broadcast_rundown_items(id) ON DELETE SET NULL,
  event_type        TEXT NOT NULL DEFAULT 'manual_note',
  title             TEXT NOT NULL DEFAULT '',
  planned_time      TIMESTAMPTZ,
  actual_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  planned_duration  INT,
  actual_duration   INT,
  deviation_seconds INT NOT NULL DEFAULT 0,
  source            TEXT,
  operator          TEXT,
  notes             TEXT,
  is_automatic      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_as_run_log_project ON broadcast_as_run_log(project_id);

ALTER TABLE broadcast_as_run_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_as_run_log_select" ON broadcast_as_run_log;
CREATE POLICY "broadcast_as_run_log_select" ON broadcast_as_run_log FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_as_run_log_insert" ON broadcast_as_run_log;
CREATE POLICY "broadcast_as_run_log_insert" ON broadcast_as_run_log FOR INSERT WITH CHECK (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 9. broadcast_playout_items
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_playout_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sort_order             INT NOT NULL DEFAULT 0,
  title                  TEXT NOT NULL DEFAULT '',
  item_type              TEXT NOT NULL DEFAULT 'clip',
  media_url              TEXT,
  media_type             TEXT,
  thumbnail_url          TEXT,
  duration_seconds       INT NOT NULL DEFAULT 0,
  in_point_ms            INT NOT NULL DEFAULT 0,
  out_point_ms           INT,
  transition_type        TEXT,
  transition_duration_ms INT NOT NULL DEFAULT 0,
  auto_next              BOOLEAN NOT NULL DEFAULT TRUE,
  status                 TEXT NOT NULL DEFAULT 'queued',
  source_id              UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  loop                   BOOLEAN NOT NULL DEFAULT FALSE,
  played_at              TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_playout_items_project ON broadcast_playout_items(project_id);

ALTER TABLE broadcast_playout_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_playout_items_select" ON broadcast_playout_items;
CREATE POLICY "broadcast_playout_items_select" ON broadcast_playout_items FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_playout_items_insert" ON broadcast_playout_items;
CREATE POLICY "broadcast_playout_items_insert" ON broadcast_playout_items FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_playout_items_update" ON broadcast_playout_items;
CREATE POLICY "broadcast_playout_items_update" ON broadcast_playout_items FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_playout_items_delete" ON broadcast_playout_items;
CREATE POLICY "broadcast_playout_items_delete" ON broadcast_playout_items FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 10. broadcast_timing_marks (used by timing API)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_timing_marks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rundown_id           UUID NOT NULL REFERENCES broadcast_rundowns(id) ON DELETE CASCADE,
  rundown_item_id      UUID REFERENCES broadcast_rundown_items(id) ON DELETE SET NULL,
  mark_type            TEXT NOT NULL DEFAULT 'marker',
  wall_time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  show_elapsed_seconds INT,
  operator_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_timing_marks_rundown ON broadcast_timing_marks(rundown_id);

ALTER TABLE broadcast_timing_marks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_timing_marks_select" ON broadcast_timing_marks;
CREATE POLICY "broadcast_timing_marks_select" ON broadcast_timing_marks FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_timing_marks_insert" ON broadcast_timing_marks;
CREATE POLICY "broadcast_timing_marks_insert" ON broadcast_timing_marks FOR INSERT WITH CHECK (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- updated_at triggers
-- ════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS update_broadcast_stories_updated_at ON broadcast_stories;
CREATE TRIGGER update_broadcast_stories_updated_at
  BEFORE UPDATE ON broadcast_stories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_rundowns_updated_at ON broadcast_rundowns;
CREATE TRIGGER update_broadcast_rundowns_updated_at
  BEFORE UPDATE ON broadcast_rundowns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_rundown_items_updated_at ON broadcast_rundown_items;
CREATE TRIGGER update_broadcast_rundown_items_updated_at
  BEFORE UPDATE ON broadcast_rundown_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_sources_updated_at ON broadcast_sources;
CREATE TRIGGER update_broadcast_sources_updated_at
  BEFORE UPDATE ON broadcast_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_stream_ingests_updated_at ON broadcast_stream_ingests;
CREATE TRIGGER update_broadcast_stream_ingests_updated_at
  BEFORE UPDATE ON broadcast_stream_ingests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_stream_outputs_updated_at ON broadcast_stream_outputs;
CREATE TRIGGER update_broadcast_stream_outputs_updated_at
  BEFORE UPDATE ON broadcast_stream_outputs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_playout_items_updated_at ON broadcast_playout_items;
CREATE TRIGGER update_broadcast_playout_items_updated_at
  BEFORE UPDATE ON broadcast_playout_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ════════════════════════════════════════════════════════════
-- GRANTs — required for PostgREST to expose tables
-- ════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_stories          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_rundowns         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_rundown_items    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_sources          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_stream_ingests   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_stream_outputs   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_switcher_state   TO authenticated;
GRANT SELECT, INSERT                ON broadcast_as_run_log        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_playout_items    TO authenticated;
GRANT SELECT, INSERT                ON broadcast_timing_marks      TO authenticated;

-- Service role needs full access (media server uses service key)
GRANT ALL ON broadcast_stories          TO service_role;
GRANT ALL ON broadcast_rundowns         TO service_role;
GRANT ALL ON broadcast_rundown_items    TO service_role;
GRANT ALL ON broadcast_sources          TO service_role;
GRANT ALL ON broadcast_stream_ingests   TO service_role;
GRANT ALL ON broadcast_stream_outputs   TO service_role;
GRANT ALL ON broadcast_switcher_state   TO service_role;
GRANT ALL ON broadcast_as_run_log       TO service_role;
GRANT ALL ON broadcast_playout_items    TO service_role;
GRANT ALL ON broadcast_timing_marks     TO service_role;

-- ════════════════════════════════════════════════════════════
-- Realtime — add tables to supabase_realtime publication
-- ════════════════════════════════════════════════════════════
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stream_ingests;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stream_outputs;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_sources;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_switcher_state;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_playout_items;    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_rundown_items;    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_as_run_log;       EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Force PostgREST to pick up new tables
NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════
-- Done. 10 tables, all with RLS, GRANTs, Realtime, triggers.
-- ════════════════════════════════════════════════════════════
