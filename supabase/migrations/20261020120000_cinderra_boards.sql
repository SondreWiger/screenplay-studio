-- Cinderra boards: the visual tools (mind map, mood board, idea boards and
-- company boards) are now Cinderra boards embedded in an iframe.
--
-- Cinderra holds the board itself: cards, connections, drawing, history. This
-- table is Screenplay Studio's index of which Cinderra board belongs to which
-- project, company or person, and for which tool. Access is decided here and
-- passed to Cinderra on every open (src/lib/cinderra.ts), so removing someone
-- from a project removes them from its boards too.
--
-- Every write goes through /api/cinderra with the service role, after the
-- route has checked membership. RLS only needs to let members read.

CREATE TABLE IF NOT EXISTS public.cinderra_boards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope             text NOT NULL CHECK (scope IN ('project', 'company', 'user')),
  scope_id          uuid NOT NULL,
  tool              text NOT NULL DEFAULT 'board'
                    CHECK (tool IN ('mindmap', 'moodboard', 'ideas', 'board')),
  cinderra_board_id uuid NOT NULL UNIQUE,
  title             text NOT NULL DEFAULT 'Untitled board',
  kind              text NOT NULL DEFAULT 'freeform'
                    CHECK (kind IN ('freeform', 'kanban', 'mindmap')),
  icon              text,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cinderra_boards_scope_idx
  ON public.cinderra_boards (scope, scope_id, tool, created_at);

ALTER TABLE public.cinderra_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cinderra_boards_select ON public.cinderra_boards;
CREATE POLICY cinderra_boards_select ON public.cinderra_boards
  FOR SELECT TO authenticated USING (
    (scope = 'user' AND scope_id = auth.uid())
    OR (scope = 'project' AND public.has_project_access(scope_id, auth.uid()))
    OR (scope = 'company' AND public.is_company_member(scope_id))
  );

-- Verify: should return one row, rls_enabled = true.
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class WHERE relname = 'cinderra_boards';
