-- ============================================================
-- Gamification System Migration
-- Run in Supabase SQL editor
-- ============================================================

-- ── Badges ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  emoji         text NOT NULL DEFAULT '🏅',
  color         text NOT NULL DEFAULT '#FF5F1F',   -- hex color for badge chip
  is_system     boolean NOT NULL DEFAULT false,
  system_role   text,                              -- 'admin' | 'moderator' | 'contributor' — auto-awarded
  created_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Seed system badges
INSERT INTO badges (name, description, emoji, color, is_system, system_role) VALUES
  ('Admin',       'Platform administrator',         '🛡️', '#EF4444', true, 'admin'),
  ('Moderator',   'Community moderator',            '🔰', '#22C55E', true, 'moderator'),
  ('Contributor', 'Open-source contributor',        '⭐', '#F59E0B', true, 'contributor')
ON CONFLICT DO NOTHING;

-- ── User Badges ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_badges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id     uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- null = system
  awarded_at   timestamptz NOT NULL DEFAULT now(),
  -- Which display slot this badge is assigned to (null = owned but not displayed)
  -- Slot 1 = primary   Slot 2 = secondary (admins/mods/contributors only)
  display_slot int CHECK (display_slot IN (1, 2)),
  UNIQUE (user_id, badge_id)
);

-- ── Gamification state per user ───────────────────────────────
CREATE TABLE IF NOT EXISTS user_gamification (
  user_id            uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  xp_total           bigint NOT NULL DEFAULT 0,
  level              int    NOT NULL DEFAULT 1,
  -- null = never asked; false = opted out; true = opted in
  gamification_enabled boolean,
  -- whether the opt-in popup has been shown yet (after onboarding)
  popup_shown        boolean NOT NULL DEFAULT false,
  -- for daily login streak tracking
  last_login_date    date,
  login_streak       int NOT NULL DEFAULT 0,
  -- writing session tracking
  session_started_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ── XP Events log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type   text NOT NULL,
  xp_base      int  NOT NULL DEFAULT 0,
  multiplier   numeric(6,3) NOT NULL DEFAULT 1.0,
  xp_awarded   int  NOT NULL DEFAULT 0,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Profile columns ───────────────────────────────────────────
-- Primary badge shown next to name everywhere
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS selected_badge_id  uuid REFERENCES badges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_badge2_id uuid REFERENCES badges(id) ON DELETE SET NULL;

-- ── RLS Policies ─────────────────────────────────────────────

-- badges: public read, admin write
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "badges_read"  ON badges;
DROP POLICY IF EXISTS "badges_write" ON badges;
CREATE POLICY "badges_read"  ON badges FOR SELECT USING (true);
CREATE POLICY "badges_write" ON badges FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- user_badges: public read, admins/mods can award; users manage own slots
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_badges_read"      ON user_badges;
DROP POLICY IF EXISTS "user_badges_award"     ON user_badges;
DROP POLICY IF EXISTS "user_badges_self_slot" ON user_badges;
CREATE POLICY "user_badges_read" ON user_badges FOR SELECT USING (true);
CREATE POLICY "user_badges_award" ON user_badges FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','moderator'))
  OR auth.uid() = user_id   -- system auto-award (called via service role)
);
CREATE POLICY "user_badges_self_slot" ON user_badges FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_badges_delete" ON user_badges FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR auth.uid() = user_id
);

-- user_gamification: users see/edit own; service role full access
ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gamif_self" ON user_gamification;
CREATE POLICY "gamif_self" ON user_gamification FOR ALL USING (auth.uid() = user_id);

-- xp_events: users see own
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "xp_read" ON xp_events;
CREATE POLICY "xp_read" ON xp_events FOR SELECT USING (auth.uid() = user_id);

-- ── Trigger: init gamification row on new profile ─────────────
CREATE OR REPLACE FUNCTION init_user_gamification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_gamification (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_gamification ON profiles;
CREATE TRIGGER trg_init_gamification
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION init_user_gamification();

-- Back-fill existing profiles that don't have a gamification row
INSERT INTO user_gamification (user_id)
SELECT id FROM profiles
WHERE id NOT IN (SELECT user_id FROM user_gamification)
ON CONFLICT DO NOTHING;

-- ── Trigger: auto-award system badges when role changes ───────
CREATE OR REPLACE FUNCTION sync_system_badges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_badge_id uuid;
BEGIN
  -- Remove all system badges from this user first
  DELETE FROM user_badges
  WHERE user_id = NEW.id
    AND badge_id IN (SELECT id FROM badges WHERE is_system = true AND system_role IS NOT NULL);

  -- Re-award the badge matching their new role
  IF NEW.role IN ('admin','moderator') THEN
    SELECT id INTO v_badge_id FROM badges WHERE system_role = NEW.role LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id, display_slot)
      VALUES (NEW.id, v_badge_id, 1)
      ON CONFLICT (user_id, badge_id) DO UPDATE SET display_slot = 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_system_badges ON profiles;
CREATE TRIGGER trg_sync_system_badges
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_system_badges();

-- Back-fill existing admins and moderators
DO $$
DECLARE
  r RECORD;
  v_badge_id uuid;
BEGIN
  FOR r IN SELECT id, role FROM profiles WHERE role IN ('admin','moderator') LOOP
    SELECT id INTO v_badge_id FROM badges WHERE system_role = r.role LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id, display_slot)
      VALUES (r.id, v_badge_id, 1)
      ON CONFLICT (user_id, badge_id) DO UPDATE SET display_slot = 1;
    END IF;
  END LOOP;
END $$;

-- ── Helper function: award XP (called from API routes) ────────
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id    uuid,
  p_event_type text,
  p_xp_base    int,
  p_multiplier numeric DEFAULT 1.0,
  p_metadata   jsonb   DEFAULT NULL
)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_xp_awarded int;
  v_new_total  bigint;
  v_new_level  int;
BEGIN
  v_xp_awarded := GREATEST(1, ROUND(p_xp_base * p_multiplier)::int);

  -- Check user opted out — still log event but don't update display
  INSERT INTO xp_events (user_id, event_type, xp_base, multiplier, xp_awarded, metadata)
  VALUES (p_user_id, p_event_type, p_xp_base, p_multiplier, v_xp_awarded, p_metadata);

  -- Upsert gamification row
  INSERT INTO user_gamification (user_id, xp_total) VALUES (p_user_id, v_xp_awarded)
  ON CONFLICT (user_id) DO UPDATE
    SET xp_total   = user_gamification.xp_total + v_xp_awarded,
        updated_at = now()
  RETURNING xp_total INTO v_new_total;

  -- Recalculate level (100 * level^1.6 cumulative threshold)
  v_new_level := 1;
  WHILE v_new_level < 100 AND v_new_total >= ROUND(80 * POWER(v_new_level, 1.8))::bigint LOOP
    v_new_level := v_new_level + 1;
  END LOOP;

  UPDATE user_gamification SET level = v_new_level WHERE user_id = p_user_id;

  RETURN v_xp_awarded;
END;
$$;
