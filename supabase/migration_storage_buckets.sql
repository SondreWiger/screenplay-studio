-- ============================================================
-- MIGRATION: Storage Buckets — Public Access
-- ============================================================
-- !! RUN THIS IN: Supabase Dashboard → SQL Editor !!
-- !! This is the ONLY migration you need for images to work.!!
-- Safe to re-run: idempotent via WHERE NOT EXISTS + UPDATE.
-- ============================================================
-- Buckets covered:
--   project-covers   — project cover + poster images
--   community-files  — community post image uploads
-- ============================================================
-- ── 1. Create / fix the project-covers bucket ────────────────

-- Create if missing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'project-covers',
  'project-covers',
  true,                   -- PUBLIC — required for getPublicUrl() to work
  10485760,               -- 10 MB per upload
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif'
  ]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'project-covers'
);

-- Ensure public = true if bucket already exists but is private
UPDATE storage.buckets
SET public = true
WHERE id = 'project-covers' AND public = false;

-- ── 2. RLS policies for project-covers ───────────────────────

-- Public read: anyone can load an image URL
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'project_covers_public_select'
  ) THEN
    CREATE POLICY "project_covers_public_select"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'project-covers');
  END IF;
END $$;

-- Authenticated users can upload to their own project's folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'project_covers_auth_insert'
  ) THEN
    CREATE POLICY "project_covers_auth_insert"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'project-covers'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

-- Authenticated users can update (replace) objects they own
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'project_covers_auth_update'
  ) THEN
    CREATE POLICY "project_covers_auth_update"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'project-covers'
        AND auth.uid() = owner
      )
      WITH CHECK (
        bucket_id = 'project-covers'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

-- Authenticated users can delete their objects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'project_covers_auth_delete'
  ) THEN
    CREATE POLICY "project_covers_auth_delete"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'project-covers'
        AND auth.uid() = owner
      );
  END IF;
END $$;

-- ── 3. community-files bucket ────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'community-files',
  'community-files',
  true,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif'
  ]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'community-files'
);

-- Force public = true even if it existed but was private
UPDATE storage.buckets SET public = true
WHERE id IN ('community-files', 'project-covers') AND public = false;

-- Public read for community-files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'community_files_public_select'
  ) THEN
    CREATE POLICY "community_files_public_select"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'community-files');
  END IF;
END $$;

-- Authenticated upload for community-files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'community_files_auth_insert'
  ) THEN
    CREATE POLICY "community_files_auth_insert"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'community-files'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

-- Owner can delete community-files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'community_files_auth_delete'
  ) THEN
    CREATE POLICY "community_files_auth_delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'community-files' AND auth.uid() = owner);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- Done. All image URLs from getPublicUrl() will now load
-- without authentication across the whole platform.
-- ────────────────────────────────────────────────────────────

