-- Migration: Add storyboard fields to shots table
-- These fields allow storyboard drawings and references to be stored directly on shots

-- Add new columns for storyboard data
ALTER TABLE shots ADD COLUMN IF NOT EXISTS storyboard_drawing JSONB DEFAULT '[]'::jsonb;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS storyboard_references JSONB DEFAULT '[]'::jsonb;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS storyboard_notes TEXT;

-- Create index for faster storyboard queries
CREATE INDEX IF NOT EXISTS idx_shots_storyboard ON shots USING GIN (storyboard_drawing);

-- Comment the new columns
COMMENT ON COLUMN shots.storyboard_drawing IS 'Array of stroke objects for drawn storyboard: [{points: [{x,y}], color, width, tool}]';
COMMENT ON COLUMN shots.storyboard_references IS 'Array of reference images: [{url, label?}]';
COMMENT ON COLUMN shots.storyboard_notes IS 'Notes specific to the storyboard visualization';
