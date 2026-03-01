-- ============================================================
-- BROADCAST ENVIRONMENT — Production-Grade Database Schema
-- NRCS (Newsroom Computer System) + Playout + Integration
-- ============================================================
-- This schema is designed for real broadcast operations.
-- It implements industry-standard concepts: rundowns with
-- back-timing, story management with versioning & locking,
-- wire feed ingestion, MOS device registry, source routing,
-- and as-run compliance logging.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Helper function: auto-update updated_at
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION broadcast_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper: check project membership for RLS
CREATE OR REPLACE FUNCTION is_broadcast_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════
-- 1. STORIES — Editorial content managed by journalists
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Identity
  slug TEXT NOT NULL,              -- Short identifier: "OSLO-FIRE", "PM-PRESS"
  title TEXT NOT NULL,
  
  -- Content
  body JSONB,                       -- Rich text (TipTap/ProseMirror JSON)
  script_text TEXT,                 -- Plain text extracted for prompter
  
  -- Editorial workflow
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'working', 'ready', 'approved', 'on_air', 'killed', 'archived')),
  story_type TEXT NOT NULL DEFAULT 'reader'
    CHECK (story_type IN ('reader', 'vo', 'sot', 'vosot', 'pkg', 'live', 'interview', 'donut', 'break', 'tease', 'cold_open', 'kicker', 'other')),
  priority INTEGER NOT NULL DEFAULT 0
    CHECK (priority BETWEEN 0 AND 5),  -- 0=routine, 5=flash/bulletin
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Wire reference
  source TEXT,                      -- 'staff', 'wire:ap', 'wire:reuters', 'freelance'
  wire_story_id UUID,               -- Reference to broadcast_wire_stories
  
  -- Timing
  estimated_duration INTEGER,       -- seconds
  embargo_until TIMESTAMPTZ,
  
  -- Locking (optimistic concurrency)
  version INTEGER NOT NULL DEFAULT 1,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Story version history (every save creates a version)
CREATE TABLE IF NOT EXISTS broadcast_story_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES broadcast_stories(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body JSONB,
  script_text TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, version)
);

