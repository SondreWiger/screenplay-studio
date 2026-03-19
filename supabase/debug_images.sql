-- ============================================================
-- IMAGE DEBUG — run in Supabase SQL Editor
-- Paste ALL of this, run it, and share the output
-- ============================================================

-- 1. What buckets exist and their public status?
SELECT id, name, public, file_size_limit
FROM storage.buckets
ORDER BY id;

-- 2. What policies exist on storage.objects?
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- 3. What URL format is stored in cover_url?
-- Shows first 120 chars + what type of URL it is
SELECT
  id,
  title,
  LEFT(cover_url, 120) AS cover_url_preview,
  CASE
    WHEN cover_url IS NULL      THEN 'NULL'
    WHEN cover_url LIKE 'data:%' THEN 'data: base64 (stored locally)'
    WHEN cover_url LIKE 'https://%.supabase.co/storage%' THEN 'Supabase Storage URL'
    WHEN cover_url LIKE 'blob:%'  THEN 'blob: URL (will not persist!)'
    ELSE 'External URL'
  END AS url_type
FROM projects
WHERE cover_url IS NOT NULL
LIMIT 20;

-- 4. Do the files actually exist in the project-covers bucket?
SELECT name, bucket_id, created_at, (metadata->>'size')::int AS size_bytes
FROM storage.objects
WHERE bucket_id = 'project-covers'
ORDER BY created_at DESC
LIMIT 20;
