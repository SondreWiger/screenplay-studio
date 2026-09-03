-- Add image_url and linking columns to ideas table
-- Allows ideas to have associated images and be linked to scenes/characters

BEGIN;

ALTER TABLE ideas
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS linked_scene_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_character_ids UUID[] DEFAULT '{}';

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_ideas_image_url ON ideas(image_url)
  WHERE image_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ideas_linked_scenes ON ideas USING GIN (linked_scene_ids);
CREATE INDEX IF NOT EXISTS idx_ideas_linked_characters ON ideas USING GIN (linked_character_ids);

COMMIT;
