CREATE TYPE world_entity_category AS ENUM (
  'lore', 'faction', 'location', 'magic', 'species', 'item', 'event', 'character', 'other'
);

CREATE TABLE world_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category world_entity_category DEFAULT 'other',
  content TEXT DEFAULT '',
  properties JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}'::text[],
  avatar_url TEXT,
  color TEXT DEFAULT '#6366f1',
  parent_id UUID REFERENCES world_entities(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE world_entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES world_entities(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES world_entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, relationship_type)
);

ALTER TABLE world_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_entity_relationships ENABLE ROW LEVEL SECURITY;

-- Project Members Policy for world_entities
CREATE POLICY "world_entities_select" ON world_entities FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = world_entities.project_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM projects WHERE id = world_entities.project_id AND created_by = auth.uid())
);

CREATE POLICY "world_entities_insert" ON world_entities FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = world_entities.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
  EXISTS (SELECT 1 FROM projects WHERE id = world_entities.project_id AND created_by = auth.uid())
);

CREATE POLICY "world_entities_update" ON world_entities FOR UPDATE USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = world_entities.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
  EXISTS (SELECT 1 FROM projects WHERE id = world_entities.project_id AND created_by = auth.uid())
);

CREATE POLICY "world_entities_delete" ON world_entities FOR DELETE USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = world_entities.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
  EXISTS (SELECT 1 FROM projects WHERE id = world_entities.project_id AND created_by = auth.uid())
);

-- Project Members Policy for world_entity_relationships
CREATE POLICY "world_entity_relationships_select" ON world_entity_relationships FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = world_entity_relationships.project_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM projects WHERE id = world_entity_relationships.project_id AND created_by = auth.uid())
);

CREATE POLICY "world_entity_relationships_insert" ON world_entity_relationships FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = world_entity_relationships.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
  EXISTS (SELECT 1 FROM projects WHERE id = world_entity_relationships.project_id AND created_by = auth.uid())
);

CREATE POLICY "world_entity_relationships_update" ON world_entity_relationships FOR UPDATE USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = world_entity_relationships.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
  EXISTS (SELECT 1 FROM projects WHERE id = world_entity_relationships.project_id AND created_by = auth.uid())
);

CREATE POLICY "world_entity_relationships_delete" ON world_entity_relationships FOR DELETE USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = world_entity_relationships.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
  EXISTS (SELECT 1 FROM projects WHERE id = world_entity_relationships.project_id AND created_by = auth.uid())
);
