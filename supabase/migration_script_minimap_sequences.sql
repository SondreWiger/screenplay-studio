-- ============================================================
--  Script Minimap + Sequence / Act Element Types
--  Run in: Supabase Dashboard > SQL Editor
-- ============================================================
--
--  Schema notes
--  ─────────────────────────────────────────────────────────
--  • 'sequence' and 'sequence_end' are added to the
--    script_element_type ENUM (see ALTER TYPE above) so they
--    persist correctly in the DB.
--  • Sequence colour is stored in the existing `metadata` JSONB
--    column as { "color": "#6366f1" } — no new column needed.
--  • 'act' already existed as an element type.
--  • Minimap display preferences (show/hide, labels, colours)
--    are persisted in localStorage under the existing key
--    'ss_display_settings'. The column below optionally syncs
--    them to the DB so users keep their settings across devices.
-- ============================================================

-- ── IMPORTANT: run these two ALTER TYPE lines FIRST, alone ──
-- ALTER TYPE ADD VALUE cannot run inside a transaction block.
-- Highlight and execute just these two lines in the SQL editor,
-- then run the rest of the file separately.
-- ─────────────────────────────────────────────────────────────
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'sequence';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'sequence_end';
-- ─────────────────────────────────────────────────────────────

-- ── Optional: persist script display settings per user ──────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS script_display_settings JSONB DEFAULT '{}';

COMMENT ON COLUMN profiles.script_display_settings IS
  'Stores per-user script editor display preferences such as
   minimap visibility, sequence label/colour toggles, font size,
   page width, scene numbers, character highlights, etc.
   Mirrors the localStorage key ss_display_settings.';

-- ── Changelog: record the new features ──────────────────────

-- Bump to 2.9.0 (or append to current unreleased draft)
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.9.0',
  'Script Minimap & Sequences',
  'A proportional script overview bar with clickable navigation, plus new Sequence and End Sequence element types with colour coding.',
  'minor'
)
ON CONFLICT (version) DO NOTHING;

-- Script Minimap
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Script minimap navigation bar',
  'A compact proportional overview of the entire script sits at the bottom of the editor. It shows scene-heading ticks, act dividers, and coloured sequence bands. Click anywhere to jump instantly; drag the viewport handle to scroll smoothly.',
  'feature',
  'editor',
  true,
  10
FROM changelog_releases WHERE version = '2.9.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.9.0' AND ce.title = 'Script minimap navigation bar'
);

-- Sequence element type
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Sequence element type with colour coding',
  'Add Sequence and End Sequence elements to bracket sections of your script. Each sequence can be given a custom colour (8 presets) via a gutter colour picker. Sequences appear as coloured bands in the minimap.',
  'feature',
  'editor',
  true,
  20
FROM changelog_releases WHERE version = '2.9.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.9.0' AND ce.title = 'Sequence element type with colour coding'
);

-- Minimap display settings
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Minimap display settings',
  'The minimap, sequence labels, and sequence colours are each independently toggleable in the Display Settings panel (⚙ icon in the toolbar), keeping your view clean if you prefer a plain editor.',
  'improvement',
  'editor',
  true,
  30
FROM changelog_releases WHERE version = '2.9.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.9.0' AND ce.title = 'Minimap display settings'
);

-- Scene heading colour coding
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Scene colour coding in minimap',
  'Scene headings can now be given an individual colour using the circular colour swatch in the gutter. In the minimap the tick for that scene is split: the top half shows the enclosing sequence colour (if any) and the bottom half shows the scene colour, making it easy to see both structure and scene identity at a glance.',
  'feature',
  'editor',
  true,
  40
FROM changelog_releases WHERE version = '2.9.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.9.0' AND ce.title = 'Scene colour coding in minimap'
);

-- Collapsible sequences
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Collapsible sequences',
  'Click the chevron (▼) next to any Sequence element to collapse all the elements inside it into a single stub row. The stub shows how many elements are hidden and can be clicked to expand again, helping you focus on one part of the script at a time.',
  'feature',
  'editor',
  true,
  50
FROM changelog_releases WHERE version = '2.9.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.9.0' AND ce.title = 'Collapsible sequences'
);

-- Publish when ready:
-- SELECT publish_release('2.9.0');