-- ════════════════════════════════════════════════════════════
-- 2. RUNDOWNS — Timed show sequence
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_rundowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  show_date DATE NOT NULL,
  
  -- Timing
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  
  -- Workflow
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'rehearsal', 'pre_show', 'live', 'completed', 'archived')),
  
  -- Template support (for recurring shows)
  template_id UUID REFERENCES broadcast_rundowns(id) ON DELETE SET NULL,
  is_template BOOLEAN NOT NULL DEFAULT false,
  
  -- Locking
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rundown Items (individual segments/elements)
CREATE TABLE IF NOT EXISTS broadcast_rundown_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rundown_id UUID NOT NULL REFERENCES broadcast_rundowns(id) ON DELETE CASCADE,
  story_id UUID REFERENCES broadcast_stories(id) ON DELETE SET NULL,
  
  -- Ordering
  sort_order INTEGER NOT NULL,
  page_number TEXT,                  -- Show page: "A1", "B3", etc.
  segment_slug TEXT,                 -- Quick identifier
  
  -- Content
  title TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'anchor_read'
    CHECK (item_type IN (
      'anchor_read', 'vo', 'sot', 'vosot', 'pkg', 'live_shot',
      'interview', 'donut', 'cold_open', 'tease', 'kicker',
      'break', 'bumper', 'commercial', 'promo', 'title_sequence',
      'weather', 'sports_desk', 'other'
    )),
  
  -- Timing (seconds)
  planned_duration INTEGER NOT NULL DEFAULT 0,
  actual_duration INTEGER,
  back_time TIMESTAMPTZ,            -- Calculated: when this must start
  back_time_target TIMESTAMPTZ,     -- Hard out target for back-timing
  
  -- Flags
  is_float BOOLEAN NOT NULL DEFAULT false,  -- Optional/floater segment
  is_break BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'standby', 'on_air', 'done', 'killed', 'skipped')),
  
  -- Technical: Camera
  camera TEXT,                       -- "CAM 1", "JIBCAM", "ROBOCAM A"
  
  -- Technical: Audio
  audio_source TEXT,                 -- "MIC 1+2", "SKYPE", "PHONE", "VT SOUND"
  audio_notes TEXT,
  
  -- Technical: Video source
  video_source TEXT,                 -- "VT1", "LIVE_FEED_1", "GFX_FULL"
  
  -- Technical: Graphics
  graphics_id TEXT,                  -- Ref to graphics cue / CasparCG template
  graphics_notes TEXT,
  
  -- Prompter
  prompter_text TEXT,                -- Text for teleprompter
  
  -- Talent
  presenter TEXT,
  reporter TEXT,
  
  -- Department notes
  director_notes TEXT,
  technical_notes TEXT,
  production_notes TEXT,
  
  -- Media reference (MAM/asset ID)
  media_id TEXT,
  media_in_point TEXT,              -- Timecode in: "01:23:45:12"
  media_out_point TEXT,             -- Timecode out
  media_duration INTEGER,           -- Calculated from in/out (seconds)
  
  -- Color coding
  color TEXT,
  
  -- Timestamps
  on_air_at TIMESTAMPTZ,           -- When this item actually went on air
  off_air_at TIMESTAMPTZ,          -- When this item actually ended
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 3. WIRE FEEDS — News wire service ingestion
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_wire_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,               -- "NTB Nyheter", "AP World", "Reuters Sports"
  feed_url TEXT NOT NULL,           -- RSS/Atom URL
  feed_type TEXT NOT NULL DEFAULT 'rss'
    CHECK (feed_type IN ('rss', 'atom', 'json_api')),
  category TEXT,                    -- "world", "domestic", "sports", "business"
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  poll_interval_seconds INTEGER NOT NULL DEFAULT 300,
  
  -- Tracking
  last_polled_at TIMESTAMPTZ,
  last_error TEXT,
  stories_ingested INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broadcast_wire_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES broadcast_wire_feeds(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  external_id TEXT NOT NULL,        -- Original story ID from wire service
  headline TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  source_name TEXT,                 -- "NTB", "AP", "Reuters"
  category TEXT,
  
  priority TEXT DEFAULT 'routine'
    CHECK (priority IN ('flash', 'bulletin', 'urgent', 'routine', 'deferred')),
  
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Has been pulled into an editorial story
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_in_story_id UUID REFERENCES broadcast_stories(id) ON DELETE SET NULL,
  
  -- Prevent duplicate ingestion
  UNIQUE(feed_id, external_id)
);

