-- Fold the Studio tier into Pro.
--
-- The Studio tier was scaffolded (profiles.is_studio, PRO_LIMITS.studio, a
-- "Studio" nav category, studio_* flags) but nothing ever granted it, so its
-- 32 production tools were unreachable. They now belong to Pro.
--
-- Safe to run whether or not 20260826120000_studio_suite.sql was applied:
-- the table is renamed if it exists and created if it does not.

BEGIN;

-- 1. Record store — rename in place so any existing rows are preserved.
ALTER TABLE IF EXISTS studio_records RENAME TO pro_tool_records;
ALTER INDEX IF EXISTS studio_records_project_tool_idx RENAME TO pro_tool_records_project_tool_idx;
ALTER INDEX IF EXISTS studio_records_data_idx RENAME TO pro_tool_records_data_idx;

CREATE TABLE IF NOT EXISTS pro_tool_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pro_tool_records_project_tool_idx
  ON pro_tool_records (project_id, tool, sort_order);
CREATE INDEX IF NOT EXISTS pro_tool_records_data_idx
  ON pro_tool_records USING GIN (data);

ALTER TABLE pro_tool_records ENABLE ROW LEVEL SECURITY;

-- Policies carry over on rename but keep their old names — recreate them.
DROP POLICY IF EXISTS "studio_records_select" ON pro_tool_records;
DROP POLICY IF EXISTS "studio_records_insert" ON pro_tool_records;
DROP POLICY IF EXISTS "studio_records_update" ON pro_tool_records;
DROP POLICY IF EXISTS "studio_records_delete" ON pro_tool_records;
DROP POLICY IF EXISTS "pro_tool_records_select" ON pro_tool_records;
DROP POLICY IF EXISTS "pro_tool_records_insert" ON pro_tool_records;
DROP POLICY IF EXISTS "pro_tool_records_update" ON pro_tool_records;
DROP POLICY IF EXISTS "pro_tool_records_delete" ON pro_tool_records;

CREATE POLICY "pro_tool_records_select" ON pro_tool_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = pro_tool_records.project_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM projects WHERE id = pro_tool_records.project_id AND created_by = auth.uid())
);

CREATE POLICY "pro_tool_records_insert" ON pro_tool_records FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = pro_tool_records.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
  EXISTS (SELECT 1 FROM projects WHERE id = pro_tool_records.project_id AND created_by = auth.uid())
);

CREATE POLICY "pro_tool_records_update" ON pro_tool_records FOR UPDATE USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = pro_tool_records.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
  EXISTS (SELECT 1 FROM projects WHERE id = pro_tool_records.project_id AND created_by = auth.uid())
);

CREATE POLICY "pro_tool_records_delete" ON pro_tool_records FOR DELETE USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = pro_tool_records.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
  EXISTS (SELECT 1 FROM projects WHERE id = pro_tool_records.project_id AND created_by = auth.uid())
);

-- 2. Remove the Studio tier from profiles. Nothing ever wrote these.
ALTER TABLE profiles DROP COLUMN IF EXISTS is_studio;
ALTER TABLE profiles DROP COLUMN IF EXISTS studio_since;

-- 3. Replace the studio_* feature flags with their pro_* equivalents.
DELETE FROM feature_flags WHERE key LIKE 'studio\_%';

