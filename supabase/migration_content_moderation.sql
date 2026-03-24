-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Content Moderation & Child Safety Migration               ║
-- ║  CSAM detection, evidence preservation, admin oversight    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════
-- HELPER: Platform admin check (SECURITY DEFINER, no RLS loop)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR id = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ═══════════════════════════════════════════════════════════════
-- ADMIN READ-ONLY ACCESS TO ALL PROJECTS (for admin list only)
-- Does NOT grant write/update/delete access.
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Platform admins can view all projects" ON projects;
CREATE POLICY "Platform admins can view all projects"
  ON projects FOR SELECT
  USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════════
-- ADMIN READ-ONLY on content tables for moderation scanning
-- ═══════════════════════════════════════════════════════════════

-- Scripts
DROP POLICY IF EXISTS "Platform admins can view all scripts" ON scripts;
CREATE POLICY "Platform admins can view all scripts"
  ON scripts FOR SELECT USING (public.is_platform_admin());

-- Script elements (the actual text content)
DROP POLICY IF EXISTS "Platform admins can view all script elements" ON script_elements;
CREATE POLICY "Platform admins can view all script elements"
  ON script_elements FOR SELECT USING (public.is_platform_admin());

-- Ideas
DROP POLICY IF EXISTS "Platform admins can view all ideas" ON ideas;
CREATE POLICY "Platform admins can view all ideas"
  ON ideas FOR SELECT USING (public.is_platform_admin());

-- Documents
DROP POLICY IF EXISTS "Platform admins can view all documents" ON project_documents;
CREATE POLICY "Platform admins can view all documents"
  ON project_documents FOR SELECT USING (public.is_platform_admin());

-- Scenes
DROP POLICY IF EXISTS "Platform admins can view all scenes" ON scenes;
CREATE POLICY "Platform admins can view all scenes"
  ON scenes FOR SELECT USING (public.is_platform_admin());

-- Characters
DROP POLICY IF EXISTS "Platform admins can view all characters" ON characters;
CREATE POLICY "Platform admins can view all characters"
  ON characters FOR SELECT USING (public.is_platform_admin());

-- Channel messages (project chat)
DROP POLICY IF EXISTS "Platform admins can view all channel messages" ON channel_messages;
CREATE POLICY "Platform admins can view all channel messages"
  ON channel_messages FOR SELECT USING (public.is_platform_admin());

-- Direct messages (DMs)
DROP POLICY IF EXISTS "Platform admins can view all direct messages" ON direct_messages;
CREATE POLICY "Platform admins can view all direct messages"
  ON direct_messages FOR SELECT USING (public.is_platform_admin());

-- Conversations (DM threads)
DROP POLICY IF EXISTS "Platform admins can view all conversations" ON conversations;
CREATE POLICY "Platform admins can view all conversations"
  ON conversations FOR SELECT USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════════
-- CONTENT FLAGS — Auto-detected or manually flagged content
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS content_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What was flagged
  content_type  TEXT NOT NULL CHECK (content_type IN (
    'script_element', 'idea', 'document', 'scene', 'character',
    'channel_message', 'direct_message', 'project', 'comment'
  )),
  content_id    UUID NOT NULL,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  -- Who authored the flagged content
  flagged_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Detection details
  flag_reason   TEXT NOT NULL CHECK (flag_reason IN (
    'csam', 'child_exploitation', 'child_abuse',
    'terrorism', 'extreme_violence', 'illegal_activity',
    'manual_review'
  )),
  matched_terms TEXT[] DEFAULT '{}',     -- which terms triggered this flag
  content_snippet TEXT NOT NULL,          -- the actual text that was flagged (truncated)
  severity      TEXT NOT NULL DEFAULT 'critical'
                CHECK (severity IN ('critical','high','medium','low')),
  -- Status tracking
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','reviewing','confirmed','false_positive','actioned')),
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes  TEXT,
  reviewed_at   TIMESTAMPTZ,
  -- What action was taken
  action_taken  TEXT CHECK (action_taken IN (
    'none', 'content_removed', 'user_warned', 'user_suspended',
    'user_banned', 'reported_to_authorities', 'evidence_preserved'
  )),
  -- Meta
  detected_at   TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_flags_user ON content_flags(flagged_user_id);
CREATE INDEX IF NOT EXISTS idx_content_flags_status ON content_flags(status, severity);
CREATE INDEX IF NOT EXISTS idx_content_flags_project ON content_flags(project_id);
CREATE INDEX IF NOT EXISTS idx_content_flags_detected ON content_flags(detected_at DESC);

