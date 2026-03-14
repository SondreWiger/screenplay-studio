-- ============================================================
-- Changelog: 2.7.0 — Character Visual Profiles
-- ============================================================

-- Create the 2.7.0 draft release
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.0',
  'Character Visual Profiles',
  'Characters now have a rich detail panel with inspiration images, actor reference photos, and versioned production reference folders for makeup and costume.',
  'minor'
)
ON CONFLICT (version) DO NOTHING;

-- Feature: character detail panel (click-to-view, then edit)
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Character Detail Panel',
  'Clicking a character card now opens a read-only detail panel instead of jumping straight into edit mode. The panel shows a full overview of the character — description, backstory, arc, personality traits, appearance, and voice notes — with an Edit button to open the editor.',
  'feature',
  'characters',
  true,
  10
FROM changelog_releases WHERE version = '2.7.0'
ON CONFLICT DO NOTHING;

-- Feature: inspiration board (link-based)
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Inspiration Board',
  'Characters have a new Inspiration tab in their detail panel. Paste any image URL to build a mood board capturing the character''s vibe, look, or aesthetic. Images are displayed in a grid with optional captions and can be removed with one click.',
  'feature',
  'characters',
  true,
  20
FROM changelog_releases WHERE version = '2.7.0'
ON CONFLICT DO NOTHING;

-- Feature: actor reference photo
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Actor Reference Photo',
  'The Actor tab in the character detail panel lets you link a reference photo showing how the character should look — an actor headshot, a character design, or a casting reference. Existing cast actor name and casting notes are also shown here.',
  'feature',
  'characters',
  true,
  30
FROM changelog_releases WHERE version = '2.7.0'
ON CONFLICT DO NOTHING;

-- Feature: production reference folders
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Production Reference Folders',
  'The Production tab gives makeup, costume, and other departments a place to store versioned reference image folders directly on the character. Create folders like "Version 1", "Final Look", or "Early Design" — each typed as Makeup, Costume, or Other — and fill them with linked reference images.',
  'feature',
  'characters',
  true,
  40
FROM changelog_releases WHERE version = '2.7.0'
ON CONFLICT DO NOTHING;

-- Internal: DB migration for new character columns
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Character visual columns migration',
  'Added actor_photo_url (TEXT), inspo_images (JSONB), and reference_folders (JSONB) columns to the characters table. All default to empty/null and are safe to migrate with no data loss.',
  'internal',
  'database',
  false,
  50
FROM changelog_releases WHERE version = '2.7.0'
ON CONFLICT DO NOTHING;

-- Publish the release
SELECT publish_release('2.7.0');
