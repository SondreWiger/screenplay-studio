-- ============================================================
-- MIGRATION: Community File Upload Support
-- ============================================================
-- Adds attached_file_url / attached_file_type columns to
-- community_posts so users can attach .fdx, .fountain, .txt
-- or .pdf files when sharing a script.
--
-- Also creates the 'community-files' Supabase Storage bucket.
-- ============================================================

-- ── 1. New columns on community_posts ───────────────────────
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS attached_file_url  text,
  ADD COLUMN IF NOT EXISTS attached_file_type text;  -- 'pdf' | 'fdx' | 'fountain' | 'txt'

-- ── 2. Storage bucket ────────────────────────────────────────
-- Create the bucket (idempotent via WHERE NOT EXISTS)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'community-files',
  'community-files',
  true,
  52428800,   -- 50 MB max per file
  ARRAY[
    'application/pdf',
    'text/plain',
    'application/xml',
    'text/xml',
    'application/octet-stream',  -- .fdx files are often served with this mime
    'text/fountain'
  ]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'community-files'
);

-- ── 3. Storage RLS policies ───────────────────────────────────
-- Public read (files are shared content)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Community files are publicly readable'
  ) THEN
    CREATE POLICY "Community files are publicly readable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'community-files');
  END IF;
END $$;

-- Authenticated users can upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Authenticated users can upload community files'
  ) THEN
    CREATE POLICY "Authenticated users can upload community files"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'community-files'
        AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;

-- Users can delete their own uploads (path = userId/filename)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Users can delete own community files'
  ) THEN
    CREATE POLICY "Users can delete own community files"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'community-files'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
