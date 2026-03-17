-- ═══════════════════════════════════════════════════════════════════════════
--  FEEDBACK SYSTEM — Full migration
--  Covers: bug reports, feature requests, testimonials, votes, admin timeline,
--          duplicate linking, category tags, and subscriptions.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Core tables ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                 TEXT NOT NULL CHECK (type IN ('bug_report','feature_request','testimonial','other')),
  title                TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 200),
  body                 TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 5000),
  status               TEXT NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','in_progress','planned','resolved','wont_fix','intended','duplicate','pending_review')),
  priority             TEXT NOT NULL DEFAULT 'medium'
                         CHECK (priority IN ('low','medium','high','critical')),
  -- author info (may be anonymous)
  user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name          TEXT,
  author_email         TEXT,
  -- bug-specific
  steps_to_reproduce   TEXT,
  expected_behavior    TEXT,
  actual_behavior      TEXT,
  error_message        TEXT,
  url_where_occurred   TEXT,
  browser_info         JSONB,            -- { ua, platform, lang, viewport }
  -- feature-specific
  use_case             TEXT,
  -- testimonial-specific
  rating               INT CHECK (rating BETWEEN 1 AND 5),
  is_approved          BOOLEAN NOT NULL DEFAULT false,
  show_author_name     BOOLEAN NOT NULL DEFAULT true,
  -- metadata
  vote_count           INT NOT NULL DEFAULT 0,
  comment_count        INT NOT NULL DEFAULT 0,
  is_public            BOOLEAN NOT NULL DEFAULT true,
  admin_note           TEXT,             -- internal sticky note
  linked_changelog_id  UUID,             -- link to changelog_releases when resolved
  tags                 TEXT[] DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint  TEXT,                    -- fallback for anon users (browser fp)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_vote_user       UNIQUE NULLS NOT DISTINCT (item_id, user_id),
  CONSTRAINT uq_vote_fingerprint UNIQUE NULLS NOT DISTINCT (item_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS feedback_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  comment_type  TEXT NOT NULL DEFAULT 'note'
                  CHECK (comment_type IN ('note','status_change','resolution','question','update','duplicate_link')),
  is_public     BOOLEAN NOT NULL DEFAULT true,
  metadata      JSONB,                  -- { from_status, to_status, linked_item_id, ... }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_similar_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  similar_item_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  strength        FLOAT DEFAULT 0.5,   -- 0–1 similarity score
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, similar_item_id)
);