-- ════════════════════════════════════════════════════════════
-- 4. SOURCES — Video/Audio source routing
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,               -- "CAM 1", "STUDIO A", "SAT FEED Oslo"
  short_name TEXT,                  -- "C1", "SA", "SF1" — for rundown display
  source_type TEXT NOT NULL DEFAULT 'camera'
    CHECK (source_type IN (
      'camera', 'robocam', 'jib', 'crane',
      'vtr', 'video_server', 'clip_player',
      'live_feed', 'satellite', 'remote',
      'graphics', 'cg',
      'audio_only', 'telephone', 'skype',
      'ndi', 'srt', 'web_feed',
      'other'
    )),
  
  -- Connection details
  protocol TEXT
    CHECK (protocol IN ('sdi', 'ndi', 'srt', 'hls', 'rtmp', 'rtsp', 'webrtc', 'nmos', NULL)),
  connection_url TEXT,              -- srt://host:port, ndi://source, https://stream.m3u8
  ndi_source_name TEXT,             -- For NDI: "MACHINE (Source Name)"
  srt_passphrase TEXT,              -- For SRT encryption
  
  -- NMOS (IS-04/IS-05) 
  nmos_node_id TEXT,
  nmos_sender_id TEXT,
  
  -- State
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,  -- Primary source for its type
  tally_state TEXT DEFAULT 'off'
    CHECK (tally_state IN ('off', 'preview', 'program')),
  
  -- Display
  thumbnail_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 5. MOS DEVICE REGISTRY — For MOS protocol integration
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_mos_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,               -- "CasparCG Server 1", "Viz Engine", "TriCaster"
  mos_id TEXT NOT NULL,             -- MOS device ID (per MOS protocol spec)
  ncs_id TEXT,                      -- Our NCS ID as known by this device
  device_type TEXT NOT NULL DEFAULT 'graphics'
    CHECK (device_type IN ('graphics', 'video_server', 'prompter', 'audio', 'playout', 'router', 'other')),
  
  -- Connection
  host TEXT NOT NULL,
  upper_port INTEGER NOT NULL DEFAULT 10540,  -- MOS upper port
  lower_port INTEGER NOT NULL DEFAULT 10541,  -- MOS lower port
  
  -- State
  is_active BOOLEAN NOT NULL DEFAULT true,
  connection_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('connected', 'disconnected', 'error', 'timeout')),
  last_heartbeat TIMESTAMPTZ,
  last_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 6. GRAPHICS / CG — Character Generator cue management 
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_graphics_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'lower_third'
    CHECK (template_type IN (
      'lower_third', 'full_screen', 'ots', 'locator', 'ticker',
      'scorebug', 'name_super', 'title_card', 'logo_bug', 'strap',
      'clock', 'breaking', 'other'
    )),
  
  -- Template definition
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{key, label, type, default_value}]
  
  -- CasparCG / external CG integration
  cg_server TEXT,                   -- Which CG server to target
  cg_channel INTEGER,               -- CasparCG channel number
  cg_layer INTEGER,                 -- CasparCG layer number
  cg_template_path TEXT,            -- Path to template file on CG server
  
  preview_bg_color TEXT DEFAULT '#0a0a1a',
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broadcast_graphics_cues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Links
  rundown_id UUID REFERENCES broadcast_rundowns(id) ON DELETE SET NULL,
  rundown_item_id UUID REFERENCES broadcast_rundown_items(id) ON DELETE SET NULL,
  template_id UUID REFERENCES broadcast_graphics_templates(id) ON DELETE SET NULL,
  
  sort_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  
  cue_type TEXT NOT NULL DEFAULT 'lower_third',
  field_values JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Filled template fields
  
  -- Timing
  duration_seconds INTEGER DEFAULT 5,
  auto_next BOOLEAN NOT NULL DEFAULT false,  -- Auto-advance to next cue
  
  -- State
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'standby', 'on_air', 'done')),
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 7. AS-RUN LOG — Compliance & transmission logging
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_as_run_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Links
  rundown_id UUID REFERENCES broadcast_rundowns(id) ON DELETE SET NULL,
  rundown_item_id UUID REFERENCES broadcast_rundown_items(id) ON DELETE SET NULL,
  
  -- Event
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'segment_start', 'segment_end',
      'break_start', 'break_end',
      'graphic_on', 'graphic_off',
      'source_switch',
      'override', 'manual_note', 'error',
      'show_start', 'show_end'
    )),
  title TEXT NOT NULL,
  
  -- Timing
  planned_time TIMESTAMPTZ,
  actual_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  planned_duration INTEGER,         -- seconds
  actual_duration INTEGER,          -- seconds
  deviation_seconds INTEGER DEFAULT 0,  -- + = over, - = under
  
  -- Context
  source TEXT,                      -- Which source/feed
  operator TEXT,                    -- Who triggered it
  notes TEXT,
  
  -- Automatic (system) vs manual entry
  is_automatic BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 8. TIMING LOG — Precise timing data for analytics
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_timing_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rundown_id UUID NOT NULL REFERENCES broadcast_rundowns(id) ON DELETE CASCADE,
  rundown_item_id UUID REFERENCES broadcast_rundown_items(id) ON DELETE SET NULL,
  
  mark_type TEXT NOT NULL
    CHECK (mark_type IN ('item_start', 'item_end', 'show_start', 'show_end', 'marker')),
  
  wall_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  show_elapsed_seconds NUMERIC(10,3),  -- Seconds since show start (ms precision)
  
  operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════

