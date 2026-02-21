-- ============================================================
-- Project Documents & Folders
-- Adds support for plain text documents alongside screenplay scripts,
-- organized in folders within a project.
-- ============================================================

-- Document Folders
CREATE TABLE IF NOT EXISTS project_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES project_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documents (plain text docs, notes, etc.)
CREATE TABLE IF NOT EXISTS project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES project_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  doc_type TEXT NOT NULL DEFAULT 'plain_text' CHECK (doc_type IN ('plain_text', 'notes', 'outline', 'treatment', 'research')),
  content TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_edited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_folders_project ON project_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_folders_parent ON project_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_project ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_folder ON project_documents(folder_id);

-- RLS policies
ALTER TABLE project_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

-- Folders: project members can read, editors+ can write
CREATE POLICY "folders_select" ON project_folders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_folders.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "folders_insert" ON project_folders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_folders.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'writer', 'editor')
    )
  );

CREATE POLICY "folders_update" ON project_folders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_folders.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'writer', 'editor')
    )
  );

CREATE POLICY "folders_delete" ON project_folders
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_folders.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Documents: same pattern
CREATE POLICY "docs_select" ON project_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_documents.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "docs_insert" ON project_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_documents.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'writer', 'editor')
    )
  );

CREATE POLICY "docs_update" ON project_documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_documents.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'writer', 'editor')
    )
  );

CREATE POLICY "docs_delete" ON project_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_documents.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_folders_updated_at ON project_folders;
CREATE TRIGGER update_project_folders_updated_at
  BEFORE UPDATE ON project_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_documents_updated_at ON project_documents;
CREATE TRIGGER update_project_documents_updated_at
  BEFORE UPDATE ON project_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-compute word count on update
CREATE OR REPLACE FUNCTION compute_document_word_count()
RETURNS TRIGGER AS $$
BEGIN
  NEW.word_count = array_length(regexp_split_to_array(trim(coalesce(NEW.content, '')), '\s+'), 1);
  IF NEW.content IS NULL OR trim(NEW.content) = '' THEN
    NEW.word_count = 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS compute_doc_word_count ON project_documents;
CREATE TRIGGER compute_doc_word_count
  BEFORE INSERT OR UPDATE OF content ON project_documents
  FOR EACH ROW EXECUTE FUNCTION compute_document_word_count();
