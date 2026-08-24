-- ============================================================
-- Realtime for the iPhone app
-- ------------------------------------------------------------
-- script_elements, scenes, shots and production_schedule are already in the
-- supabase_realtime publication (see FULL.sql). projects and characters are
-- not, so the phone app cannot live-update the project list or the cast list
-- until they are added.
--
-- Safe to run more than once.
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE projects;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE characters;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE locations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Deletes only carry the primary key unless the table replicates full rows.
-- The app matches deletes by id, so the default is enough — but setting FULL
-- on scenes and shots lets a client tell *which* project a deleted row came
-- from, which matters once a device is subscribed to several projects.
ALTER TABLE scenes REPLICA IDENTITY FULL;
ALTER TABLE shots REPLICA IDENTITY FULL;
