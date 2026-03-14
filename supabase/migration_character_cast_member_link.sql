-- ============================================================
-- Characters → Cast Members link + actor photo on avatar
-- ============================================================

-- Link a character to a cast member record so their photo_url
-- auto-populates the character avatar.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS cast_member_id UUID REFERENCES cast_members(id) ON DELETE SET NULL;

-- Index for fast lookups within a project
CREATE INDEX IF NOT EXISTS idx_characters_cast_member_id
  ON characters(cast_member_id) WHERE cast_member_id IS NOT NULL;
