-- ============================================================
-- Legal Blog & Security Improvements Migration
-- ============================================================

-- Legal blog posts table
CREATE TABLE IF NOT EXISTS legal_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'update' CHECK (category IN ('tos_update', 'privacy_update', 'security_advisory', 'policy_change', 'compliance', 'transparency_report', 'update', 'announcement')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'important', 'critical')),
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES profiles(id),
  notify_users BOOLEAN NOT NULL DEFAULT true,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log for ALL admin/security actions
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Login history for user safety
CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT DEFAULT 'email', -- email, magic_link, oauth_google, oauth_github
  success BOOLEAN NOT NULL DEFAULT true
);

-- Email verification tracking
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Data export requests (GDPR)
CREATE TABLE IF NOT EXISTS data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  download_url TEXT,
  file_size_bytes BIGINT,
  expires_at TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Account deletion requests (GDPR right to erasure)
CREATE TABLE IF NOT EXISTS deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Security events (suspicious activity tracking)
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'failed_login', 'password_changed', 'email_changed', 'suspicious_login',
    'rate_limited', 'api_abuse', 'brute_force', 'account_locked',
    'data_export', 'account_deletion', 'admin_action', 'permission_change'
  )),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content reports (for community safety)
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  content_type TEXT NOT NULL CHECK (content_type IN ('project', 'comment', 'post', 'message', 'user', 'script')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'copyright', 'nsfw', 'illegal', 'impersonation', 'misinformation', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES profiles(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- User bans
CREATE TABLE IF NOT EXISTS user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  banned_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  ban_type TEXT NOT NULL DEFAULT 'temporary' CHECK (ban_type IN ('warning', 'temporary', 'permanent')),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consent tracking (for GDPR)
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('tos', 'privacy', 'cookies', 'marketing', 'analytics', 'data_processing')),
  version TEXT NOT NULL, -- e.g. 'tos-2026-02-22'
  granted BOOLEAN NOT NULL DEFAULT true,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS Policies ────────────────────────────────────────────

ALTER TABLE legal_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

-- Legal posts: anyone can read published, admins can do everything
CREATE POLICY "legal_posts_read" ON legal_posts FOR SELECT USING (published = true);
CREATE POLICY "legal_posts_admin" ON legal_posts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

-- Audit log: admin read only
CREATE POLICY "audit_log_admin_read" ON audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (true);

-- Login history: users see own, admins see all
CREATE POLICY "login_history_own" ON login_history FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "login_history_admin" ON login_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "login_history_insert" ON login_history FOR INSERT WITH CHECK (true);

-- Security events: users see own, admins see all
CREATE POLICY "security_events_own" ON security_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "security_events_admin" ON security_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "security_events_insert" ON security_events FOR INSERT WITH CHECK (true);

-- Data export requests: users manage own
CREATE POLICY "data_export_own" ON data_export_requests FOR ALL USING (user_id = auth.uid());

-- Deletion requests: users manage own
CREATE POLICY "deletion_requests_own" ON deletion_requests FOR ALL USING (user_id = auth.uid());

-- Content reports: users create, admins manage
CREATE POLICY "reports_create" ON content_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports_own" ON content_reports FOR SELECT USING (reporter_id = auth.uid());
CREATE POLICY "reports_admin" ON content_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

-- User bans: admins manage
CREATE POLICY "bans_admin" ON user_bans FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
CREATE POLICY "bans_own_read" ON user_bans FOR SELECT USING (user_id = auth.uid());

-- Consent records: users manage own
CREATE POLICY "consent_own" ON consent_records FOR ALL USING (user_id = auth.uid());

-- Email verifications: users manage own
CREATE POLICY "email_verify_own" ON email_verifications FOR ALL USING (user_id = auth.uid());

-- ── Indexes for performance ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_legal_posts_published ON legal_posts(published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_posts_slug ON legal_posts(slug);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, login_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_bans_user ON user_bans(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON deletion_requests(status, scheduled_for);

-- ── Increase storage limit ──────────────────────────────────
-- Remove the old 1GB/5GB limit — give everyone 50GB, Pro users 200GB
UPDATE profiles SET storage_limit_bytes = 53687091200 WHERE is_pro = false AND (storage_limit_bytes IS NULL OR storage_limit_bytes < 53687091200);
UPDATE profiles SET storage_limit_bytes = 214748364800 WHERE is_pro = true;

-- ── Fix company invitation role casting ─────────────────────
CREATE OR REPLACE FUNCTION accept_company_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv company_invitations%ROWTYPE;
  v_user_id UUID;
  v_company_name TEXT;
  v_role_text TEXT;
  v_role_type TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_inv FROM company_invitations WHERE id = p_invitation_id;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF v_inv.accepted THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Already accepted');
  END IF;

  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < NOW() THEN
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  v_role_text := v_inv.role::text;

  UPDATE company_invitations SET accepted = true WHERE id = p_invitation_id;

  -- Get the actual type of the role column (handles both user_role and company_role)
  SELECT t.typname INTO v_role_type
  FROM pg_attribute a
  JOIN pg_type t ON a.atttypid = t.oid
  WHERE a.attrelid = 'company_members'::regclass AND a.attname = 'role';

  -- Use dynamic SQL to handle either user_role or company_role
  IF v_role_type = 'user_role' THEN
    EXECUTE 'INSERT INTO company_members (company_id, user_id, role, invited_by)
             VALUES ($1, $2, $3::user_role, $4)
             ON CONFLICT (company_id, user_id) DO UPDATE SET role = $3::user_role'
    USING v_inv.company_id, v_user_id, v_role_text, v_inv.invited_by;
  ELSE
    EXECUTE 'INSERT INTO company_members (company_id, user_id, role, invited_by)
             VALUES ($1, $2, $3::company_role, $4)
             ON CONFLICT (company_id, user_id) DO UPDATE SET role = $3::company_role'
    USING v_inv.company_id, v_user_id, v_role_text, v_inv.invited_by;
  END IF;

  UPDATE profiles SET company_id = v_inv.company_id WHERE id = v_user_id;

  SELECT name INTO v_company_name FROM companies WHERE id = v_inv.company_id;

  INSERT INTO company_activity_log (company_id, user_id, action, entity_type, metadata)
  VALUES (v_inv.company_id, v_user_id, 'accepted_invitation', 'member',
    jsonb_build_object('role', v_role_text));

  RETURN jsonb_build_object('ok', true, 'company_id', v_inv.company_id, 'company_name', v_company_name);
END;
$$;

-- ── Helper function to create legal post notifications ──────
CREATE OR REPLACE FUNCTION notify_legal_post()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.published = true AND (OLD IS NULL OR OLD.published = false) AND NEW.notify_users = true THEN
    -- Create notification for every active user
    INSERT INTO notifications (user_id, type, title, body, link, entity_type, entity_id, metadata)
    SELECT
      p.id,
      'legal_update',
      CASE NEW.severity
        WHEN 'critical' THEN '🚨 Critical Legal Update: ' || NEW.title
        WHEN 'important' THEN '⚠️ Important Legal Update: ' || NEW.title
        ELSE '📋 Legal Update: ' || NEW.title
      END,
      COALESCE(NEW.summary, LEFT(NEW.content, 200)),
      '/legal/blog/' || NEW.slug,
      'legal_post',
      NEW.id,
      jsonb_build_object('category', NEW.category, 'severity', NEW.severity)
    FROM profiles p
    WHERE p.id != NEW.author_id;

    -- Mark publish time
    NEW.published_at := COALESCE(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_legal_post ON legal_posts;
CREATE TRIGGER trg_notify_legal_post
  BEFORE INSERT OR UPDATE ON legal_posts
  FOR EACH ROW EXECUTE FUNCTION notify_legal_post();