ALTER TABLE content_flags ENABLE ROW LEVEL SECURITY;

-- Only admins can see and manage content flags
DROP POLICY IF EXISTS "Admins can manage content flags" ON content_flags;
CREATE POLICY "Admins can manage content flags" ON content_flags
  FOR ALL USING (public.is_platform_admin());

-- System (triggers/functions) can insert flags
DROP POLICY IF EXISTS "System can insert content flags" ON content_flags;
CREATE POLICY "System can insert content flags" ON content_flags
  FOR INSERT WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- MODERATION EVIDENCE — Tamper-proof snapshots
-- Once inserted, rows can only be read, never updated or deleted.
-- This ensures users cannot destroy evidence by deleting content.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS moderation_evidence (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id       UUID NOT NULL REFERENCES content_flags(id) ON DELETE RESTRICT,
  -- Full snapshot of the content at time of capture
  content_type  TEXT NOT NULL,
  content_id    UUID NOT NULL,
  full_content  TEXT NOT NULL,           -- complete text, not truncated
  content_metadata JSONB DEFAULT '{}',   -- any extra context (project title, script name, etc.)
  -- Author details at time of capture
  author_id     UUID NOT NULL,
  author_email  TEXT,
  author_name   TEXT,
  author_ip     TEXT,                    -- if available from audit_log
  -- Capture details
  captured_by   UUID NOT NULL REFERENCES profiles(id),
  captured_at   TIMESTAMPTZ DEFAULT now(),
  -- Hash for integrity verification
  content_hash  TEXT NOT NULL             -- SHA-256 of full_content for tamper detection
);

CREATE INDEX IF NOT EXISTS idx_evidence_flag ON moderation_evidence(flag_id);
CREATE INDEX IF NOT EXISTS idx_evidence_author ON moderation_evidence(author_id);

ALTER TABLE moderation_evidence ENABLE ROW LEVEL SECURITY;

-- Evidence is IMMUTABLE: admins can read and insert, but NEVER update or delete
DROP POLICY IF EXISTS "Admins can read evidence" ON moderation_evidence;
CREATE POLICY "Admins can read evidence" ON moderation_evidence
  FOR SELECT USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Admins can capture evidence" ON moderation_evidence;
CREATE POLICY "Admins can capture evidence" ON moderation_evidence
  FOR INSERT WITH CHECK (public.is_platform_admin());

-- Explicitly deny update/delete by having NO policies for those operations
-- RLS is enabled, so without a policy, UPDATE and DELETE are blocked for everyone.


-- ═══════════════════════════════════════════════════════════════
-- USER MODERATION FLAGS — Visible warning on user profiles
-- When a user has flagged DMs, show a warning badge in admin views
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS moderation_flags INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'clean'
  CHECK (moderation_status IN ('clean', 'flagged', 'warned', 'suspended', 'banned'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS moderation_notes TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_flagged_at TIMESTAMPTZ;


-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Auto-increment moderation_flags on user when flagged
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_user_moderation_flags()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET moderation_flags = (
    SELECT count(*) FROM content_flags
    WHERE flagged_user_id = NEW.flagged_user_id
    AND status NOT IN ('false_positive')
  ),
  moderation_status = CASE
    WHEN (SELECT count(*) FROM content_flags
          WHERE flagged_user_id = NEW.flagged_user_id
          AND status NOT IN ('false_positive')
          AND flag_reason IN ('csam', 'child_exploitation', 'child_abuse')) > 0
    THEN 'flagged'
    ELSE COALESCE(
      (SELECT moderation_status FROM profiles WHERE id = NEW.flagged_user_id),
      'clean'
    )
  END,
  last_flagged_at = now()
  WHERE id = NEW.flagged_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_moderation_flags ON content_flags;
CREATE TRIGGER trg_update_moderation_flags
  AFTER INSERT ON content_flags
  FOR EACH ROW EXECUTE FUNCTION update_user_moderation_flags();


-- ═══════════════════════════════════════════════════════════════
-- AUDIT: Log all moderation actions
-- ═══════════════════════════════════════════════════════════════
-- (Uses existing audit_log table from migration_security_legal.sql)
-- No new table needed — just reference entity_type = 'moderation_action'


-- ═══════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════
GRANT ALL ON content_flags TO authenticated, service_role;
GRANT ALL ON moderation_evidence TO authenticated, service_role;
