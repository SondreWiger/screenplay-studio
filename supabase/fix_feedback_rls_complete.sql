-- Comprehensive fix for "row violates RLS" on feedback_items insert.
-- Safe to run multiple times. Covers missing policies AND missing grants.

-- 1. Make sure RLS is on
ALTER TABLE feedback_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_votes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;

-- 2. Nuke and recreate every policy on feedback_items
DROP POLICY IF EXISTS "feedback_items_select_public"  ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_insert"         ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_update_own"     ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_admin"          ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_update_admin"   ON feedback_items;

-- Anyone (anon or authenticated) can read public items
CREATE POLICY "feedback_items_select_public" ON feedback_items
  FOR SELECT USING (
    is_public = true
    OR user_id = auth.uid()
    OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
  );

-- Anyone can INSERT — no conditions at all
CREATE POLICY "feedback_items_insert" ON feedback_items
  FOR INSERT WITH CHECK (true);

-- Owner or admin can update
CREATE POLICY "feedback_items_update_own" ON feedback_items
  FOR UPDATE USING (
    user_id = auth.uid()
    OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
  );

-- Admin can delete
CREATE POLICY "feedback_items_admin" ON feedback_items
  FOR DELETE USING (
    auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
  );

-- 3. Nuke and recreate feedback_votes policies
DROP POLICY IF EXISTS "feedback_votes_select" ON feedback_votes;
DROP POLICY IF EXISTS "feedback_votes_insert" ON feedback_votes;
DROP POLICY IF EXISTS "feedback_votes_delete" ON feedback_votes;

CREATE POLICY "feedback_votes_select" ON feedback_votes FOR SELECT USING (true);
CREATE POLICY "feedback_votes_insert" ON feedback_votes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND fingerprint IS NOT NULL)
  );
CREATE POLICY "feedback_votes_delete" ON feedback_votes FOR DELETE
  USING (
    user_id = auth.uid()
    OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
  );

-- 4. Nuke and recreate feedback_comments policies
DROP POLICY IF EXISTS "feedback_comments_select" ON feedback_comments;
DROP POLICY IF EXISTS "feedback_comments_insert" ON feedback_comments;
DROP POLICY IF EXISTS "feedback_comments_delete" ON feedback_comments;

CREATE POLICY "feedback_comments_select" ON feedback_comments FOR SELECT
  USING (is_public = true OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

CREATE POLICY "feedback_comments_insert" ON feedback_comments FOR INSERT
  WITH CHECK (
    auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
    OR (
      auth.uid() IS NOT NULL
      AND auth.uid() = author_id
      AND comment_type = 'note'
      AND is_public = true
      AND (SELECT type FROM feedback_items WHERE id = item_id) <> 'testimonial'
    )
  );

CREATE POLICY "feedback_comments_delete" ON feedback_comments FOR DELETE
  USING (
    author_id = auth.uid()
    OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
  );

-- 5. Table-level grants (required as well as RLS policies)
GRANT SELECT, INSERT         ON feedback_items         TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON feedback_votes         TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON feedback_comments      TO anon, authenticated;
GRANT SELECT                 ON feedback_similar_links TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON feedback_subscriptions TO anon, authenticated;
GRANT SELECT                 ON public_testimonials    TO anon, authenticated;
GRANT SELECT                 ON public_roadmap         TO anon, authenticated;