-- Stories
CREATE INDEX IF NOT EXISTS idx_broadcast_stories_project ON broadcast_stories(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_stories_status ON broadcast_stories(project_id, status);
CREATE INDEX IF NOT EXISTS idx_broadcast_stories_assigned ON broadcast_stories(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_broadcast_story_versions ON broadcast_story_versions(story_id, version);

-- Rundowns
CREATE INDEX IF NOT EXISTS idx_broadcast_rundowns_project ON broadcast_rundowns(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_rundowns_date ON broadcast_rundowns(project_id, show_date);
CREATE INDEX IF NOT EXISTS idx_broadcast_rundown_items ON broadcast_rundown_items(rundown_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_broadcast_rundown_items_story ON broadcast_rundown_items(story_id) WHERE story_id IS NOT NULL;

-- Wire
CREATE INDEX IF NOT EXISTS idx_broadcast_wire_feeds ON broadcast_wire_feeds(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_broadcast_wire_stories_feed ON broadcast_wire_stories(feed_id, ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_wire_stories_project ON broadcast_wire_stories(project_id, ingested_at DESC);

-- Sources
CREATE INDEX IF NOT EXISTS idx_broadcast_sources ON broadcast_sources(project_id, is_active);

-- MOS
CREATE INDEX IF NOT EXISTS idx_broadcast_mos ON broadcast_mos_devices(project_id, is_active);

-- Graphics
CREATE INDEX IF NOT EXISTS idx_broadcast_gfx_templates ON broadcast_graphics_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_gfx_cues ON broadcast_graphics_cues(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_gfx_cues_rundown ON broadcast_graphics_cues(rundown_id) WHERE rundown_id IS NOT NULL;

-- As-Run
CREATE INDEX IF NOT EXISTS idx_broadcast_as_run ON broadcast_as_run_log(project_id, actual_time DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_as_run_rundown ON broadcast_as_run_log(rundown_id) WHERE rundown_id IS NOT NULL;

-- Timing
CREATE INDEX IF NOT EXISTS idx_broadcast_timing ON broadcast_timing_marks(rundown_id, wall_time);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

ALTER TABLE broadcast_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_story_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_rundowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_rundown_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_wire_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_wire_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_mos_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_graphics_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_graphics_cues ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_as_run_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_timing_marks ENABLE ROW LEVEL SECURITY;

-- Stories
CREATE POLICY IF NOT EXISTS "bcast_stories_sel" ON broadcast_stories FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_stories_ins" ON broadcast_stories FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_stories_upd" ON broadcast_stories FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_stories_del" ON broadcast_stories FOR DELETE USING (is_broadcast_member(project_id));

-- Story versions
CREATE POLICY IF NOT EXISTS "bcast_sv_sel" ON broadcast_story_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM broadcast_stories s WHERE s.id = story_id AND is_broadcast_member(s.project_id)));
CREATE POLICY IF NOT EXISTS "bcast_sv_ins" ON broadcast_story_versions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM broadcast_stories s WHERE s.id = story_id AND is_broadcast_member(s.project_id)));

-- Rundowns
CREATE POLICY IF NOT EXISTS "bcast_rundowns_sel" ON broadcast_rundowns FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_rundowns_ins" ON broadcast_rundowns FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_rundowns_upd" ON broadcast_rundowns FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_rundowns_del" ON broadcast_rundowns FOR DELETE USING (is_broadcast_member(project_id));

-- Rundown items
CREATE POLICY IF NOT EXISTS "bcast_ri_sel" ON broadcast_rundown_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));
CREATE POLICY IF NOT EXISTS "bcast_ri_ins" ON broadcast_rundown_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));
CREATE POLICY IF NOT EXISTS "bcast_ri_upd" ON broadcast_rundown_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));
CREATE POLICY IF NOT EXISTS "bcast_ri_del" ON broadcast_rundown_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));

-- Wire feeds
CREATE POLICY IF NOT EXISTS "bcast_wf_sel" ON broadcast_wire_feeds FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_wf_ins" ON broadcast_wire_feeds FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_wf_upd" ON broadcast_wire_feeds FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_wf_del" ON broadcast_wire_feeds FOR DELETE USING (is_broadcast_member(project_id));

