-- ============================================================
-- Polls / Surveys System
-- ============================================================
-- Tables: poll_sessions, poll_questions, poll_responses, poll_answers
-- XP: 100 XP awarded on completion (poll_complete event type added in app)
-- Notifications: on publish, all users get a 'poll_published' notification

-- ── Enums ─────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poll_status') THEN
    CREATE TYPE poll_status AS ENUM ('draft', 'review', 'published', 'closed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poll_question_type') THEN
    CREATE TYPE poll_question_type AS ENUM (
      'yes_no',
      'single_select',
      'multi_select',
      'ranking',
      'short_text',
      'long_text'
    );
  END IF;
END $$;

-- Add poll_published to notification_type enum if not already there
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'poll_published';
END $$;

-- ── poll_sessions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  preface      text,               -- intro shown on first "page" of the modal
  status       poll_status NOT NULL DEFAULT 'draft',
  created_by   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  published_at timestamptz,
  closed_at    timestamptz,
  response_count int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── poll_questions ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES poll_sessions(id) ON DELETE CASCADE,
  sort_order     int  NOT NULL DEFAULT 0,
  question_text  text NOT NULL,
  question_type  poll_question_type NOT NULL DEFAULT 'single_select',
  -- For single_select, multi_select, ranking: array of option strings
  options        jsonb,
  is_required    boolean NOT NULL DEFAULT true,
  -- Admin review: has this question been approved before publish?
  is_approved    boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── poll_responses ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES poll_sessions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  xp_awarded   int NOT NULL DEFAULT 0,
  UNIQUE (session_id, user_id)
);

-- ── poll_answers ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_answers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id  uuid NOT NULL REFERENCES poll_responses(id) ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES poll_sessions(id) ON DELETE CASCADE,
  question_id  uuid NOT NULL REFERENCES poll_questions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- answer_text: used for yes_no ('yes'/'no'), single_select, short_text, long_text
  answer_text  text,
  -- answer_json: used for multi_select (array of strings), ranking (ordered array)
  answer_json  jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS poll_questions_session_id  ON poll_questions(session_id);
CREATE INDEX IF NOT EXISTS poll_responses_session_id  ON poll_responses(session_id);
CREATE INDEX IF NOT EXISTS poll_responses_user_id     ON poll_responses(user_id);
CREATE INDEX IF NOT EXISTS poll_answers_question_id   ON poll_answers(question_id);
CREATE INDEX IF NOT EXISTS poll_answers_session_id    ON poll_answers(session_id);
CREATE INDEX IF NOT EXISTS poll_answers_user_id       ON poll_answers(user_id);

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE poll_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_answers   ENABLE ROW LEVEL SECURITY;

-- poll_sessions
DROP POLICY IF EXISTS "poll_sessions_admin"       ON poll_sessions;
DROP POLICY IF EXISTS "poll_sessions_read"        ON poll_sessions;
CREATE POLICY "poll_sessions_admin" ON poll_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "poll_sessions_read" ON poll_sessions FOR SELECT
  USING (status = 'published' OR status = 'closed');

-- poll_questions
DROP POLICY IF EXISTS "poll_questions_admin"      ON poll_questions;
DROP POLICY IF EXISTS "poll_questions_read"       ON poll_questions;
CREATE POLICY "poll_questions_admin" ON poll_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "poll_questions_read" ON poll_questions FOR SELECT
  USING (
    session_id IN (SELECT id FROM poll_sessions WHERE status = 'published' OR status = 'closed')
  );

-- poll_responses
DROP POLICY IF EXISTS "poll_responses_admin"      ON poll_responses;
DROP POLICY IF EXISTS "poll_responses_self"       ON poll_responses;
CREATE POLICY "poll_responses_admin" ON poll_responses FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "poll_responses_self" ON poll_responses FOR ALL
  USING (auth.uid() = user_id);

-- poll_answers
DROP POLICY IF EXISTS "poll_answers_admin"        ON poll_answers;
DROP POLICY IF EXISTS "poll_answers_self"         ON poll_answers;
CREATE POLICY "poll_answers_admin" ON poll_answers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "poll_answers_self" ON poll_answers FOR ALL
  USING (auth.uid() = user_id);

-- ── Helper: increment response_count on new response ─────────

CREATE OR REPLACE FUNCTION increment_poll_response_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE poll_sessions
  SET response_count = response_count + 1,
      updated_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_poll_response ON poll_responses;
CREATE TRIGGER on_poll_response
  AFTER INSERT ON poll_responses
  FOR EACH ROW EXECUTE FUNCTION increment_poll_response_count();
