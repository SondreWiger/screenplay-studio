-- ============================================================
-- Migration: Multi-Location Markers
-- Allows a single map marker to link to multiple locations
-- ============================================================

-- Add location_ids array column to location_markers
ALTER TABLE location_markers 
  ADD COLUMN IF NOT EXISTS location_ids UUID[] DEFAULT '{}';

-- Migrate existing location_id to location_ids
UPDATE location_markers 
  SET location_ids = ARRAY[location_id] 
  WHERE location_id IS NOT NULL AND (location_ids IS NULL OR location_ids = '{}');

-- Create index for location_ids array (GIN for containment queries)
CREATE INDEX IF NOT EXISTS idx_location_markers_location_ids 
  ON location_markers USING GIN (location_ids);
