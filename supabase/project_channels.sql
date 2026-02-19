-- Project Channels & Channel Messages
-- Run this in the Supabase SQL Editor.

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS project_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS channel_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES project_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  file_url TEXT,
  file_name TEXT,
  reply_to_id UUID REFERENCES channel_messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECURITY DEFINER HELPERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_project_member_lite(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND created_by = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_project_admin_lite(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND created_by = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Channels
CREATE POLICY "Members can view channels" ON project_channels
  FOR SELECT USING (public.is_project_member_lite(project_id));

CREATE POLICY "Admins can create channels" ON project_channels
  FOR INSERT WITH CHECK (public.is_project_admin_lite(project_id));

CREATE POLICY "Admins can update channels" ON project_channels
  FOR UPDATE USING (public.is_project_admin_lite(project_id));

CREATE POLICY "Admins can delete channels" ON project_channels
  FOR DELETE USING (public.is_project_admin_lite(project_id));

-- Channel messages
CREATE POLICY "Members can view channel messages" ON channel_messages
  FOR SELECT USING (
    channel_id IN (
      SELECT id FROM project_channels WHERE public.is_project_member_lite(project_id)
    )
  );

CREATE POLICY "Members can send channel messages" ON channel_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    channel_id IN (
      SELECT id FROM project_channels WHERE public.is_project_member_lite(project_id)
    )
  );

CREATE POLICY "Senders can edit channel messages" ON channel_messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Senders can delete channel messages" ON channel_messages
  FOR DELETE USING (sender_id = auth.uid());

-- ============================================================
-- GRANTS & REALTIME
-- ============================================================

GRANT ALL ON project_channels TO authenticated, anon, service_role;
GRANT ALL ON channel_messages TO authenticated, anon, service_role;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE channel_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_channel_project ON project_channels(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_channel_msgs ON channel_messages(channel_id, created_at DESC);
