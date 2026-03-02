-- Migration: Audio Drama & TV Production Enum + Format Values
-- ⚠️  MUST BE RUN IN TWO SEPARATE STEPS in the Supabase SQL editor.
--     ALTER TYPE ... ADD VALUE cannot be used in the same transaction
--     as queries that reference the new enum value.
--
-- ══════════════════════════════════════════════════════════════
--  STEP 1 — Run this block first, then click Run.
-- ══════════════════════════════════════════════════════════════

ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'tv_production';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'audio_drama';

-- ══════════════════════════════════════════════════════════════
--  STEP 2 — After Step 1 succeeds, run everything below here.
-- ══════════════════════════════════════════════════════════════

-- Normalize existing audio_drama projects: any that still have a
-- generic film format value get updated to 'starc_standard'.
UPDATE projects
SET    format = 'starc_standard'
WHERE  (project_type = 'audio_drama' OR script_type = 'audio_drama')
  AND  (
         format IS NULL
         OR format = ''
         OR format NOT IN ('bbc_radio', 'us_radio', 'starc_standard', 'podcast_simple')
       );

-- Migrate legacy rows where script_type was set to 'audio_drama'
-- but project_type was never updated to match.
UPDATE projects
SET    project_type = 'audio_drama'
WHERE  script_type  = 'audio_drama'
  AND  project_type != 'audio_drama';

-- Ensure the project_templates updated_at trigger exists
-- (run migration_project_templates.sql first if the table doesn't exist yet).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'project_templates_updated_at'
  ) THEN
    CREATE TRIGGER project_templates_updated_at
      BEFORE UPDATE ON project_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── Optional: seed starter templates ────────────────────────
-- Uncomment and run as a logged-in user to create personal starter
-- templates for each audio format.

/*
INSERT INTO project_templates
  (user_id, name, description, project_type, script_type, format, is_public, structure_snapshot)
VALUES
  (
    auth.uid(),
    'BBC Radio Drama',
    'Classic British radio drama — scene headings, stage directions, FADE IN/OUT.',
    'audio_drama', 'podcast', 'bbc_radio', false,
    '{"suggested_genres":["Thriller","Drama","Horror","Comedy","Sci-Fi"]}'::jsonb
  ),
  (
    auth.uid(),
    'US Radio Drama',
    'American radio play — acts, announcer lines, full sound-cue sheets.',
    'audio_drama', 'podcast', 'us_radio', false,
    '{"suggested_genres":["Mystery","Adventure","Sci-Fi","Comedy","Horror"]}'::jsonb
  ),
  (
    auth.uid(),
    'STARC Audio Drama',
    'Full STARC format with inline SFX:, MUSIC:, and AMBIENCE: cue lines.',
    'audio_drama', 'podcast', 'starc_standard', false,
    '{"suggested_genres":["Thriller","Drama","Fantasy","Sci-Fi","Horror"]}'::jsonb
  );
*/
