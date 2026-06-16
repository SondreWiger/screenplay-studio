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
  -- Pro features — made free (released) for all users
  ('pro_share_portal', 'Share Portal', 'Share projects with external stakeholders via a branded portal', 'released', 'collaboration'),
  ('pro_analytics', 'Analytics Dashboard', 'Project analytics and engagement metrics', 'released', 'general'),
  ('pro_version_history', 'Advanced Versions', 'Full version history with diff view and restore', 'released', 'editor'),
  ('pro_export', 'Advanced Export', 'Bulk export, watermarked PDFs, and multi-format output', 'released', 'export'),
  ('pro_ai_analysis', 'AI Script Analysis', 'AI-powered script feedback and scoring', 'released', 'ai'),
  ('pro_client_review', 'Client Review', 'Dedicated client review portal with annotations', 'released', 'collaboration'),
  ('pro_branding', 'Custom Branding', 'Brand kit with custom logos, colors, and watermarks', 'released', 'general'),
  ('pro_revisions', 'Revision Tracking', 'Track and compare script revisions with color pages', 'released', 'editor'),
  ('pro_reports', 'Production Reports', 'Generate call sheets, DOOD reports, and production summaries', 'released', 'production'),
  ('pro_casting', 'Casting', 'Casting management with talent profiles', 'released', 'production'),
  ('pro_subscription', 'Pro Subscription', 'The Pro subscription / billing system itself', 'released', 'general'),
  -- Studio tier (big productions — requires Studio subscription)
  ('studio_portfolio', 'Studio Portfolio', 'Multi-project portfolio dashboard across all productions', 'alpha', 'general'),
  ('studio_accounting', 'Production Accounting', 'Payroll integration, investor reports, and tax documents', 'alpha', 'general'),
  ('studio_rights', 'Rights & Clearance', 'Track music rights, location releases, and talent agreements', 'alpha', 'production'),
  ('studio_distribution', 'Distribution & Delivery', 'DCP specs, subtitle generation, QC reports, festival submissions', 'alpha', 'export'),
  ('studio_crew_portal', 'Crew Portal', 'Crew database, availability calendar, digital call sheets', 'alpha', 'production'),
  ('studio_departments', 'Department Management', 'Per-department task tracking with dependencies and handoffs', 'alpha', 'production'),
  ('studio_compliance', 'Insurance & Compliance', 'COI management, SAG/AFTRA paperwork, safety reports', 'alpha', 'general'),
  ('studio_integrations', 'API & Integrations', 'Webhooks, Zapier, Slack, Monday.com integration', 'alpha', 'integration'),
  ('studio_sso', 'SSO & Audit', 'SAML/SSO, role-based access, full audit trail', 'alpha', 'integration'),
  ('studio_security', 'Advanced Security', 'IP watermarking, DRM, NDA enforcement for scripts', 'alpha', 'general'),
  ('studio_script_supervising', 'Script Supervising', 'Continuity logs, line timing sheets, editor notes per scene', 'alpha', 'production'),
  ('studio_vfx_tracking', 'VFX Shot Tracking', 'Asset tracking, vendor deliveries, plate management, render queue', 'alpha', 'production'),
  ('studio_music_sound', 'Music & Sound Supervision', 'Temp tracks, licensing, composer briefs, ADR cues, spotting notes', 'alpha', 'production'),
  ('studio_talent_mgmt', 'Talent Management', 'Deal memos, contracts, SAG/AFTRA reporting, residuals tracking', 'alpha', 'general'),
  ('studio_location_scouting', 'Location Scouting', 'Scout photos, permits, site surveys, contact sheets, camera maps', 'alpha', 'production'),
  ('studio_vendor_mgmt', 'Vendor Management', 'Equipment rental quotes, POs, vendor contracts, booking', 'alpha', 'production'),
  ('studio_stunts_safety', 'Stunts & Safety', 'Risk assessments, stunt coordinator docs, safety meeting logs', 'alpha', 'production'),
  ('studio_greenlight', 'Greenlight & Financing', 'Pitch decks, package management, investor tracker, financing docs', 'alpha', 'general'),
  ('studio_festival', 'Festival Strategy', 'Submission tracker, screening copies, press kits, reviews', 'alpha', 'general'),
  ('studio_tax_incentives', 'Tax Incentives', 'Rebate tracking, expenditure reports, audit support per region', 'alpha', 'general'),
  ('studio_multilang', 'Multi-Language', 'Dubbing scripts, subtitle translation workflow, localization notes', 'alpha', 'export'),
  ('studio_archival', 'Archival & Preservation', 'Final deliverables archive, metadata tagging, LTO tracking', 'alpha', 'export'),
  ('studio_broadcast_compliance', 'Broadcast Compliance', 'Closed captioning specs, rating board submissions, ASI feed specs', 'alpha', 'export'),
  ('studio_post_production', 'Post-Production Pipeline', 'Turnover schedules, color grade specs, sound mix tracking, online/offline editorial workflow', 'alpha', 'production'),
  ('studio_marketing', 'Marketing & PR', 'Key art approvals, trailer versions, press outreach, social media calendar', 'alpha', 'general'),
  ('studio_legal', 'Legal & Contracts', 'E-signatures, deal memos, chain of title, contract repository, rights management', 'alpha', 'general'),
  ('studio_crowdfunding', 'Crowdfunding & Fundraising', 'Campaign dashboard, reward tiers, backer communications, funding progress tracking', 'alpha', 'general'),
  ('studio_box_office', 'Box Office & Revenue', 'Box office reporting, revenue sharing, distribution statements, watermark tracking', 'alpha', 'general'),
  ('studio_travel', 'Travel & Accommodations', 'Hotel blocks, flight bookings, travel approvals, per diem tracking, itineraries', 'alpha', 'production'),
  ('studio_catering', 'Catering & Craft Services', 'Crafty budgets, meal counts, dietary restrictions, catering vendor management, snack requests', 'alpha', 'production'),
  ('studio_sustainability', 'Sustainability & Green Production', 'Carbon footprint calculator, green production guidelines, recycling tracking, sustainability reports', 'alpha', 'general'),
  ('studio_extras', 'Extras & Background Casting', 'Background talent booking, stand-in coordination, extras database, fitting schedules', 'alpha', 'production'),
  ('studio_equipment', 'Equipment Rentals', 'Rental quotes, gear reservations, rental house database, equipment check-in/out', 'alpha', 'production'),
  ('studio_wrap', 'Wrap & Completion', 'Wrap book creation, completion bond docs, final delivery checklist, tax credit paperwork', 'alpha', 'production'),
  ('studio_newsletter', 'Production Newsletter', 'Cast & crew newsletter builder, announcements, milestone celebrations, distribution lists', 'alpha', 'general')
ON CONFLICT (key) DO NOTHING;
