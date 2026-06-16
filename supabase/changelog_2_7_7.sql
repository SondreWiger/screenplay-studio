-- ============================================================
-- Changelog: 2.7.7 — Studio Tier Launch
-- ============================================================
-- All previous Pro features are now free for everyone.
-- Studio tier adds big-production tools.

-- 1. Add studio columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_studio BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS studio_since TIMESTAMPTZ;

-- 2. Release all previous Pro feature flags to everyone
UPDATE feature_flags SET tier = 'released', updated_at = now()
WHERE key IN (
  'pro_share_portal',
  'pro_analytics',
  'pro_version_history',
  'pro_export',
  'pro_ai_analysis',
  'pro_client_review',
  'pro_branding',
  'pro_revisions',
  'pro_reports',
  'pro_casting',
  'pro_subscription'
);

-- 3. Seed Studio tier feature flags
INSERT INTO feature_flags (key, name, description, tier, category) VALUES
  ('studio_subscription', 'Studio Subscription', 'The Studio subscription / billing system itself', 'alpha', 'general'),
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

-- 4. Create the new release entry
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.7',
  'Studio Tier — Big Production Tools',
  'All previous Pro features (version history, share portals, analytics, AI analysis, client review, branding, revision tracking, reports, casting, advanced export) are now free for everyone. Introducing the Studio tier with multi-project portfolio dashboards, production accounting, rights & clearance tracking, distribution & delivery tools, crew portal, department management, insurance/compliance docs, API integrations, SSO/audit, and advanced security features.',
  'feature'
);