-- Wire stories
CREATE POLICY IF NOT EXISTS "bcast_ws_sel" ON broadcast_wire_stories FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_ws_ins" ON broadcast_wire_stories FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_ws_upd" ON broadcast_wire_stories FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_ws_del" ON broadcast_wire_stories FOR DELETE USING (is_broadcast_member(project_id));

-- Sources
CREATE POLICY IF NOT EXISTS "bcast_src_sel" ON broadcast_sources FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_src_ins" ON broadcast_sources FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_src_upd" ON broadcast_sources FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_src_del" ON broadcast_sources FOR DELETE USING (is_broadcast_member(project_id));

-- MOS devices
CREATE POLICY IF NOT EXISTS "bcast_mos_sel" ON broadcast_mos_devices FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_mos_ins" ON broadcast_mos_devices FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_mos_upd" ON broadcast_mos_devices FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_mos_del" ON broadcast_mos_devices FOR DELETE USING (is_broadcast_member(project_id));

-- Graphics templates
CREATE POLICY IF NOT EXISTS "bcast_gt_sel" ON broadcast_graphics_templates FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_gt_ins" ON broadcast_graphics_templates FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_gt_upd" ON broadcast_graphics_templates FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_gt_del" ON broadcast_graphics_templates FOR DELETE USING (is_broadcast_member(project_id));

-- Graphics cues
CREATE POLICY IF NOT EXISTS "bcast_gc_sel" ON broadcast_graphics_cues FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_gc_ins" ON broadcast_graphics_cues FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_gc_upd" ON broadcast_graphics_cues FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_gc_del" ON broadcast_graphics_cues FOR DELETE USING (is_broadcast_member(project_id));

-- As-run
CREATE POLICY IF NOT EXISTS "bcast_ar_sel" ON broadcast_as_run_log FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_ar_ins" ON broadcast_as_run_log FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_ar_del" ON broadcast_as_run_log FOR DELETE USING (is_broadcast_member(project_id));

-- Timing marks
CREATE POLICY IF NOT EXISTS "bcast_tm_sel" ON broadcast_timing_marks FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_tm_ins" ON broadcast_timing_marks FOR INSERT WITH CHECK (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════

CREATE TRIGGER trg_broadcast_stories_updated BEFORE UPDATE ON broadcast_stories FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
CREATE TRIGGER trg_broadcast_rundowns_updated BEFORE UPDATE ON broadcast_rundowns FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
CREATE TRIGGER trg_broadcast_rundown_items_updated BEFORE UPDATE ON broadcast_rundown_items FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
CREATE TRIGGER trg_broadcast_wire_feeds_updated BEFORE UPDATE ON broadcast_wire_feeds FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
CREATE TRIGGER trg_broadcast_sources_updated BEFORE UPDATE ON broadcast_sources FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
CREATE TRIGGER trg_broadcast_mos_devices_updated BEFORE UPDATE ON broadcast_mos_devices FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
CREATE TRIGGER trg_broadcast_gfx_cues_updated BEFORE UPDATE ON broadcast_graphics_cues FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();

-- ════════════════════════════════════════════════════════════
-- FUNCTIONS — Timing Engine (server-side back-timing)
-- ════════════════════════════════════════════════════════════

