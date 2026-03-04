-- Migration: Contributors
-- Run in Supabase SQL editor

-- Tracks platform contributors listed on /contribute and /about pages
CREATE TABLE IF NOT EXISTS contributors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  github_handle       text,
  bio                 text,
  cached_name         text,         -- denormalised from profiles for join-free public reads
  cached_avatar_url   text,
  contribution_areas  text[] NOT NULL DEFAULT '{}',
  is_featured         boolean NOT NULL DEFAULT false,
  added_at            timestamptz NOT NULL DEFAULT now(),
  added_by            uuid,  -- plain uuid, no FK (avoids ambiguous join with user_id)

  CONSTRAINT contributors_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS contributors_user_id_idx     ON contributors(user_id);
CREATE INDEX IF NOT EXISTS contributors_is_featured_idx ON contributors(is_featured);

-- If the table was previously created with a FK on added_by, drop it to avoid
-- the "more than one relationship" error when joining contributors -> profiles.
ALTER TABLE contributors
  DROP CONSTRAINT IF EXISTS contributors_added_by_fkey;

-- Add cached display columns if they don't exist yet
ALTER TABLE contributors ADD COLUMN IF NOT EXISTS cached_name       text;
ALTER TABLE contributors ADD COLUMN IF NOT EXISTS cached_avatar_url text;

-- RLS
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;

-- Anyone can read contributors (for /about and /contribute pages)
CREATE POLICY "contributors_select_all" ON contributors
  FOR SELECT USING (true);

-- Helper: true if the current user is a platform admin
-- Matches the same logic as the app: role = 'admin'  OR hardcoded admin UID
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    );
$$;

-- Only admins can insert
CREATE POLICY "contributors_insert_admin" ON contributors
  FOR INSERT WITH CHECK (public.is_platform_admin());

-- Only admins can update
CREATE POLICY "contributors_update_admin" ON contributors
  FOR UPDATE USING (public.is_platform_admin());

-- Only admins can delete
CREATE POLICY "contributors_delete_admin" ON contributors
  FOR DELETE USING (public.is_platform_admin());

-- Done
