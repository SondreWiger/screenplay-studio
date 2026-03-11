-- ============================================================
-- MIGRATION: project-covers Storage Bucket
-- ============================================================
-- Creates the 'project-covers' Supabase Storage bucket used for:
--   • Project cover images   (PROJECT_ID/cover.ext)
--   • Title page logos       (PROJECT_ID/tp-project_logo_url.ext)
--   • Production co. logos   (PROJECT_ID/tp-company_logo_url.ext)
-- ============================================================

-- ── 1. Create bucket (idempotent) ────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'project-covers',
  'project-covers',
  true,
  5242880,   -- 5 MB max per file
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml'
  ]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'project-covers'
);

-- ── 2. Public read (URLs are embedded in exports / PDFs) ─────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Project covers are publicly readable'
  ) THEN
    CREATE POLICY "Project covers are publicly readable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'project-covers');
  END IF;
END $$;

-- ── 3. Project members can upload / overwrite ────────────────
-- Path must start with a project ID that the user is a member of.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Project members can upload covers'
  ) THEN
    CREATE POLICY "Project members can upload covers"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'project-covers'
        AND auth.uid() IS NOT NULL
        AND (
          -- folder name (first segment of path) must be a project the user owns or is a member of
          EXISTS (
            SELECT 1 FROM projects
            WHERE id::text = (storage.foldername(name))[1]
              AND created_by = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id::text = (storage.foldername(name))[1]
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin', 'writer', 'editor')
          )
        )
      );
  END IF;
END $$;

-- ── 4. Same check for UPDATE (upsert uses UPDATE internally) ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Project members can update covers'
  ) THEN
    CREATE POLICY "Project members can update covers"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'project-covers'
        AND auth.uid() IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM projects
            WHERE id::text = (storage.foldername(name))[1]
              AND created_by = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id::text = (storage.foldername(name))[1]
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin', 'writer', 'editor')
          )
        )
      );
  END IF;
END $$;

-- ── 5. Project owners / admins can delete ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Project owners can delete covers'
  ) THEN
    CREATE POLICY "Project owners can delete covers"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'project-covers'
        AND auth.uid() IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM projects
            WHERE id::text = (storage.foldername(name))[1]
              AND created_by = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id::text = (storage.foldername(name))[1]
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin')
          )
        )
      );
  END IF;
END $$;
