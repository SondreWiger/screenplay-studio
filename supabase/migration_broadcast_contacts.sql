-- Migration: broadcast_contacts table
-- Editorial contacts / source rolodex for TV production projects
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS broadcast_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  organisation TEXT,
  phone TEXT,
  email TEXT,
  category TEXT NOT NULL DEFAULT 'expert'
    CHECK (category IN ('expert','official','spokesperson','witness','reporter','photographer','producer','fixer','tipster','other')),
  relationship TEXT NOT NULL DEFAULT 'cold'
    CHECK (relationship IN ('cold','warm','trusted')),
  topic_area TEXT,
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcast_contacts_project ON broadcast_contacts(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_contacts_category ON broadcast_contacts(project_id, category);
CREATE INDEX IF NOT EXISTS idx_broadcast_contacts_relationship ON broadcast_contacts(project_id, relationship);

-- RLS
ALTER TABLE broadcast_contacts ENABLE ROW LEVEL SECURITY;

-- Members of the project can read
CREATE POLICY "broadcast_contacts_select" ON broadcast_contacts
  FOR SELECT USING (is_broadcast_member(project_id));

-- Members can insert
CREATE POLICY "broadcast_contacts_insert" ON broadcast_contacts
  FOR INSERT WITH CHECK (is_broadcast_member(project_id));

-- Members can update
CREATE POLICY "broadcast_contacts_update" ON broadcast_contacts
  FOR UPDATE USING (is_broadcast_member(project_id));

-- Members can delete
CREATE POLICY "broadcast_contacts_delete" ON broadcast_contacts
  FOR DELETE USING (is_broadcast_member(project_id));

-- updated_at trigger
CREATE TRIGGER broadcast_contacts_updated_at
  BEFORE UPDATE ON broadcast_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
