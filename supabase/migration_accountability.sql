-- ─────────────────────────────────────────────────────────────────────────────
-- Accountability & Work Tracking
-- Adds: work_logs, accountability_buddies, accountability_groups,
--       accountability_group_members, accountability_feed
-- Extends profiles: activity_color, show_activity_grid, daily_goal_pages
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend profiles ───────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS activity_color       TEXT             DEFAULT '#22c55e',
  ADD COLUMN IF NOT EXISTS show_activity_grid   TEXT             DEFAULT 'buddies'
    CHECK (show_activity_grid IN ('private', 'buddies', 'public')),
  ADD COLUMN IF NOT EXISTS daily_goal_pages     NUMERIC(6,2)     DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS daily_goal_minutes   INTEGER          DEFAULT 0;

-- ── 2. work_logs — one aggregate row per user per date ───────────────────────
-- Multiple saves in one day upsert-increment the same row.

CREATE TABLE IF NOT EXISTS work_logs (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id       UUID          REFERENCES projects(id) ON DELETE SET NULL,
  log_date         DATE          NOT NULL DEFAULT CURRENT_DATE,
  pages_written    NUMERIC(6,2)  NOT NULL DEFAULT 0,
  scenes_created   INTEGER       NOT NULL DEFAULT 0,
  words_written    INTEGER       NOT NULL DEFAULT 0,
  session_minutes  INTEGER       NOT NULL DEFAULT 0,
  manual_note      TEXT,
  is_manual        BOOLEAN       NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_logs_user_date_project_idx
  ON work_logs (user_id, log_date, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::UUID));

CREATE INDEX IF NOT EXISTS work_logs_user_date_idx  ON work_logs (user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS work_logs_project_idx    ON work_logs (project_id);

-- Trigger: keep updated_at fresh
CREATE OR REPLACE FUNCTION update_work_log_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_logs_updated_at ON work_logs;
CREATE TRIGGER trg_work_logs_updated_at
  BEFORE UPDATE ON work_logs
  FOR EACH ROW EXECUTE FUNCTION update_work_log_updated_at();

-- RLS
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_logs_select_own"            ON work_logs;
DROP POLICY IF EXISTS "work_logs_select_buddy_public"   ON work_logs;
DROP POLICY IF EXISTS "work_logs_insert_own"            ON work_logs;
DROP POLICY IF EXISTS "work_logs_update_own"            ON work_logs;
DROP POLICY IF EXISTS "work_logs_delete_own"            ON work_logs;

-- Owner can see own logs
CREATE POLICY "work_logs_select_own" ON work_logs
  FOR SELECT USING (auth.uid() = user_id);

-- NOTE: work_logs_select_buddy_public is added after accountability_buddies is created (see below)

CREATE POLICY "work_logs_insert_own" ON work_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "work_logs_update_own" ON work_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "work_logs_delete_own" ON work_logs
  FOR DELETE USING (auth.uid() = user_id);

-- ── 3. accountability_buddies — 1-on-1 accountability pairs ─────────────────

CREATE TABLE IF NOT EXISTS accountability_buddies (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  message       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS ab_requester_idx  ON accountability_buddies (requester_id);
CREATE INDEX IF NOT EXISTS ab_addressee_idx  ON accountability_buddies (addressee_id);
CREATE INDEX IF NOT EXISTS ab_status_idx     ON accountability_buddies (status);

-- Now that accountability_buddies exists, add the cross-table work_logs policy
DROP POLICY IF EXISTS "work_logs_select_buddy_public" ON work_logs;
CREATE POLICY "work_logs_select_buddy_public" ON work_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = work_logs.user_id
        AND (
          p.show_activity_grid = 'public'
          OR (
            p.show_activity_grid = 'buddies'
            AND EXISTS (
              SELECT 1 FROM accountability_buddies ab
              WHERE ab.status = 'accepted'
                AND (
                  (ab.requester_id = auth.uid() AND ab.addressee_id = work_logs.user_id)
                  OR (ab.addressee_id = auth.uid() AND ab.requester_id = work_logs.user_id)
                )
            )
          )
        )
    )
  );

ALTER TABLE accountability_buddies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ab_select"  ON accountability_buddies;
DROP POLICY IF EXISTS "ab_insert"  ON accountability_buddies;
DROP POLICY IF EXISTS "ab_update"  ON accountability_buddies;
DROP POLICY IF EXISTS "ab_delete"  ON accountability_buddies;

CREATE POLICY "ab_select" ON accountability_buddies
  FOR SELECT USING (auth.uid() IN (requester_id, addressee_id));

CREATE POLICY "ab_insert" ON accountability_buddies
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Addressee can update status; requester can also update (e.g., cancel)
CREATE POLICY "ab_update" ON accountability_buddies
  FOR UPDATE USING (auth.uid() IN (requester_id, addressee_id));

CREATE POLICY "ab_delete" ON accountability_buddies
  FOR DELETE USING (auth.uid() IN (requester_id, addressee_id));

