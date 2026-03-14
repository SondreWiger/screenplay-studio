-- ============================================================
-- CHARACTER VISUAL PROFILES
-- Adds link-based visual reference fields to the characters table.
-- All images are stored as URL links — no file uploads.
-- See blog post: /blog/why-we-use-image-links
-- ============================================================

-- actor_photo_url: A link to a photo that shows how the character should look.
-- Could be a reference actor, a character design, a casting photo, etc.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS actor_photo_url TEXT;

-- inspo_images: Inspiration board — links to images that capture the character's
-- vibe, aesthetic, or feel. Each entry: { url, caption }
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS inspo_images JSONB DEFAULT '[]'::jsonb;

-- reference_folders: Versioned production reference collections.
-- Used for makeup, costume, and other design iterations.
-- Each folder: { id, name, type ('makeup'|'costume'|'other'), images: [{ url, caption }] }
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS reference_folders JSONB DEFAULT '[]'::jsonb;