-- Calculate back-times for all items in a rundown
-- Back-timing works backwards from the scheduled end:
-- The last item's back-time = scheduled_end - its duration
-- The second-to-last = last_back_time - its duration
-- etc.
CREATE OR REPLACE FUNCTION broadcast_calculate_back_times(p_rundown_id UUID)
RETURNS TABLE(item_id UUID, back_time TIMESTAMPTZ, cumulative_seconds INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_scheduled_end TIMESTAMPTZ;
  v_running_time INTEGER := 0;
BEGIN
  SELECT scheduled_end INTO v_scheduled_end
  FROM broadcast_rundowns WHERE id = p_rundown_id;
  
  IF v_scheduled_end IS NULL THEN
    RETURN;
  END IF;

  -- Walk items in REVERSE order, accumulating duration
  FOR item_id, back_time, cumulative_seconds IN
    SELECT
      ri.id,
      v_scheduled_end - (SUM(ri.planned_duration) OVER (ORDER BY ri.sort_order DESC))::integer * interval '1 second',
      SUM(ri.planned_duration) OVER (ORDER BY ri.sort_order ASC)::integer
    FROM broadcast_rundown_items ri
    WHERE ri.rundown_id = p_rundown_id
      AND ri.status NOT IN ('killed', 'skipped')
    ORDER BY ri.sort_order ASC
  LOOP
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Calculate over/under for a live rundown
CREATE OR REPLACE FUNCTION broadcast_rundown_over_under(p_rundown_id UUID)
RETURNS TABLE(
  total_planned INTEGER,
  total_actual INTEGER,
  over_under INTEGER,
  show_elapsed INTEGER,
  items_remaining INTEGER
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(ri.planned_duration), 0)::integer AS total_planned,
    COALESCE(SUM(
      CASE
        WHEN ri.actual_duration IS NOT NULL THEN ri.actual_duration
        WHEN ri.on_air_at IS NOT NULL AND ri.off_air_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (ri.off_air_at - ri.on_air_at))::integer
        WHEN ri.on_air_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (now() - ri.on_air_at))::integer
        ELSE 0
      END
    ), 0)::integer AS total_actual,
    (COALESCE(SUM(
      CASE
        WHEN ri.actual_duration IS NOT NULL THEN ri.actual_duration
        WHEN ri.on_air_at IS NOT NULL AND ri.off_air_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (ri.off_air_at - ri.on_air_at))::integer
        WHEN ri.on_air_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (now() - ri.on_air_at))::integer
        ELSE 0
      END
    ), 0) - COALESCE(SUM(
      CASE WHEN ri.status IN ('done', 'on_air') THEN ri.planned_duration ELSE 0 END
    ), 0))::integer AS over_under,
    CASE
      WHEN r.actual_start IS NOT NULL
        THEN EXTRACT(EPOCH FROM (now() - r.actual_start))::integer
      ELSE 0
    END AS show_elapsed,
    COUNT(*) FILTER (WHERE ri.status IN ('pending', 'standby'))::integer AS items_remaining
  FROM broadcast_rundown_items ri
  JOIN broadcast_rundowns r ON r.id = ri.rundown_id
  WHERE ri.rundown_id = p_rundown_id
    AND ri.status NOT IN ('killed', 'skipped')
  GROUP BY r.actual_start;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 9. STREAM INGESTS — RTMP/SRT/WHIP ingest endpoints
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_stream_ingests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Identity
  name TEXT NOT NULL,
  label TEXT,
  
  -- Transport
  protocol TEXT NOT NULL DEFAULT 'rtmp'
    CHECK (protocol IN ('rtmp', 'srt', 'whip', 'rtsp', 'ndi', 'hls_pull')),
  
  -- Ingest endpoint
  ingest_url TEXT NOT NULL,
  stream_key TEXT NOT NULL DEFAULT encode(gen_random_bytes(20), 'hex'),
  
  -- For pull-based ingests (HLS pull, RTSP pull)
  pull_url TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'connecting', 'live', 'error', 'stopped')),
  
  -- Stream metadata (populated when stream is live)
  video_codec TEXT,
  audio_codec TEXT,
  width INTEGER,
  height INTEGER,
  fps NUMERIC(6,2),
  bitrate_kbps INTEGER,
  
  -- Health
  last_keyframe_at TIMESTAMPTZ,
  dropped_frames INTEGER DEFAULT 0,
  uptime_seconds INTEGER DEFAULT 0,
  
  -- Connection timestamps
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  
  -- Audio metadata
  audio_sample_rate INTEGER,
  audio_channels INTEGER,
  
  -- Active flag
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Auto-register as source
  auto_source BOOLEAN NOT NULL DEFAULT true,
  linked_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 10. STREAM OUTPUTS — RTMP/SRT push to destinations
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_stream_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Identity
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'custom'
    CHECK (platform IN ('youtube', 'twitch', 'facebook', 'tiktok', 'instagram', 'x_twitter', 'linkedin', 'custom', 'srt_push', 'ndi_out')),
  
  -- Destination
  rtmp_url TEXT,
  stream_key TEXT,
  srt_url TEXT,
  
  -- Encoding profile
  video_bitrate_kbps INTEGER DEFAULT 4500,
  audio_bitrate_kbps INTEGER DEFAULT 128,
  resolution TEXT DEFAULT '1920x1080',
  fps INTEGER DEFAULT 30,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'starting', 'live', 'error', 'stopping', 'stopped')),
  error_message TEXT,
  
  -- Runtime
  started_at TIMESTAMPTZ,
  uptime_seconds INTEGER DEFAULT 0,
  bytes_sent BIGINT DEFAULT 0,
  
  -- Flags
  is_primary BOOLEAN NOT NULL DEFAULT false,
  auto_start BOOLEAN NOT NULL DEFAULT false,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 11. SWITCHER STATE — Vision mixer / production switcher
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_switcher_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Bus assignments
  program_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  preview_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  
  -- Transition
  transition_type TEXT NOT NULL DEFAULT 'cut'
    CHECK (transition_type IN ('cut', 'mix', 'dip', 'wipe_h', 'wipe_v', 'wipe_circle', 'stinger', 'fade')),
  transition_duration_ms INTEGER NOT NULL DEFAULT 500,
  auto_transition BOOLEAN NOT NULL DEFAULT false,
  
  -- DSK layers
  dsk_1_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  dsk_1_on_air BOOLEAN NOT NULL DEFAULT false,
  dsk_2_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  dsk_2_on_air BOOLEAN NOT NULL DEFAULT false,
  
  -- Upstream keys
  usk_1_type TEXT DEFAULT 'luma'
    CHECK (usk_1_type IN ('luma', 'chroma', 'pattern', NULL)),
  usk_1_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  usk_1_on_air BOOLEAN NOT NULL DEFAULT false,
  
  -- Audio follow video
  audio_follow_video BOOLEAN NOT NULL DEFAULT true,
  
  -- FTB (Fade to Black)
  ftb_active BOOLEAN NOT NULL DEFAULT false,
  
  -- PiP
  pip_enabled BOOLEAN NOT NULL DEFAULT false,
  pip_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  pip_position TEXT DEFAULT 'bottom_right'
    CHECK (pip_position IN ('top_left', 'top_right', 'bottom_left', 'bottom_right', 'custom', NULL)),
  pip_size NUMERIC(3,2) DEFAULT 0.25,
  
  -- Meta
  last_take_at TIMESTAMPTZ,
  operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(project_id) -- One switcher state per project
);

