-- Fix: infinite recursion in company_members RLS policies
--
-- Root cause: any SELECT policy that queries company_members inside its USING
-- clause without going through a SECURITY DEFINER function will recurse.
-- The helper functions below bypass RLS (SECURITY DEFINER), breaking the cycle.

-- ── 1. Re-create helper functions as SECURITY DEFINER ────────────────────────

CREATE OR REPLACE FUNCTION get_user_company_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER   -- bypasses RLS on company_members
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM company_members WHERE user_id = p_user_id;
$$;

-- Must drop with CASCADE — dependent policies on companies, company_teams,
-- company_team_members, company_blog_posts, company_blog_comments, projects
-- will be dropped and recreated below.
DROP FUNCTION IF EXISTS get_user_company_role(UUID, UUID) CASCADE;

CREATE FUNCTION get_user_company_role(p_company_id UUID, p_user_id UUID)
RETURNS TEXT        -- TEXT is safe even if company_role enum doesn't exist yet
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role::TEXT
  FROM company_members
  WHERE company_id = p_company_id AND user_id = p_user_id
  LIMIT 1;
$$;

-- ── 2. Drop ALL existing company_members SELECT policies ─────────────────────
-- (names may differ on the live DB so we drop every possible variant)

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'company_members' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON company_members', pol.policyname);
  END LOOP;
END $$;

-- ── 3. Re-create the SELECT policy using the SECURITY DEFINER helpers ────────

CREATE POLICY "company_members_select"
  ON company_members FOR SELECT
  USING (
    -- user is a member of the company (via bypass function — no recursion)
    company_id IN (SELECT get_user_company_ids(auth.uid()))
    -- or the user is the company owner
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    -- or the company has a public page
    OR company_id IN (SELECT id FROM companies WHERE public_page_enabled = true)
  );

-- ── 4. Re-create INSERT / UPDATE / DELETE policies using helpers ─────────────

DROP POLICY IF EXISTS "Company admins can add members"    ON company_members;
DROP POLICY IF EXISTS "Company admins can update members" ON company_members;
DROP POLICY IF EXISTS "Company admins can remove members" ON company_members;
DROP POLICY IF EXISTS "company_members_insert"            ON company_members;
DROP POLICY IF EXISTS "company_members_update"            ON company_members;
DROP POLICY IF EXISTS "company_members_delete"            ON company_members;

CREATE POLICY "company_members_insert"
  ON company_members FOR INSERT
  WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "company_members_update"
  ON company_members FOR UPDATE
  USING (
    user_id = auth.uid()
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

CREATE POLICY "company_members_delete"
  ON company_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

-- ── 5. Recreate policies that were CASCADE-dropped ───────────────────────────

-- companies
CREATE POLICY "Company admins can update"
  ON companies FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR get_user_company_role(id, auth.uid()) IN ('owner', 'admin')
  );

-- company_teams
CREATE POLICY "Company admins can manage teams"
  ON company_teams FOR ALL
  USING (
    get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  );

-- company_team_members
CREATE POLICY "Company admins manage team members"
  ON company_team_members FOR ALL
  USING (
    get_user_company_role(
      (SELECT company_id FROM company_teams WHERE id = team_id),
      auth.uid()
    ) IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    get_user_company_role(
      (SELECT company_id FROM company_teams WHERE id = team_id),
      auth.uid()
    ) IN ('owner', 'admin', 'manager')
  );

-- company_blog_posts
CREATE POLICY "Company members can create blog posts"
  ON company_blog_posts FOR INSERT
  WITH CHECK (
    get_user_company_role(company_id, auth.uid()) IS NOT NULL
  );

CREATE POLICY "Blog post authors and admins can update"
  ON company_blog_posts FOR UPDATE
  USING (
    author_id = auth.uid()
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

CREATE POLICY "Company admins can delete blog posts"
  ON company_blog_posts FOR DELETE
  USING (
    author_id = auth.uid()
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

-- company_blog_comments
CREATE POLICY "Comment authors and admins can delete"
  ON company_blog_comments FOR DELETE
  USING (
    author_id = auth.uid()
    OR get_user_company_role(
      (SELECT company_id FROM company_blog_posts WHERE id = post_id),
      auth.uid()
    ) IN ('owner', 'admin')
  );

-- projects (company-scoped)
CREATE POLICY "Company admins can create company projects"
  ON projects FOR INSERT
  WITH CHECK (
    company_id IS NULL
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "Company admins can update company projects"
  ON projects FOR UPDATE
  USING (
    company_id IS NULL
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "Company owners can delete company projects"
  ON projects FOR DELETE
  USING (
    company_id IS NULL
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );
