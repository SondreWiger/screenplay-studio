-- ============================================================
-- Organization System — Full Enterprise Upgrade
-- 
-- Extends the existing company system with:
--   • Org channels (internal communication)
--   • Announcements with read receipts
--   • Project pipeline / kanban stages
--   • Script assignments with deadlines & approval
--   • Internal review notes (separate from regular comments)
--   • Shared resource library (templates, style guides, assets)
--   • Org calendar / milestones
--   • Pitch board for structured story development
--   • Polls / voting within the org
--   • Enhanced analytics tracking
--   • Education mode (classes, assignments, peer review)
--
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS throughout.
-- ============================================================

-- ── 1. ORG CHANNELS (Internal Communication) ────────────────

CREATE TABLE IF NOT EXISTS org_channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  icon        text DEFAULT '#',
  color       text DEFAULT '#6366f1',
  channel_type text NOT NULL DEFAULT 'general'
    CHECK (channel_type IN ('general', 'project', 'team', 'announcement', 'random')),
  is_archived boolean NOT NULL DEFAULT false,
  is_default  boolean NOT NULL DEFAULT false,
  project_id  uuid REFERENCES projects(id) ON DELETE SET NULL,
  team_id     uuid REFERENCES company_teams(id) ON DELETE SET NULL,
  created_by  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_channels_company ON org_channels(company_id);
CREATE INDEX IF NOT EXISTS idx_org_channels_project ON org_channels(project_id);

CREATE TABLE IF NOT EXISTS org_channel_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  uuid NOT NULL REFERENCES org_channels(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     text NOT NULL,
  reply_to_id uuid REFERENCES org_channel_messages(id) ON DELETE SET NULL,
  is_pinned   boolean NOT NULL DEFAULT false,
  attachments jsonb DEFAULT '[]',
  reactions   jsonb DEFAULT '{}',
  is_edited   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_channel_messages_channel ON org_channel_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_channel_messages_author ON org_channel_messages(author_id);

CREATE TABLE IF NOT EXISTS org_channel_members (
  channel_id  uuid NOT NULL REFERENCES org_channels(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT now(),
  is_muted    boolean NOT NULL DEFAULT false,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

-- ── 2. ORG ANNOUNCEMENTS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  content     text NOT NULL,
  priority    text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category    text DEFAULT 'general',
  is_pinned   boolean NOT NULL DEFAULT false,
  expires_at  timestamptz,
  attachments jsonb DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_announcements_company ON org_announcements(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS org_announcement_reads (
  announcement_id uuid NOT NULL REFERENCES org_announcements(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

-- ── 3. PROJECT PIPELINE / KANBAN ─────────────────────────────

CREATE TABLE IF NOT EXISTS org_pipeline_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  color       text DEFAULT '#6366f1',
  icon        text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_pipeline_stages_company ON org_pipeline_stages(company_id, sort_order);

-- Link projects to pipeline stages
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS pipeline_stage_id uuid REFERENCES org_pipeline_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_priority text DEFAULT 'normal'
    CHECK (pipeline_priority IN ('low', 'normal', 'high', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_projects_pipeline ON projects(pipeline_stage_id) WHERE pipeline_stage_id IS NOT NULL;

-- ── 4. SCRIPT ASSIGNMENTS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_script_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  script_id     uuid REFERENCES scripts(id) ON DELETE SET NULL,
  assigned_to   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  assignment_type text NOT NULL DEFAULT 'write'
    CHECK (assignment_type IN ('write', 'rewrite', 'polish', 'review', 'notes')),
  status        text NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'in_progress', 'submitted', 'in_review', 'revision_requested', 'approved', 'rejected')),
  deadline      timestamptz,
  submitted_at  timestamptz,
  approved_at   timestamptz,
  approved_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  revision_count integer NOT NULL DEFAULT 0,
  max_revisions  integer DEFAULT 3,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_script_assignments_company ON org_script_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_org_script_assignments_assignee ON org_script_assignments(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_org_script_assignments_project ON org_script_assignments(project_id);

-- ── 5. INTERNAL REVIEW NOTES (Studio/Network Notes Layer) ────

CREATE TABLE IF NOT EXISTS org_review_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  script_id     uuid REFERENCES scripts(id) ON DELETE SET NULL,
  author_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note_type     text NOT NULL DEFAULT 'general'
    CHECK (note_type IN ('general', 'page', 'line', 'character', 'structure', 'dialogue', 'action')),
  content       text NOT NULL,
  page_number   integer,
  element_index integer,
  element_id    uuid,
  severity      text NOT NULL DEFAULT 'suggestion'
    CHECK (severity IN ('suggestion', 'important', 'mandatory', 'praise')),
  status        text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'addressed', 'dismissed', 'resolved')),
  resolved_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_review_notes_script ON org_review_notes(script_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_review_notes_project ON org_review_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_org_review_notes_author ON org_review_notes(author_id);

-- ── 6. SHARED RESOURCE LIBRARY ───────────────────────────────

CREATE TABLE IF NOT EXISTS org_resources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  resource_type text NOT NULL DEFAULT 'document'
    CHECK (resource_type IN (
      'template', 'style_guide', 'character_bible', 'world_bible',
      'mood_board', 'reference_image', 'contract', 'document', 'other'
    )),
  category      text DEFAULT 'general',
  content       text,
  file_url      text,
  file_name     text,
  file_size     bigint,
  mime_type     text,
  thumbnail_url text,
  tags          text[] DEFAULT '{}',
  is_pinned     boolean NOT NULL DEFAULT false,
  access_level  text NOT NULL DEFAULT 'company'
    CHECK (access_level IN ('company', 'team', 'project')),
  team_id       uuid REFERENCES company_teams(id) ON DELETE SET NULL,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  version       integer NOT NULL DEFAULT 1,
  download_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_resources_company ON org_resources(company_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_org_resources_tags ON org_resources USING gin(tags);

-- ── 7. ORG CALENDAR / MILESTONES ─────────────────────────────

CREATE TABLE IF NOT EXISTS org_calendar_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  event_type    text NOT NULL DEFAULT 'milestone'
    CHECK (event_type IN (
      'milestone', 'deadline', 'meeting', 'table_read',
      'shoot_day', 'review', 'delivery', 'other'
    )),
  start_at      timestamptz NOT NULL,
  end_at        timestamptz,
  all_day       boolean NOT NULL DEFAULT false,
  color         text DEFAULT '#6366f1',
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  is_recurring  boolean NOT NULL DEFAULT false,
  recurrence    jsonb,
  location      text,
  attendees     uuid[] DEFAULT '{}',
  is_cancelled  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_calendar_company ON org_calendar_events(company_id, start_at);
CREATE INDEX IF NOT EXISTS idx_org_calendar_project ON org_calendar_events(project_id);

-- ── 8. PITCH BOARD ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_pitches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  logline       text,
  synopsis      text,
  genre         text,
  format        text,
  target_audience text,
  mood_keywords text[] DEFAULT '{}',
  reference_urls text[] DEFAULT '{}',
  cover_image_url text,
  status        text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'greenlit', 'shelved')),
  reviewed_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes  text,
  reviewed_at   timestamptz,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  vote_count    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_pitches_company ON org_pitches(company_id, status);
CREATE INDEX IF NOT EXISTS idx_org_pitches_author ON org_pitches(author_id);

CREATE TABLE IF NOT EXISTS org_pitch_votes (
  pitch_id    uuid NOT NULL REFERENCES org_pitches(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote        integer NOT NULL DEFAULT 1 CHECK (vote IN (-1, 1)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pitch_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_pitch_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id    uuid NOT NULL REFERENCES org_pitches(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_pitch_comments_pitch ON org_pitch_comments(pitch_id, created_at);

-- ── 9. ORG POLLS / VOTING ────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_polls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question      text NOT NULL,
  description   text,
  poll_type     text NOT NULL DEFAULT 'single'
    CHECK (poll_type IN ('single', 'multiple', 'ranked')),
  options       jsonb NOT NULL DEFAULT '[]',
  is_anonymous  boolean NOT NULL DEFAULT false,
  closes_at     timestamptz,
  is_closed     boolean NOT NULL DEFAULT false,
  channel_id    uuid REFERENCES org_channels(id) ON DELETE SET NULL,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_polls_company ON org_polls(company_id);

CREATE TABLE IF NOT EXISTS org_poll_votes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   uuid NOT NULL REFERENCES org_polls(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  rank      integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id, option_index)
);

-- ── 10. EDUCATION MODE ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_classes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  join_code     text UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex'),
  semester      text,
  year          integer,
  is_active     boolean NOT NULL DEFAULT true,
  max_students  integer DEFAULT 30,
  settings      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_classes_company ON org_classes(company_id);
CREATE INDEX IF NOT EXISTS idx_org_classes_instructor ON org_classes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_org_classes_join_code ON org_classes(join_code);

CREATE TABLE IF NOT EXISTS org_class_students (
  class_id    uuid NOT NULL REFERENCES org_classes(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'dropped', 'completed', 'auditing')),
  grade       text,
  notes       text,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_class_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL REFERENCES org_classes(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  assignment_type text NOT NULL DEFAULT 'script'
    CHECK (assignment_type IN ('script', 'scene', 'outline', 'treatment', 'revision', 'peer_review', 'other')),
  requirements  jsonb DEFAULT '{}',
  due_date      timestamptz,
  max_points    integer DEFAULT 100,
  is_published  boolean NOT NULL DEFAULT false,
  allow_late    boolean NOT NULL DEFAULT true,
  peer_review_enabled boolean NOT NULL DEFAULT false,
  peer_reviews_required integer DEFAULT 2,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_class_assignments_class ON org_class_assignments(class_id, due_date);

CREATE TABLE IF NOT EXISTS org_class_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES org_class_assignments(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  script_id       uuid REFERENCES scripts(id) ON DELETE SET NULL,
  content         text,
  file_url        text,
  status          text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'graded', 'returned', 'resubmitted')),
  grade           integer,
  grade_letter    text,
  feedback        text,
  graded_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  graded_at       timestamptz,
  submitted_at    timestamptz DEFAULT now(),
  is_late         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_org_class_submissions_assignment ON org_class_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_org_class_submissions_student ON org_class_submissions(student_id);

CREATE TABLE IF NOT EXISTS org_peer_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES org_class_submissions(id) ON DELETE CASCADE,
  reviewer_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating          integer CHECK (rating >= 1 AND rating <= 5),
  strengths       text,
  weaknesses      text,
  suggestions     text,
  overall_comment text,
  is_complete     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(submission_id, reviewer_id)
);

-- ── 11. REMOVE FREE-TIER LIMITS ──────────────────────────────

-- Remove max_team_size default of 5 — unlimited for everyone
ALTER TABLE projects ALTER COLUMN max_team_size SET DEFAULT 999999;

-- Remove max_members and max_projects limits on companies
ALTER TABLE companies ALTER COLUMN max_members SET DEFAULT 999999;
ALTER TABLE companies ALTER COLUMN max_projects SET DEFAULT 999999;

-- ── 12. TRIGGERS ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_org_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'org_channels', 'org_channel_messages', 'org_announcements',
    'org_resources', 'org_calendar_events', 'org_pitches',
    'org_review_notes', 'org_script_assignments',
    'org_classes', 'org_class_assignments', 'org_class_submissions',
    'org_peer_reviews'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_org_updated_at()', tbl, tbl
    );
  END LOOP;
END $$;

-- ── 13. ROW LEVEL SECURITY ───────────────────────────────────

-- Enable RLS on all new tables
ALTER TABLE org_channels              ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_channel_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_channel_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_announcements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_announcement_reads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_pipeline_stages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_script_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_review_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_resources             ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_calendar_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_pitches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_pitch_votes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_pitch_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_polls                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_poll_votes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_classes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_class_students        ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_class_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_class_submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_peer_reviews          ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is a member of a company
CREATE OR REPLACE FUNCTION is_company_member(p_company_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION is_company_member(uuid) TO authenticated;

-- Helper: check if current user is admin+ of a company
CREATE OR REPLACE FUNCTION is_company_admin(p_company_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = p_company_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION is_company_admin(uuid) TO authenticated;

-- Helper: check if current user is manager+ of a company
CREATE OR REPLACE FUNCTION is_company_manager(p_company_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = p_company_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
  );
$$;

GRANT EXECUTE ON FUNCTION is_company_manager(uuid) TO authenticated;

-- ── Channels RLS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "org_channels_select" ON org_channels;
CREATE POLICY "org_channels_select" ON org_channels
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_channels_insert" ON org_channels;
CREATE POLICY "org_channels_insert" ON org_channels
  FOR INSERT TO authenticated WITH CHECK (is_company_manager(company_id));

DROP POLICY IF EXISTS "org_channels_update" ON org_channels;
CREATE POLICY "org_channels_update" ON org_channels
  FOR UPDATE TO authenticated USING (is_company_manager(company_id));

DROP POLICY IF EXISTS "org_channels_delete" ON org_channels;
CREATE POLICY "org_channels_delete" ON org_channels
  FOR DELETE TO authenticated USING (is_company_admin(company_id));

-- Channel messages: members can read, channel members can write
DROP POLICY IF EXISTS "org_messages_select" ON org_channel_messages;
CREATE POLICY "org_messages_select" ON org_channel_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM org_channels c WHERE c.id = channel_id AND is_company_member(c.company_id))
  );

DROP POLICY IF EXISTS "org_messages_insert" ON org_channel_messages;
CREATE POLICY "org_messages_insert" ON org_channel_messages
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "org_messages_update" ON org_channel_messages;
CREATE POLICY "org_messages_update" ON org_channel_messages
  FOR UPDATE TO authenticated USING (author_id = auth.uid());

DROP POLICY IF EXISTS "org_messages_delete" ON org_channel_messages;
CREATE POLICY "org_messages_delete" ON org_channel_messages
  FOR DELETE TO authenticated USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM org_channels c WHERE c.id = channel_id AND is_company_admin(c.company_id))
  );

-- Channel members
DROP POLICY IF EXISTS "org_channel_members_select" ON org_channel_members;
CREATE POLICY "org_channel_members_select" ON org_channel_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM org_channels c WHERE c.id = channel_id AND is_company_member(c.company_id))
  );

DROP POLICY IF EXISTS "org_channel_members_insert" ON org_channel_members;
CREATE POLICY "org_channel_members_insert" ON org_channel_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM org_channels c WHERE c.id = channel_id AND is_company_admin(c.company_id))
  );

DROP POLICY IF EXISTS "org_channel_members_delete" ON org_channel_members;
CREATE POLICY "org_channel_members_delete" ON org_channel_members
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM org_channels c WHERE c.id = channel_id AND is_company_admin(c.company_id))
  );

-- ── Announcements RLS ────────────────────────────────────────
DROP POLICY IF EXISTS "org_announcements_select" ON org_announcements;
CREATE POLICY "org_announcements_select" ON org_announcements
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_announcements_insert" ON org_announcements;
CREATE POLICY "org_announcements_insert" ON org_announcements
  FOR INSERT TO authenticated WITH CHECK (is_company_manager(company_id) AND author_id = auth.uid());

DROP POLICY IF EXISTS "org_announcements_update" ON org_announcements;
CREATE POLICY "org_announcements_update" ON org_announcements
  FOR UPDATE TO authenticated USING (author_id = auth.uid() OR is_company_admin(company_id));

DROP POLICY IF EXISTS "org_announcements_delete" ON org_announcements;
CREATE POLICY "org_announcements_delete" ON org_announcements
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR is_company_admin(company_id));

DROP POLICY IF EXISTS "org_announcement_reads_all" ON org_announcement_reads;
CREATE POLICY "org_announcement_reads_all" ON org_announcement_reads
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Pipeline stages RLS ──────────────────────────────────────
DROP POLICY IF EXISTS "org_pipeline_select" ON org_pipeline_stages;
CREATE POLICY "org_pipeline_select" ON org_pipeline_stages
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_pipeline_manage" ON org_pipeline_stages;
CREATE POLICY "org_pipeline_manage" ON org_pipeline_stages
  FOR ALL TO authenticated USING (is_company_admin(company_id)) WITH CHECK (is_company_admin(company_id));

-- ── Script assignments RLS ───────────────────────────────────
DROP POLICY IF EXISTS "org_assignments_select" ON org_script_assignments;
CREATE POLICY "org_assignments_select" ON org_script_assignments
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_assignments_insert" ON org_script_assignments;
CREATE POLICY "org_assignments_insert" ON org_script_assignments
  FOR INSERT TO authenticated WITH CHECK (is_company_manager(company_id) AND assigned_by = auth.uid());

DROP POLICY IF EXISTS "org_assignments_update" ON org_script_assignments;
CREATE POLICY "org_assignments_update" ON org_script_assignments
  FOR UPDATE TO authenticated USING (
    assigned_to = auth.uid() OR assigned_by = auth.uid() OR is_company_admin(company_id)
  );

-- ── Review notes RLS ─────────────────────────────────────────
DROP POLICY IF EXISTS "org_review_notes_select" ON org_review_notes;
CREATE POLICY "org_review_notes_select" ON org_review_notes
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_review_notes_insert" ON org_review_notes;
CREATE POLICY "org_review_notes_insert" ON org_review_notes
  FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id) AND author_id = auth.uid());

DROP POLICY IF EXISTS "org_review_notes_update" ON org_review_notes;
CREATE POLICY "org_review_notes_update" ON org_review_notes
  FOR UPDATE TO authenticated USING (author_id = auth.uid() OR is_company_manager(company_id));

-- ── Resources RLS ────────────────────────────────────────────
DROP POLICY IF EXISTS "org_resources_select" ON org_resources;
CREATE POLICY "org_resources_select" ON org_resources
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_resources_insert" ON org_resources;
CREATE POLICY "org_resources_insert" ON org_resources
  FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "org_resources_update" ON org_resources;
CREATE POLICY "org_resources_update" ON org_resources
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR is_company_manager(company_id));

DROP POLICY IF EXISTS "org_resources_delete" ON org_resources;
CREATE POLICY "org_resources_delete" ON org_resources
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR is_company_admin(company_id));

-- ── Calendar RLS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "org_calendar_select" ON org_calendar_events;
CREATE POLICY "org_calendar_select" ON org_calendar_events
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_calendar_insert" ON org_calendar_events;
CREATE POLICY "org_calendar_insert" ON org_calendar_events
  FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "org_calendar_update" ON org_calendar_events;
CREATE POLICY "org_calendar_update" ON org_calendar_events
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR is_company_manager(company_id));

DROP POLICY IF EXISTS "org_calendar_delete" ON org_calendar_events;
CREATE POLICY "org_calendar_delete" ON org_calendar_events
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR is_company_admin(company_id));

-- ── Pitches RLS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "org_pitches_select" ON org_pitches;
CREATE POLICY "org_pitches_select" ON org_pitches
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_pitches_insert" ON org_pitches;
CREATE POLICY "org_pitches_insert" ON org_pitches
  FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id) AND author_id = auth.uid());

DROP POLICY IF EXISTS "org_pitches_update" ON org_pitches;
CREATE POLICY "org_pitches_update" ON org_pitches
  FOR UPDATE TO authenticated USING (author_id = auth.uid() OR is_company_manager(company_id));

DROP POLICY IF EXISTS "org_pitch_votes_all" ON org_pitch_votes;
CREATE POLICY "org_pitch_votes_all" ON org_pitch_votes
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "org_pitch_comments_select" ON org_pitch_comments;
CREATE POLICY "org_pitch_comments_select" ON org_pitch_comments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM org_pitches p WHERE p.id = pitch_id AND is_company_member(p.company_id))
  );

DROP POLICY IF EXISTS "org_pitch_comments_insert" ON org_pitch_comments;
CREATE POLICY "org_pitch_comments_insert" ON org_pitch_comments
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

-- ── Polls RLS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "org_polls_select" ON org_polls;
CREATE POLICY "org_polls_select" ON org_polls
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_polls_insert" ON org_polls;
CREATE POLICY "org_polls_insert" ON org_polls
  FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "org_polls_update" ON org_polls;
CREATE POLICY "org_polls_update" ON org_polls
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR is_company_admin(company_id));

DROP POLICY IF EXISTS "org_poll_votes_all" ON org_poll_votes;
CREATE POLICY "org_poll_votes_all" ON org_poll_votes
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Education RLS ────────────────────────────────────────────
DROP POLICY IF EXISTS "org_classes_select" ON org_classes;
CREATE POLICY "org_classes_select" ON org_classes
  FOR SELECT TO authenticated USING (
    is_company_member(company_id)
    OR EXISTS (SELECT 1 FROM org_class_students WHERE class_id = id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "org_classes_manage" ON org_classes;
CREATE POLICY "org_classes_manage" ON org_classes
  FOR ALL TO authenticated USING (
    instructor_id = auth.uid() OR is_company_admin(company_id)
  ) WITH CHECK (
    instructor_id = auth.uid() OR is_company_admin(company_id)
  );

DROP POLICY IF EXISTS "org_class_students_select" ON org_class_students;
CREATE POLICY "org_class_students_select" ON org_class_students
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM org_classes c WHERE c.id = class_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id)))
  );

DROP POLICY IF EXISTS "org_class_students_manage" ON org_class_students;
CREATE POLICY "org_class_students_manage" ON org_class_students
  FOR ALL TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM org_classes c WHERE c.id = class_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id)))
  ) WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM org_classes c WHERE c.id = class_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id)))
  );

DROP POLICY IF EXISTS "org_class_assignments_select" ON org_class_assignments;
CREATE POLICY "org_class_assignments_select" ON org_class_assignments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM org_classes c WHERE c.id = class_id AND is_company_member(c.company_id))
    OR EXISTS (SELECT 1 FROM org_class_students s WHERE s.class_id = class_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "org_class_assignments_manage" ON org_class_assignments;
CREATE POLICY "org_class_assignments_manage" ON org_class_assignments
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM org_classes c WHERE c.id = class_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id)))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM org_classes c WHERE c.id = class_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id)))
  );

DROP POLICY IF EXISTS "org_submissions_select" ON org_class_submissions;
CREATE POLICY "org_submissions_select" ON org_class_submissions
  FOR SELECT TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_class_assignments a
      JOIN org_classes c ON c.id = a.class_id
      WHERE a.id = assignment_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id))
    )
  );

DROP POLICY IF EXISTS "org_submissions_insert" ON org_class_submissions;
CREATE POLICY "org_submissions_insert" ON org_class_submissions
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "org_submissions_update" ON org_class_submissions;
CREATE POLICY "org_submissions_update" ON org_class_submissions
  FOR UPDATE TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_class_assignments a
      JOIN org_classes c ON c.id = a.class_id
      WHERE a.id = assignment_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id))
    )
  );

DROP POLICY IF EXISTS "org_peer_reviews_select" ON org_peer_reviews;
CREATE POLICY "org_peer_reviews_select" ON org_peer_reviews
  FOR SELECT TO authenticated USING (
    reviewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM org_class_submissions s WHERE s.id = submission_id AND s.student_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM org_class_submissions s
      JOIN org_class_assignments a ON a.id = s.assignment_id
      JOIN org_classes c ON c.id = a.class_id
      WHERE s.id = submission_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id))
    )
  );

DROP POLICY IF EXISTS "org_peer_reviews_insert" ON org_peer_reviews;
CREATE POLICY "org_peer_reviews_insert" ON org_peer_reviews
  FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "org_peer_reviews_update" ON org_peer_reviews;
CREATE POLICY "org_peer_reviews_update" ON org_peer_reviews
  FOR UPDATE TO authenticated USING (reviewer_id = auth.uid());

-- ── 14. GRANTS ───────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON org_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_channel_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON org_channel_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_announcements TO authenticated;
GRANT SELECT, INSERT, DELETE ON org_announcement_reads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_pipeline_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON org_script_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON org_review_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_resources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_calendar_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON org_pitches TO authenticated;
GRANT SELECT, INSERT, DELETE ON org_pitch_votes TO authenticated;
GRANT SELECT, INSERT ON org_pitch_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON org_polls TO authenticated;
GRANT SELECT, INSERT, DELETE ON org_poll_votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_class_students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_class_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON org_class_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON org_peer_reviews TO authenticated;

-- ── 15. DEFAULT PIPELINE STAGES (inserted per-company) ───────

CREATE OR REPLACE FUNCTION create_default_pipeline_stages()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO org_pipeline_stages (company_id, name, color, icon, sort_order, is_default) VALUES
    (NEW.id, 'Development', '#8b5cf6', '💡', 0, true),
    (NEW.id, 'Writing',     '#3b82f6', '✍️', 1, true),
    (NEW.id, 'Revision',    '#f59e0b', '🔄', 2, true),
    (NEW.id, 'Review',      '#ef4444', '👀', 3, true),
    (NEW.id, 'Production',  '#10b981', '🎬', 4, true),
    (NEW.id, 'Complete',    '#6b7280', '✅', 5, true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_default_pipeline ON companies;
CREATE TRIGGER trg_company_default_pipeline
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION create_default_pipeline_stages();

-- Also create a default #general channel for new companies
CREATE OR REPLACE FUNCTION create_default_org_channel()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO org_channels (company_id, name, description, channel_type, is_default, created_by)
  VALUES (NEW.id, 'general', 'General company discussion', 'general', true, NEW.owner_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_default_channel ON companies;
CREATE TRIGGER trg_company_default_channel
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION create_default_org_channel();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
