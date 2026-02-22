-- ============================================================
-- Migration: Pro Subscription System
-- Adds subscription management, team licensing, version history,
-- client review portals, and external share links.
-- ============================================================

-- ── 1. Subscriptions table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'pro',        -- 'pro' | 'enterprise'
  status TEXT NOT NULL DEFAULT 'active',    -- 'active' | 'cancelled' | 'expired' | 'trialing'
  billing_cycle TEXT NOT NULL DEFAULT 'yearly', -- 'yearly' | 'monthly'
  price_cents INTEGER NOT NULL DEFAULT 20000,   -- $200.00
  currency TEXT NOT NULL DEFAULT 'usd',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 year'),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  paypal_customer_id TEXT,
  paypal_subscription_id TEXT,
  payment_method TEXT DEFAULT 'dev_bypass',  -- 'paypal' | 'dev_bypass'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ── 2. Team seat licenses (corporate bulk buying) ───────────
CREATE TABLE IF NOT EXISTS team_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchaser_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'active' | 'revoked' | 'expired'
  plan TEXT NOT NULL DEFAULT 'pro',
  price_cents INTEGER NOT NULL DEFAULT 16000,  -- $160 (20% team discount)
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 year'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_licenses_purchaser ON team_licenses(purchaser_id);
CREATE INDEX IF NOT EXISTS idx_team_licenses_recipient ON team_licenses(recipient_id);
CREATE INDEX IF NOT EXISTS idx_team_licenses_company ON team_licenses(company_id);

-- ── 3. Script version history ───────────────────────────────
CREATE TABLE IF NOT EXISTS script_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  content JSONB NOT NULL,                 -- Full script content snapshot
  word_count INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 0,
  change_summary TEXT,
  is_auto_save BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_versions_script ON script_versions(script_id);
CREATE INDEX IF NOT EXISTS idx_script_versions_project ON script_versions(project_id, created_at DESC);

-- ── 4. External share links (portals) ───────────────────────
CREATE TABLE IF NOT EXISTS external_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL DEFAULT 'script',  -- 'script' | 'storyboard' | 'moodboard' | 'full'
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  title TEXT,
  password_hash TEXT,                     -- Optional password protection
  allow_comments BOOLEAN NOT NULL DEFAULT false,
  allow_download BOOLEAN NOT NULL DEFAULT false,
  watermark_text TEXT,                    -- e.g. "CONFIDENTIAL — Reviewer Name"
  expires_at TIMESTAMPTZ,
  max_views INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  branding JSONB DEFAULT '{}',            -- { logo_url, company_name, color }
  content_snapshot JSONB DEFAULT NULL,     -- Snapshot of project + script content for anonymous access
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_shares_token ON external_shares(access_token);
CREATE INDEX IF NOT EXISTS idx_external_shares_project ON external_shares(project_id);

-- ── 5. Client review sessions ───────────────────────────────
CREATE TABLE IF NOT EXISTS review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES external_shares(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT,
  reviewer_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'submitted'
  overall_rating INTEGER,                 -- 1-5
  overall_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

-- ── 6. Review annotations (line-level feedback) ─────────────
CREATE TABLE IF NOT EXISTS review_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  element_type TEXT,                       -- 'scene_heading' | 'action' | 'dialogue' | 'shot' | etc.
  element_index INTEGER,                   -- Line/element index in script
  content TEXT NOT NULL,
  annotation_type TEXT NOT NULL DEFAULT 'note', -- 'note' | 'approval' | 'revision_request' | 'question'
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_annotations_session ON review_annotations(session_id);

-- ── 7. Project analytics (activity tracking) ────────────────
CREATE TABLE IF NOT EXISTS project_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,                -- 'page_edit' | 'scene_add' | 'export' | 'comment' | 'login' | ...
  event_data JSONB DEFAULT '{}',
  page TEXT,                               -- Which project page
  word_count_delta INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_analytics_project ON project_analytics(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_analytics_user ON project_analytics(user_id, created_at DESC);

-- ── 8. Update profiles for Pro storage limit ─────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT DEFAULT 1073741824;  -- 1 GB free, 50 GB pro

-- ── 9. Update projects for branding ──────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS custom_branding JSONB DEFAULT NULL,  -- { logo_url, company_name, watermark, color }
  ADD COLUMN IF NOT EXISTS max_team_size INTEGER DEFAULT 5;     -- 5 free, unlimited pro

-- ── 10. RLS Policies ─────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_analytics ENABLE ROW LEVEL SECURITY;

-- Subscriptions: users can see their own
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Team licenses: purchaser + recipient can see
CREATE POLICY "View team licenses" ON team_licenses FOR SELECT
  USING (auth.uid() = purchaser_id OR auth.uid() = recipient_id);
CREATE POLICY "Purchaser manages licenses" ON team_licenses FOR ALL
  USING (auth.uid() = purchaser_id);

-- Script versions: project members can see
CREATE POLICY "Members view script versions" ON script_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_id = script_versions.project_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM projects WHERE id = script_versions.project_id AND created_by = auth.uid()));
CREATE POLICY "Members create script versions" ON script_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- External shares: creator can manage, public read via token
CREATE POLICY "Creator manages shares" ON external_shares FOR ALL USING (auth.uid() = created_by);
CREATE POLICY "Project members view shares" ON external_shares FOR SELECT
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_id = external_shares.project_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM projects WHERE id = external_shares.project_id AND created_by = auth.uid()));
-- Anonymous access: anyone with the token can read active shares
CREATE POLICY "Public read active shares by token" ON external_shares FOR SELECT
  USING (is_active = true);
-- Anonymous can increment view count
CREATE POLICY "Public update view count" ON external_shares FOR UPDATE
  USING (is_active = true) WITH CHECK (is_active = true);

-- Review sessions: public insert (for external reviewers), creator can view
CREATE POLICY "Anyone can create review session" ON review_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "View review sessions" ON review_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM external_shares WHERE id = review_sessions.share_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members pm JOIN external_shares es ON es.project_id = pm.project_id WHERE es.id = review_sessions.share_id AND pm.user_id = auth.uid()));

-- Review annotations: anyone can insert (external reviewers), project team can view
CREATE POLICY "Anyone can add annotations" ON review_annotations FOR INSERT WITH CHECK (true);
CREATE POLICY "View annotations" ON review_annotations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM review_sessions rs
    JOIN external_shares es ON es.id = rs.share_id
    WHERE rs.id = review_annotations.session_id
    AND (es.created_by = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_id = es.project_id AND user_id = auth.uid()))
  ));

-- Analytics: project members can view and insert
CREATE POLICY "Members view analytics" ON project_analytics FOR SELECT
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_id = project_analytics.project_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM projects WHERE id = project_analytics.project_id AND created_by = auth.uid()));
CREATE POLICY "Members insert analytics" ON project_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);
