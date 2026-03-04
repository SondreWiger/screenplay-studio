-- Migration: Script Annotations
-- Adds line_ref column to community_comments and enables 'annotation' comment type.
-- Run this in the Supabase SQL editor.

-- 1. Add line_ref column (stores element index for structured scripts, paragraph index for plaintext)
ALTER TABLE community_comments
  ADD COLUMN IF NOT EXISTS line_ref TEXT DEFAULT NULL;

COMMENT ON COLUMN community_comments.line_ref IS
  'For annotations: the element/paragraph index the annotation is attached to (as string). NULL for regular comments and suggestions.';

-- 2. Drop existing check constraint on comment_type (if any) and recreate including annotation
DO $$
BEGIN
  -- Drop constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_comments_comment_type_check'
  ) THEN
    ALTER TABLE community_comments
      DROP CONSTRAINT community_comments_comment_type_check;
  END IF;
END $$;

-- Recreate with annotation allowed
ALTER TABLE community_comments
  ADD CONSTRAINT community_comments_comment_type_check
  CHECK (comment_type IN ('comment', 'suggestion', 'annotation'));

-- 3. Index for fast annotation lookups per post
CREATE INDEX IF NOT EXISTS idx_community_comments_annotations
  ON community_comments (post_id, comment_type, line_ref)
  WHERE comment_type = 'annotation';

-- 4. RLS: annotations follow the same policy as comments (already covered by existing post_id-based policies).
-- No additional RLS needed if existing policies cover all rows in community_comments.
