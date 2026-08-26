-- People directory — a personal, cross-project address book.
--
-- Projects come and go; the people don't. This is the book you keep so that
-- when a new production starts you can find the gaffer who was good, the actor
-- who nearly got the part, and the vendor who delivered on time.
--
-- Scoped to the owner, not to a project or a company: it is your book.

CREATE TABLE IF NOT EXISTS people_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'crew'
    CHECK (category IN ('crew', 'talent', 'vendor', 'agent', 'writer', 'producer', 'other')),
  role TEXT,
  department TEXT,

  email TEXT,
  phone TEXT,
  location TEXT,
  agency TEXT,

  day_rate NUMERIC(12, 2),
  currency TEXT DEFAULT 'USD',

  -- { imdb, reel, website, instagram, … }
  links JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],

  -- 1-5, "would you work with them again"
  rating SMALLINT CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  is_favourite BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  last_worked_at DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per production a person worked on. `project_id` is nullable so
-- credits from before (or outside) the app can still be recorded.
CREATE TABLE IF NOT EXISTS people_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people_directory(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  production_name TEXT,
  role TEXT,
  year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT people_credits_has_production
    CHECK (project_id IS NOT NULL OR COALESCE(production_name, '') <> '')
);

CREATE INDEX IF NOT EXISTS people_directory_owner_idx ON people_directory (owner_id, name);
CREATE INDEX IF NOT EXISTS people_directory_category_idx ON people_directory (owner_id, category);
CREATE INDEX IF NOT EXISTS people_directory_tags_idx ON people_directory USING GIN (tags);
CREATE INDEX IF NOT EXISTS people_credits_person_idx ON people_credits (person_id);
CREATE INDEX IF NOT EXISTS people_credits_project_idx ON people_credits (project_id);

ALTER TABLE people_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE people_credits ENABLE ROW LEVEL SECURITY;

-- Owner-only: a private address book, not a shared project resource.
DROP POLICY IF EXISTS "people_directory_owner" ON people_directory;
CREATE POLICY "people_directory_owner" ON people_directory
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "people_credits_owner" ON people_credits;
CREATE POLICY "people_credits_owner" ON people_credits
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
