-- ============================================================
-- Screenplay Studio — Migration: Community Courses
-- Run in Supabase SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. COURSES TABLE
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  short_desc       TEXT,                        -- one-liner for cards
  type             TEXT NOT NULL DEFAULT 'user' CHECK (type IN ('system','user')),
  creator_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  thumbnail_url    TEXT,
  difficulty       TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  tags             TEXT[] DEFAULT '{}',
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  xp_reward        INT DEFAULT 100,             -- total XP for completion
  estimated_minutes INT DEFAULT 30,
  enrollment_count INT DEFAULT 0,
  completion_count INT DEFAULT 0,
  rating_sum       INT DEFAULT 0,
  rating_count     INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_status       ON courses (status);
CREATE INDEX IF NOT EXISTS idx_courses_type         ON courses (type);
CREATE INDEX IF NOT EXISTS idx_courses_creator_id   ON courses (creator_id);
CREATE INDEX IF NOT EXISTS idx_courses_created_at   ON courses (created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- 2. COURSE SECTIONS (chapters / parts)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_sections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  order_index      INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_sections_course ON course_sections (course_id, order_index);

-- ──────────────────────────────────────────────────────────────
-- 3. COURSE LESSONS (individual steps within sections)
--
--  lesson_type options:
--    'text'          — rich markdown/formatted text
--    'video'         — embeddable video (YouTube / Vimeo / direct)
--    'quiz'          — multiple-choice questions with correct answers
--    'script_editor' — mini fountain/screenplay editor
--    'arc_editor'    — embedded arc mind-map
--    'example'       — annotated code/script example (read-only)
--
--  content JSONB structures by type:
--    text:          { "markdown": "..." }
--    video:         { "embed_url": "...", "provider": "youtube|vimeo|direct",
--                    "duration_seconds": 180, "caption": "..." }
--    quiz:          { "questions": [
--                      { "id": "q1", "text": "...", "explanation": "...",
--                        "options": [{"id":"a","text":"...","is_correct":true}, ...] }
--                    ]}
--    script_editor: { "instructions": "...", "initial_content": "...",
--                     "locked": false, "expected_keywords": [],
--                     "hint": "..." }
--    arc_editor:    { "instructions": "...", "arc_data": {...},
--                     "locked": false }
--    example:       { "content": "...", "language": "fountain|text|json",
--                     "annotations": [{"line":1,"note":"..."}],
--                     "description": "..." }
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_lessons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id       UUID REFERENCES course_sections(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  order_index      INT NOT NULL DEFAULT 0,
  lesson_type      TEXT NOT NULL DEFAULT 'text'
                     CHECK (lesson_type IN ('text','video','quiz','script_editor','arc_editor','example')),
  content          JSONB NOT NULL DEFAULT '{}',
  xp_reward        INT DEFAULT 10,
  is_required      BOOL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_lessons_course   ON course_lessons (course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_course_lessons_section  ON course_lessons (section_id, order_index);

-- ──────────────────────────────────────────────────────────────
-- 4. COURSE ENROLLMENTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_enrollments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at       TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  last_accessed_at  TIMESTAMPTZ DEFAULT now(),
  progress_percent  INT DEFAULT 0,
  rating            INT CHECK (rating BETWEEN 1 AND 5),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user    ON course_enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course  ON course_enrollments (course_id);

-- ──────────────────────────────────────────────────────────────
-- 5. LESSON PROGRESS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_lesson_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id    UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  score        INT,        -- for quizzes: % correct
  attempts     INT DEFAULT 1,
  answer_data  JSONB,      -- user's quiz answers for review
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user   ON course_lesson_progress (user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON course_lesson_progress (lesson_id);

-- ──────────────────────────────────────────────────────────────
-- 6. TRIGGER: update enrollment progress_percent when lessons complete
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_course_progress()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total   INT;
  v_done    INT;
  v_pct     INT;
  v_all_req BOOL;
BEGIN
  -- Count required lessons for this course
  SELECT COUNT(*) INTO v_total
  FROM course_lessons
  WHERE course_id = NEW.course_id AND is_required = true;

  -- Count completed required lessons for this user
  SELECT COUNT(*) INTO v_done
  FROM course_lesson_progress clp
  JOIN course_lessons cl ON cl.id = clp.lesson_id
  WHERE clp.user_id = NEW.user_id
    AND clp.course_id = NEW.course_id
    AND cl.is_required = true;

  v_pct := CASE WHEN v_total = 0 THEN 100 ELSE (v_done * 100 / v_total) END;

  UPDATE course_enrollments
  SET progress_percent  = v_pct,
      last_accessed_at  = now(),
      completed_at      = CASE WHEN v_pct = 100 THEN COALESCE(completed_at, now()) ELSE NULL END
  WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

  -- Bump course completion count when first completed
  IF v_pct = 100 THEN
    UPDATE courses SET completion_count = completion_count + 1
    WHERE id = NEW.course_id
      AND NOT EXISTS (
        SELECT 1 FROM course_enrollments
        WHERE user_id = NEW.user_id AND course_id = NEW.course_id
          AND completed_at IS NOT NULL
          AND completed_at < now() - INTERVAL '1 second'
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_course_progress ON course_lesson_progress;
CREATE TRIGGER trg_sync_course_progress
AFTER INSERT OR UPDATE ON course_lesson_progress
FOR EACH ROW EXECUTE FUNCTION sync_course_progress();

-- ──────────────────────────────────────────────────────────────
-- 7. TRIGGER: bump enrollment_count when a user enrolls
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bump_course_enrollment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE courses SET enrollment_count = enrollment_count + 1
  WHERE id = NEW.course_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_enrollment ON course_enrollments;
CREATE TRIGGER trg_bump_enrollment
AFTER INSERT ON course_enrollments
FOR EACH ROW EXECUTE FUNCTION bump_course_enrollment();

-- ──────────────────────────────────────────────────────────────
-- 8. FUNCTION: rate a course (upserts rating on enrollment row)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rate_course(
  p_course_id UUID,
  p_rating    INT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old_rating INT;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be 1-5';
  END IF;

  SELECT rating INTO v_old_rating
  FROM course_enrollments
  WHERE user_id = auth.uid() AND course_id = p_course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enrolled';
  END IF;

  -- Subtract old rating if existed
  IF v_old_rating IS NOT NULL THEN
    UPDATE courses
    SET rating_sum   = rating_sum - v_old_rating,
        rating_count = rating_count - 1
    WHERE id = p_course_id;
  END IF;

  -- Save new rating
  UPDATE course_enrollments SET rating = p_rating
  WHERE user_id = auth.uid() AND course_id = p_course_id;

  UPDATE courses
  SET rating_sum   = rating_sum + p_rating,
      rating_count = rating_count + 1
  WHERE id = p_course_id;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 9. RLS POLICIES
-- ──────────────────────────────────────────────────────────────

ALTER TABLE courses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_sections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lessons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lesson_progress ENABLE ROW LEVEL SECURITY;

-- courses: published are public; drafts visible to creator + admin/mod
CREATE POLICY "courses_public_read" ON courses
  FOR SELECT USING (status = 'published' OR creator_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator'));

CREATE POLICY "courses_creator_insert" ON courses
  FOR INSERT WITH CHECK (
    creator_id = auth.uid()
    AND (
      -- Only users level 10+ OR already admin/mod can create user courses
      (SELECT level FROM user_gamification WHERE user_id = auth.uid()) >= 10
      OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator')
    )
  );

CREATE POLICY "courses_creator_update" ON courses
  FOR UPDATE USING (
    creator_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator')
  );

CREATE POLICY "courses_creator_delete" ON courses
  FOR DELETE USING (
    creator_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator')
  );

-- sections: readable if course is readable
CREATE POLICY "sections_readable" ON course_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM courses c WHERE c.id = course_id
        AND (c.status = 'published' OR c.creator_id = auth.uid()
          OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator'))
    )
  );

CREATE POLICY "sections_creator_write" ON course_sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND creator_id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator')
  );

-- lessons: same as sections
CREATE POLICY "lessons_readable" ON course_lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM courses c WHERE c.id = course_id
        AND (c.status = 'published' OR c.creator_id = auth.uid()
          OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator'))
    )
  );

CREATE POLICY "lessons_creator_write" ON course_lessons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND creator_id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator')
  );

-- enrollments: user sees their own
CREATE POLICY "enrollments_own" ON course_enrollments
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "enrollments_staff_read" ON course_enrollments
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator')
  );

-- lesson progress: own only
CREATE POLICY "lesson_progress_own" ON course_lesson_progress
  FOR ALL USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- 10. SEED SYSTEM COURSES (sample)
-- ──────────────────────────────────────────────────────────────

INSERT INTO courses (title, description, short_desc, type, difficulty, tags, status, xp_reward, estimated_minutes)
VALUES
  (
    'Screenplay Formatting Fundamentals',
    'Master the strict technical rules of screenplay formatting: sluglines, action lines, dialogue, parentheticals, and transitions. Learn why format matters and how professional readers judge it.',
    'Learn the technical rules of proper screenplay format.',
    'system', 'beginner',
    ARRAY['formatting','fundamentals','structure'],
    'published', 200, 45
  ),
  (
    'Writing Compelling Themes',
    'Explore how to weave theme into every layer of your screenplay — from the premise to individual scenes. This course covers both explicit and implicit thematic approaches with real-world examples.',
    'Weave meaning into every scene through theme.',
    'system', 'intermediate',
    ARRAY['theme','craft','storytelling'],
    'published', 150, 60
  ),
  (
    'Three-Act Structure Deep Dive',
    'Understand the mechanics, purpose, and variations of three-act structure. Includes arc editor tasks where you''ll build story maps yourself.',
    'Build story architecture with confidence.',
    'system', 'beginner',
    ARRAY['structure','three-act','plotting'],
    'published', 175, 50
  )
ON CONFLICT DO NOTHING;