CREATE TABLE IF NOT EXISTS feedback_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_feedback_items_type      ON feedback_items(type);
CREATE INDEX IF NOT EXISTS idx_feedback_items_status    ON feedback_items(status);
CREATE INDEX IF NOT EXISTS idx_feedback_items_user      ON feedback_items(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_items_votes     ON feedback_items(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_items_created   ON feedback_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_items_approved  ON feedback_items(is_approved) WHERE type = 'testimonial';
CREATE INDEX IF NOT EXISTS idx_feedback_comments_item   ON feedback_comments(item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_item      ON feedback_votes(item_id);

-- Full-text search index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_feedback_items_fts ON feedback_items
  USING GIN (to_tsvector('english', title || ' ' || body));

-- ── 3. Counters: keep vote_count + comment_count denormalised for cheap reads ─

CREATE OR REPLACE FUNCTION feedback_update_vote_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feedback_items SET vote_count = vote_count + 1, updated_at = now() WHERE id = NEW.item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feedback_items SET vote_count = GREATEST(0, vote_count - 1), updated_at = now() WHERE id = OLD.item_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_vote_count ON feedback_votes;
CREATE TRIGGER trg_feedback_vote_count
  AFTER INSERT OR DELETE ON feedback_votes
  FOR EACH ROW EXECUTE FUNCTION feedback_update_vote_count();

CREATE OR REPLACE FUNCTION feedback_update_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feedback_items SET comment_count = comment_count + 1, updated_at = now() WHERE id = NEW.item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feedback_items SET comment_count = GREATEST(0, comment_count - 1), updated_at = now() WHERE id = OLD.item_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_comment_count ON feedback_comments;
CREATE TRIGGER trg_feedback_comment_count
  AFTER INSERT OR DELETE ON feedback_comments
  FOR EACH ROW EXECUTE FUNCTION feedback_update_comment_count();

-- ── 4. Auto-updated_at trigger ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_items_updated_at ON feedback_items;
CREATE TRIGGER trg_feedback_items_updated_at
  BEFORE UPDATE ON feedback_items
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── 5. Similarity search function (used for duplicate detection) ───────────────

CREATE OR REPLACE FUNCTION find_similar_feedback(
  p_title TEXT,
  p_body  TEXT,
  p_type  TEXT DEFAULT NULL,
  p_limit INT  DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  title      TEXT,
  type       TEXT,
  status     TEXT,
  vote_count INT,
  similarity FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    fi.id,
    fi.title,
    fi.type,
    fi.status,
    fi.vote_count,
    ts_rank(
      to_tsvector('english', fi.title || ' ' || fi.body),
      plainto_tsquery('english', p_title || ' ' || p_body)
    )::FLOAT AS similarity
  FROM feedback_items fi
  WHERE
    fi.is_public = true
    AND fi.status NOT IN ('wont_fix','duplicate')
    AND (p_type IS NULL OR fi.type = p_type)
    AND to_tsvector('english', fi.title || ' ' || fi.body)
        @@ plainto_tsquery('english', p_title || ' ' || p_body)
  ORDER BY similarity DESC
  LIMIT p_limit;
$$;

-- ── 6. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE feedback_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_votes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_similar_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_subscriptions   ENABLE ROW LEVEL SECURITY;

-- feedback_items
DROP POLICY IF EXISTS "feedback_items_select_public"  ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_insert"         ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_update_own"     ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_admin"          ON feedback_items;

CREATE POLICY "feedback_items_select_public" ON feedback_items FOR SELECT
  USING (is_public = true OR user_id = auth.uid()
         OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

CREATE POLICY "feedback_items_insert" ON feedback_items FOR INSERT
  WITH CHECK (true);   -- anyone (anon or authed) may submit

CREATE POLICY "feedback_items_update_own" ON feedback_items FOR UPDATE
  USING (user_id = auth.uid() OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

-- feedback_votes
DROP POLICY IF EXISTS "feedback_votes_select"  ON feedback_votes;
DROP POLICY IF EXISTS "feedback_votes_insert"  ON feedback_votes;
DROP POLICY IF EXISTS "feedback_votes_delete"  ON feedback_votes;

CREATE POLICY "feedback_votes_select" ON feedback_votes FOR SELECT USING (true);

CREATE POLICY "feedback_votes_insert" ON feedback_votes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND fingerprint IS NOT NULL)
  );

CREATE POLICY "feedback_votes_delete" ON feedback_votes FOR DELETE
  USING (user_id = auth.uid() OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

-- feedback_comments
DROP POLICY IF EXISTS "feedback_comments_select"  ON feedback_comments;
DROP POLICY IF EXISTS "feedback_comments_insert"  ON feedback_comments;
DROP POLICY IF EXISTS "feedback_comments_delete"  ON feedback_comments;

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
      -- only allow user comments on non-testimonial items
      AND (SELECT type FROM feedback_items WHERE id = item_id) <> 'testimonial'
    )
  );

CREATE POLICY "feedback_comments_delete" ON feedback_comments FOR DELETE
  USING (author_id = auth.uid() OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

-- feedback_similar_links
DROP POLICY IF EXISTS "fsl_select" ON feedback_similar_links;
DROP POLICY IF EXISTS "fsl_admin"  ON feedback_similar_links;

CREATE POLICY "fsl_select" ON feedback_similar_links FOR SELECT USING (true);
CREATE POLICY "fsl_admin"  ON feedback_similar_links FOR ALL
  USING (auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77')
  WITH CHECK (auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

-- feedback_subscriptions
DROP POLICY IF EXISTS "fsub_own" ON feedback_subscriptions;
CREATE POLICY "fsub_own" ON feedback_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 7. Convenience view: public_testimonials ──────────────────────────────────

DROP VIEW IF EXISTS public_testimonials;
CREATE VIEW public_testimonials AS
  SELECT
    id, title, body, rating, show_author_name,
    CASE WHEN show_author_name THEN author_name ELSE 'Anonymous' END AS display_name,
    vote_count, comment_count,
    created_at
  FROM feedback_items
  WHERE type = 'testimonial' AND is_approved = true AND is_public = true
  ORDER BY rating DESC, created_at DESC;

GRANT SELECT ON public_testimonials TO anon, authenticated;

-- ── 8. Convenience view: public_roadmap ───────────────────────────────────────

CREATE OR REPLACE VIEW public_roadmap AS
  SELECT
    id, type, title, body, status, priority,
    vote_count, comment_count, tags,
    created_at, updated_at
  FROM feedback_items
  WHERE is_public = true
    AND type IN ('bug_report','feature_request')
    AND status NOT IN ('duplicate')
  ORDER BY vote_count DESC, created_at DESC;

GRANT SELECT ON public_roadmap TO anon, authenticated;

-- ── 9. Grant sequence of helper functions to authenticated role ───────────────

GRANT EXECUTE ON FUNCTION find_similar_feedback(TEXT,TEXT,TEXT,INT) TO anon, authenticated;

-- ── 10. Re-point feedback_items.user_id FK to profiles(id) ──────────────────
-- This lets PostgREST discover the join feedback_items → profiles directly.
-- profiles.id is a PK that mirrors auth.users.id, so data integrity is the same.

ALTER TABLE feedback_items
  DROP CONSTRAINT IF EXISTS feedback_items_user_id_fkey,
  ADD CONSTRAINT feedback_items_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 11. Allow user-facing RLS delete on own comments ────────────────────────
DROP POLICY IF EXISTS "feedback_comments_delete" ON feedback_comments;
CREATE POLICY "feedback_comments_delete" ON feedback_comments FOR DELETE
  USING (
    author_id = auth.uid()
    OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
  );
