-- ============================================================
-- MIGRATION: Add 'accepted' to script_submissions status CHECK
-- ============================================================
-- The original submission_status constraint only included:
--   pending | passed | request | offer | withdrawn
--
-- This patch adds 'accepted' so Festival Bridge users can mark
-- a submission as fully accepted (triggers the 🎉 toast in the UI).
-- ============================================================

ALTER TABLE script_submissions
  DROP CONSTRAINT IF EXISTS submission_status;

ALTER TABLE script_submissions
  ADD CONSTRAINT submission_status
    CHECK (status IN ('pending', 'passed', 'request', 'offer', 'accepted', 'withdrawn'));
