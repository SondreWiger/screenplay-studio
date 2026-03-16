-- ============================================================
-- Treatment / Series Bible — expanded columns
-- Adds: tagline, genre, rules_of_world, timeline, plot_threads, custom_sections
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE treatment
  ADD COLUMN IF NOT EXISTS tagline         TEXT,
  ADD COLUMN IF NOT EXISTS genre           TEXT,
  ADD COLUMN IF NOT EXISTS rules_of_world  TEXT,
  ADD COLUMN IF NOT EXISTS atmosphere      TEXT,
  ADD COLUMN IF NOT EXISTS visual_style    TEXT,
  ADD COLUMN IF NOT EXISTS timeline        JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS plot_threads    JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_sections JSONB NOT NULL DEFAULT '[]'::jsonb;

-- timeline     [{id, date, event, type: 'world'|'story'|'character'|'other'}]
-- plot_threads [{id, label, color, summary, beats}]
-- custom_sections [{id, title, content}]
