-- ============================================================
-- Feature Flags & Insider Program Migration
-- ============================================================

-- Feature flags table — admin controls which features are alpha/beta/released
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,           -- e.g. 'storyboard_ai', 'real_time_collab'
  name TEXT NOT NULL,                  -- Human-readable name
  description TEXT,                    -- What this feature does
  tier TEXT NOT NULL DEFAULT 'released' CHECK (tier IN ('alpha', 'beta', 'released', 'disabled')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'editor', 'collaboration', 'production', 'community', 'ai', 'export', 'integration')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add insider_tier column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS insider_tier TEXT DEFAULT NULL CHECK (insider_tier IS NULL OR insider_tier IN ('alpha', 'beta'));

-- RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Everyone can read feature flags (needed for client-side gating)
CREATE POLICY "feature_flags_read" ON feature_flags FOR SELECT USING (true);

-- Only admins can manage feature flags
CREATE POLICY "feature_flags_admin" ON feature_flags FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_tier ON feature_flags(tier);
CREATE INDEX IF NOT EXISTS idx_profiles_insider_tier ON profiles(insider_tier) WHERE insider_tier IS NOT NULL;

-- Seed some initial feature flags (existing features as released)
INSERT INTO feature_flags (key, name, description, tier, category) VALUES
  ('script_editor', 'Script Editor', 'Core screenplay/script writing editor', 'released', 'editor'),
  ('real_time_collab', 'Real-time Collaboration', 'Live multi-user editing with presence indicators', 'released', 'collaboration'),
  ('storyboard', 'Storyboard', 'Visual storyboard creation with shot planning', 'released', 'production'),
  ('schedule', 'Production Schedule', 'Scheduling and calendar tools for production', 'released', 'production'),
  ('budget', 'Budget Tracker', 'Production budget tracking and management', 'released', 'production'),
  ('community', 'Community', 'Community posts, discussions and sharing', 'released', 'community'),
  ('version_history', 'Version History', 'Track and restore previous script versions', 'released', 'editor'),
  ('moodboard', 'Moodboard', 'Visual mood/reference board for projects', 'released', 'production'),
  ('mindmap', 'Mind Map', 'Story structure mind mapping tool', 'released', 'editor'),
  ('documents', 'Project Documents', 'Attach and manage project documents', 'released', 'general'),
  ('project_sharing', 'Project Sharing', 'Share projects with external collaborators', 'released', 'collaboration'),
  ('company_system', 'Company System', 'Company management and team features', 'released', 'collaboration'),
  ('trailer_editor', 'Trailer Editor', 'Create and manage project trailers', 'released', 'production'),
  ('seo_toolkit', 'SEO Toolkit', 'SEO analysis for public project pages', 'released', 'general'),
  ('broll_manager', 'B-Roll Manager', 'Manage B-roll footage library', 'released', 'production'),
  -- Pro features (alpha tier — only visible to alpha insiders, or Pro subscribers)
  ('pro_share_portal', 'Share Portal', 'Share projects with external stakeholders via a branded portal', 'alpha', 'collaboration'),
  ('pro_analytics', 'Analytics Dashboard', 'Project analytics and engagement metrics', 'alpha', 'general'),
  ('pro_version_history', 'Advanced Versions', 'Full version history with diff view and restore', 'alpha', 'editor'),
  ('pro_export', 'Advanced Export', 'Bulk export, watermarked PDFs, and multi-format output', 'alpha', 'export'),
  ('pro_ai_analysis', 'AI Script Analysis', 'AI-powered script feedback and scoring', 'alpha', 'ai'),
  ('pro_client_review', 'Client Review', 'Dedicated client review portal with annotations', 'alpha', 'collaboration'),
  ('pro_branding', 'Custom Branding', 'Brand kit with custom logos, colors, and watermarks', 'alpha', 'general'),
  ('pro_revisions', 'Revision Tracking', 'Track and compare script revisions with color pages', 'alpha', 'editor'),
  ('pro_reports', 'Production Reports', 'Generate call sheets, DOOD reports, and production summaries', 'alpha', 'production'),
  ('pro_casting', 'Casting', 'Casting management with talent profiles', 'alpha', 'production'),
  ('pro_subscription', 'Pro Subscription', 'The Pro subscription / billing system itself', 'alpha', 'general')
ON CONFLICT (key) DO NOTHING;