-- ════════════════════════════════════════════════════════════
-- 12. COMMS CHANNELS — IFB / Intercom / Talkback
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_comms_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,               -- Optional channel purpose / notes
  channel_type TEXT NOT NULL DEFAULT 'party_line'
    CHECK (channel_type IN ('party_line', 'ifb', 'program_audio', 'iso', 'playout', 'stage_manager')),
  
  -- Color coding
  color TEXT DEFAULT '#3b82f6',
  
  -- Access
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Members (stored as array of user_ids with roles)
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 13. PLAYOUT / MEDIA PLAYLIST — Master control sequencing
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_playout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Sequencing
  sort_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  
  -- Item type
  item_type TEXT NOT NULL DEFAULT 'clip'
    CHECK (item_type IN ('clip', 'live', 'graphics', 'break', 'bug', 'emergency', 'black', 'slate', 'countdown', 'still')),
  
  -- Media reference
  media_url TEXT,
  media_type TEXT,
  thumbnail_url TEXT,
  
  -- Timing
  duration_seconds INTEGER DEFAULT 0,
  in_point_ms INTEGER DEFAULT 0,
  out_point_ms INTEGER,
  
  -- Transition
  transition_type TEXT DEFAULT 'cut'
    CHECK (transition_type IN ('cut', 'mix', 'dip', 'wipe', NULL)),
  transition_duration_ms INTEGER DEFAULT 0,
  
  -- Auto/manual
  auto_next BOOLEAN NOT NULL DEFAULT true,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'cued', 'playing', 'done', 'skipped')),
  
  -- Source reference (if type=live)
  source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  
  -- Loop
  loop BOOLEAN NOT NULL DEFAULT false,
  
  played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- NEW INDEXES
