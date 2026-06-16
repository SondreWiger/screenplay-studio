-- ─────────────────────────────────────────────────────────────────────────────
-- UI Theme preference (default / soft pastels)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_theme TEXT DEFAULT 'default';
