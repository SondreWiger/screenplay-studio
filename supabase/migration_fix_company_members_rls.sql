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

CREATE OR REPLACE FUNCTION get_user_company_role(p_company_id UUID, p_user_id UUID)
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