-- ════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_broadcast_stream_ingests ON broadcast_stream_ingests(project_id, status);
CREATE INDEX IF NOT EXISTS idx_broadcast_stream_outputs ON broadcast_stream_outputs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_broadcast_switcher_state ON broadcast_switcher_state(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_comms ON broadcast_comms_channels(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_broadcast_playout ON broadcast_playout_items(project_id, sort_order);

-- ════════════════════════════════════════════════════════════
-- NEW RLS POLICIES
-- ════════════════════════════════════════════════════════════

ALTER TABLE broadcast_stream_ingests ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_stream_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_switcher_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_comms_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_playout_items ENABLE ROW LEVEL SECURITY;

-- Stream ingests
CREATE POLICY IF NOT EXISTS "bcast_si_sel" ON broadcast_stream_ingests FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_si_ins" ON broadcast_stream_ingests FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_si_upd" ON broadcast_stream_ingests FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_si_del" ON broadcast_stream_ingests FOR DELETE USING (is_broadcast_member(project_id));

-- Stream outputs
CREATE POLICY IF NOT EXISTS "bcast_so_sel" ON broadcast_stream_outputs FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_so_ins" ON broadcast_stream_outputs FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_so_upd" ON broadcast_stream_outputs FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_so_del" ON broadcast_stream_outputs FOR DELETE USING (is_broadcast_member(project_id));

-- Switcher state
CREATE POLICY IF NOT EXISTS "bcast_sw_sel" ON broadcast_switcher_state FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_sw_ins" ON broadcast_switcher_state FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_sw_upd" ON broadcast_switcher_state FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_sw_del" ON broadcast_switcher_state FOR DELETE USING (is_broadcast_member(project_id));

-- Comms channels
CREATE POLICY IF NOT EXISTS "bcast_cc_sel" ON broadcast_comms_channels FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_cc_ins" ON broadcast_comms_channels FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_cc_upd" ON broadcast_comms_channels FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_cc_del" ON broadcast_comms_channels FOR DELETE USING (is_broadcast_member(project_id));

-- Playout items
CREATE POLICY IF NOT EXISTS "bcast_pl_sel" ON broadcast_playout_items FOR SELECT USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_pl_ins" ON broadcast_playout_items FOR INSERT WITH CHECK (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_pl_upd" ON broadcast_playout_items FOR UPDATE USING (is_broadcast_member(project_id));
CREATE POLICY IF NOT EXISTS "bcast_pl_del" ON broadcast_playout_items FOR DELETE USING (is_broadcast_member(project_id));

-- New triggers
CREATE TRIGGER trg_broadcast_stream_ingests_updated BEFORE UPDATE ON broadcast_stream_ingests FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
CREATE TRIGGER trg_broadcast_stream_outputs_updated BEFORE UPDATE ON broadcast_stream_outputs FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
CREATE TRIGGER trg_broadcast_switcher_state_updated BEFORE UPDATE ON broadcast_switcher_state FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
CREATE TRIGGER trg_broadcast_comms_updated BEFORE UPDATE ON broadcast_comms_channels FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
CREATE TRIGGER trg_broadcast_playout_updated BEFORE UPDATE ON broadcast_playout_items FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();

-- ════════════════════════════════════════════════════════════
-- REALTIME — Enable Supabase Realtime on key tables
-- ════════════════════════════════════════════════════════════
-- Note: Run these in Supabase Dashboard > Database > Replication
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stories;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_rundowns;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_rundown_items;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_wire_stories;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_as_run_log;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_switcher_state;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stream_ingests;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stream_outputs;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_playout_items;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_comms_channels;
