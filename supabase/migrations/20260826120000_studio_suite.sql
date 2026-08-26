-- Studio suite — shared record store for the Studio-tier production tools.
--
-- Every Studio tool (see src/lib/studio/tools.ts) stores its rows here,
-- discriminated by `tool`. Tool-specific fields live in `data` as described
-- by that tool's field definitions, so adding a tool needs no migration.

CREATE TABLE IF NOT EXISTS studio_records (
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

CREATE INDEX IF NOT EXISTS studio_records_project_tool_idx
  ON studio_records (project_id, tool, sort_order);
CREATE INDEX IF NOT EXISTS studio_records_data_idx
  ON studio_records USING GIN (data);

ALTER TABLE studio_records ENABLE ROW LEVEL SECURITY;

-- Same access model as the other project-scoped tables: members can read,
-- editing roles can write, and the project owner always can.
DROP POLICY IF EXISTS "studio_records_select" ON studio_records;
CREATE POLICY "studio_records_select" ON studio_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = studio_records.project_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM projects WHERE id = studio_records.project_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "studio_records_insert" ON studio_records;
CREATE POLICY "studio_records_insert" ON studio_records FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = studio_records.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
  EXISTS (SELECT 1 FROM projects WHERE id = studio_records.project_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "studio_records_update" ON studio_records;
CREATE POLICY "studio_records_update" ON studio_records FOR UPDATE USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = studio_records.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
  EXISTS (SELECT 1 FROM projects WHERE id = studio_records.project_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "studio_records_delete" ON studio_records;
CREATE POLICY "studio_records_delete" ON studio_records FOR DELETE USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = studio_records.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
  EXISTS (SELECT 1 FROM projects WHERE id = studio_records.project_id AND created_by = auth.uid())
);

-- Feature flags for each Studio tool. `canAccess` grants Studio subscribers
-- everything, so these exist so the admin feature dashboard can list them.
INSERT INTO feature_flags (key, name, description, tier, category) VALUES
  ('studio_portfolio',            'Portfolio',              'Every title on the slate in one view',            'released', 'production'),
  ('studio_accounting',           'Production Accounting',  'Purchase orders, invoices and cost report lines', 'released', 'production'),
  ('studio_greenlight',           'Greenlight & Financing', 'Financing sources from pitch to committed',       'released', 'production'),
  ('studio_tax_incentives',       'Tax Incentives',         'Rebates, credits and their paperwork',            'released', 'production'),
  ('studio_crowdfunding',         'Crowdfunding',           'Tiers, backers and reward fulfilment',            'released', 'production'),
  ('studio_box_office',           'Box Office & Revenue',   'Revenue by window, territory and platform',       'released', 'production'),
  ('studio_rights',               'Rights & Clearances',    'Clearance tracking through to picture lock',      'released', 'production'),
  ('studio_legal',                'Legal & Contracts',      'Agreements, signatures and expiry dates',         'released', 'production'),
  ('studio_compliance',           'Insurance & Compliance', 'Certificates, policies and risk sign-off',        'released', 'production'),
  ('studio_broadcast_compliance', 'Broadcast Compliance',   'Delivery specs and classification checks',        'released', 'production'),
  ('studio_sustainability',       'Sustainability',         'Carbon actions and green-stamp reporting',        'released', 'production'),
  ('studio_crew_portal',          'Crew Portal',            'Crew onboarding, paperwork and start dates',      'released', 'production'),
  ('studio_departments',          'Departments',            'Heads of department, budgets and headcount',      'released', 'production'),
  ('studio_talent_mgmt',          'Talent Management',      'Offers, agents, deals and availability',          'released', 'production'),
  ('studio_extras',               'Extras & Background',    'Background casting calls and call times',         'released', 'production'),
  ('studio_travel',               'Travel & Accommodation', 'Flights, hotels and ground transport',            'released', 'production'),
  ('studio_catering',             'Catering & Craft',       'Meals, headcounts and dietary requirements',      'released', 'production'),
  ('studio_location_scouting',    'Location Scouting',      'Recces, permits and location fees',               'released', 'production'),
  ('studio_vendor_mgmt',          'Vendor Management',      'Suppliers, contacts, terms and spend',            'released', 'production'),
  ('studio_equipment',            'Equipment Rentals',      'Kit out, kit back and daily rates',               'released', 'production'),
  ('studio_stunts_safety',        'Stunts & Safety',        'Risk assessments and stunt sign-off',             'released', 'production'),
  ('studio_script_supervising',   'Script Supervising',     'Continuity notes, takes and coverage',            'released', 'production'),
  ('studio_post_production',      'Post-Production',        'The post schedule from ingest to delivery',       'released', 'production'),
  ('studio_vfx_tracking',         'VFX Tracking',           'Shot-level VFX status, vendor and version',       'released', 'production'),
  ('studio_music_sound',          'Music & Sound',          'Cue sheet, licences and sound deliverables',      'released', 'production'),
  ('studio_multilang',            'Localisation',           'Subtitles, dubs and territory versions',          'released', 'production'),
  ('studio_distribution',         'Distribution Pipeline',  'Sales agents, platforms and windows',             'released', 'production'),
  ('studio_archival',             'Archival',               'Masters, LTO sets and element locations',         'released', 'production'),
  ('studio_wrap',                 'Wrap & Completion',      'Returns, reports and final payments',             'released', 'production'),
  ('studio_festival',             'Festival Strategy',      'Deadlines, fees and acceptances',                 'released', 'production'),
  ('studio_marketing',            'Marketing & PR',         'Campaign beats, assets and coverage',             'released', 'production'),
  ('studio_newsletter',           'Production Newsletter',  'Issues for cast, crew, investors and backers',    'released', 'production')
ON CONFLICT (key) DO NOTHING;
