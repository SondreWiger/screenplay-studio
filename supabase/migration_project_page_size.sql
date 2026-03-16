-- ============================================================
-- Per-project script page size (US Letter or A4)
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS page_size TEXT
    CHECK (page_size IN ('letter', 'a4'))
    DEFAULT 'letter';
