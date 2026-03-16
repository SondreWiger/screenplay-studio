-- Migration: add show_accountability column to profiles
-- Allows users to opt out of all accountability features

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_accountability BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN profiles.show_accountability IS
  'When false, accountability tab/page is hidden and inaccessible for this user.';