INSERT INTO feature_flags (key, name, description, tier, category) VALUES
  ('pro_portfolio',            'Portfolio',              'Every title on the slate in one view',            'released', 'production'),
  ('pro_accounting',           'Production Accounting',  'Purchase orders, invoices and cost report lines', 'released', 'production'),
  ('pro_greenlight',           'Greenlight & Financing', 'Financing sources from pitch to committed',       'released', 'production'),
  ('pro_tax_incentives',       'Tax Incentives',         'Rebates, credits and their paperwork',            'released', 'production'),
  ('pro_crowdfunding',         'Crowdfunding',           'Tiers, backers and reward fulfilment',            'released', 'production'),
  ('pro_box_office',           'Box Office & Revenue',   'Revenue by window, territory and platform',       'released', 'production'),
  ('pro_rights',               'Rights & Clearances',    'Clearance tracking through to picture lock',      'released', 'production'),
  ('pro_legal',                'Legal & Contracts',      'Agreements, signatures and expiry dates',         'released', 'production'),
  ('pro_compliance',           'Insurance & Compliance', 'Certificates, policies and risk sign-off',        'released', 'production'),
  ('pro_broadcast_compliance', 'Broadcast Compliance',   'Delivery specs and classification checks',        'released', 'production'),
  ('pro_sustainability',       'Sustainability',         'Carbon actions and green-stamp reporting',        'released', 'production'),
  ('pro_crew_portal',          'Crew Portal',            'Crew onboarding, paperwork and start dates',      'released', 'production'),
  ('pro_departments',          'Departments',            'Heads of department, budgets and headcount',      'released', 'production'),
  ('pro_talent_mgmt',          'Talent Management',      'Offers, agents, deals and availability',          'released', 'production'),
  ('pro_extras',               'Extras & Background',    'Background casting calls and call times',         'released', 'production'),
  ('pro_travel',               'Travel & Accommodation', 'Flights, hotels and ground transport',            'released', 'production'),
  ('pro_catering',             'Catering & Craft',       'Meals, headcounts and dietary requirements',      'released', 'production'),
  ('pro_location_scouting',    'Location Scouting',      'Recces, permits and location fees',               'released', 'production'),
  ('pro_vendor_mgmt',          'Vendor Management',      'Suppliers, contacts, terms and spend',            'released', 'production'),
  ('pro_equipment',            'Equipment Rentals',      'Kit out, kit back and daily rates',               'released', 'production'),
  ('pro_stunts_safety',        'Stunts & Safety',        'Risk assessments and stunt sign-off',             'released', 'production'),
  ('pro_script_supervising',   'Script Supervising',     'Continuity notes, takes and coverage',            'released', 'production'),
  ('pro_post_production',      'Post-Production',        'The post schedule from ingest to delivery',       'released', 'production'),
  ('pro_vfx_tracking',         'VFX Tracking',           'Shot-level VFX status, vendor and version',       'released', 'production'),
  ('pro_music_sound',          'Music & Sound',          'Cue sheet, licences and sound deliverables',      'released', 'production'),
  ('pro_multilang',            'Localisation',           'Subtitles, dubs and territory versions',          'released', 'production'),
  ('pro_distribution',         'Distribution Pipeline',  'Sales agents, platforms and windows',             'released', 'production'),
  ('pro_archival',             'Archival',               'Masters, LTO sets and element locations',         'released', 'production'),
  ('pro_wrap',                 'Wrap & Completion',      'Returns, reports and final payments',             'released', 'production'),
  ('pro_festival',             'Festival Strategy',      'Deadlines, fees and acceptances',                 'released', 'production'),
  ('pro_marketing',            'Marketing & PR',         'Campaign beats, assets and coverage',             'released', 'production'),
  ('pro_newsletter',           'Production Newsletter',  'Issues for cast, crew, investors and backers',    'released', 'production'),
  ('pro_dailies',              'Dailies',                'What was shot, seen and approved',                'released', 'production'),
  ('pro_deliverables',         'Delivery Checklist',     'Everything the distributor asks for',             'released', 'production'),
  ('pro_unions',               'Unions & Guilds',        'Signatory status, minimums and filings',          'released', 'production'),
  ('pro_residuals',            'Residuals & Royalties',  'Who is owed what once the film earns',            'released', 'production'),
  ('pro_screenings',           'Test Screenings',        'Audience reaction, scores and cut changes',       'released', 'production')
ON CONFLICT (key) DO NOTHING;

COMMIT;