-- ── 4. accountability_groups ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accountability_groups (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT        NOT NULL,
  description  TEXT,
  created_by   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code  TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  is_public    BOOLEAN     NOT NULL DEFAULT false,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE accountability_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ag_select"  ON accountability_groups;
DROP POLICY IF EXISTS "ag_insert"  ON accountability_groups;
DROP POLICY IF EXISTS "ag_update"  ON accountability_groups;
DROP POLICY IF EXISTS "ag_delete"  ON accountability_groups;

-- NOTE: ag_select is added after accountability_group_members is created (see below)

CREATE POLICY "ag_insert" ON accountability_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- NOTE: ag_update is added after accountability_group_members is created (see below)

CREATE POLICY "ag_delete" ON accountability_groups
  FOR DELETE USING (auth.uid() = created_by);

-- ── 5. accountability_group_members ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accountability_group_members (
  group_id   UUID        NOT NULL REFERENCES accountability_groups(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS agm_user_idx ON accountability_group_members (user_id);

-- Now that accountability_group_members exists, add the cross-table accountability_groups policy
DROP POLICY IF EXISTS "ag_select" ON accountability_groups;
CREATE POLICY "ag_select" ON accountability_groups
  FOR SELECT USING (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM accountability_group_members agm
      WHERE agm.group_id = accountability_groups.id AND agm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ag_update" ON accountability_groups;
CREATE POLICY "ag_update" ON accountability_groups
  FOR UPDATE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM accountability_group_members agm
      WHERE agm.group_id = accountability_groups.id AND agm.user_id = auth.uid()
        AND agm.role IN ('owner', 'admin')
    )
  );

ALTER TABLE accountability_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agm_select"  ON accountability_group_members;
DROP POLICY IF EXISTS "agm_insert"  ON accountability_group_members;
DROP POLICY IF EXISTS "agm_delete"  ON accountability_group_members;

CREATE POLICY "agm_select" ON accountability_group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM accountability_group_members me
      WHERE me.group_id = accountability_group_members.group_id AND me.user_id = auth.uid()
    )
  );

CREATE POLICY "agm_insert" ON accountability_group_members
  FOR INSERT WITH CHECK (
    -- Self join via invite code handled by a function; admins/owners can add
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM accountability_group_members me
      WHERE me.group_id = accountability_group_members.group_id AND me.user_id = auth.uid()
        AND me.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "agm_delete" ON accountability_group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM accountability_group_members me
      WHERE me.group_id = accountability_group_members.group_id AND me.user_id = auth.uid()
        AND me.role IN ('owner', 'admin')
    )
  );

-- ── 6. accountability_feed — posts/nudges within buddy/group context ──────────

CREATE TABLE IF NOT EXISTS accountability_feed (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id     UUID        REFERENCES accountability_groups(id) ON DELETE CASCADE,
  buddy_pair   UUID        REFERENCES accountability_buddies(id) ON DELETE CASCADE,
  work_log_id  UUID        REFERENCES work_logs(id) ON DELETE SET NULL,
  content      TEXT        NOT NULL,
  post_type    TEXT        NOT NULL DEFAULT 'message'
    CHECK (post_type IN ('message', 'checkin', 'nudge', 'milestone')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS af_group_idx  ON accountability_feed (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS af_author_idx ON accountability_feed (author_id);

ALTER TABLE accountability_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "af_select"  ON accountability_feed;
DROP POLICY IF EXISTS "af_insert"  ON accountability_feed;
DROP POLICY IF EXISTS "af_delete"  ON accountability_feed;

-- Can read if in the same group
CREATE POLICY "af_select" ON accountability_feed
  FOR SELECT USING (
    author_id = auth.uid()
    OR (
      group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM accountability_group_members agm
        WHERE agm.group_id = accountability_feed.group_id AND agm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "af_insert" ON accountability_feed
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "af_delete" ON accountability_feed
  FOR DELETE USING (auth.uid() = author_id);

-- ── 7. Helper: join group by invite code ─────────────────────────────────────

CREATE OR REPLACE FUNCTION join_accountability_group(p_invite_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id
  FROM accountability_groups
  WHERE invite_code = p_invite_code;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO accountability_group_members (group_id, user_id, role)
  VALUES (v_group_id, auth.uid(), 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN v_group_id;
END;
$$;

-- ── 8. Helper: upsert work log (increment, not overwrite) ───────────────────

CREATE OR REPLACE FUNCTION upsert_work_log(
  p_project_id       UUID,
  p_pages_written    NUMERIC(6,2),
  p_scenes_created   INTEGER,
  p_words_written    INTEGER,
  p_session_minutes  INTEGER,
  p_manual_note      TEXT,
  p_is_manual        BOOLEAN
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
  v_null_project UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  INSERT INTO work_logs (
    user_id, project_id, log_date,
    pages_written, scenes_created, words_written, session_minutes,
    manual_note, is_manual
  ) VALUES (
    auth.uid(),
    p_project_id,
    CURRENT_DATE,
    p_pages_written, p_scenes_created, p_words_written, p_session_minutes,
    p_manual_note, p_is_manual
  )
  ON CONFLICT (user_id, log_date, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::UUID))
  DO UPDATE SET
    pages_written   = work_logs.pages_written   + EXCLUDED.pages_written,
    scenes_created  = work_logs.scenes_created  + EXCLUDED.scenes_created,
    words_written   = work_logs.words_written   + EXCLUDED.words_written,
    session_minutes = work_logs.session_minutes + EXCLUDED.session_minutes,
    manual_note     = COALESCE(EXCLUDED.manual_note, work_logs.manual_note),
    is_manual       = EXCLUDED.is_manual OR work_logs.is_manual,
    updated_at      = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 9. View for "days worked this year" leaderboard ──────────────────────────

CREATE OR REPLACE VIEW work_summary AS
SELECT
  wl.user_id,
  p.display_name,
  p.username,
  p.avatar_url,
  p.activity_color,
  p.daily_goal_pages,
  COUNT(DISTINCT wl.log_date)                          AS days_worked,
  COALESCE(SUM(wl.pages_written), 0)                  AS total_pages,
  COALESCE(SUM(wl.session_minutes), 0)                AS total_minutes,
  MAX(wl.log_date)                                     AS last_active_date
FROM work_logs wl
JOIN profiles p ON p.id = wl.user_id
GROUP BY wl.user_id, p.display_name, p.username, p.avatar_url,
         p.activity_color, p.daily_goal_pages;

-- Grant access for authenticated users
GRANT SELECT ON work_summary TO authenticated;
