-- ============================================================
-- FIX: Infinite recursion in RLS policies for ALL tables
--
-- The problem: Every table's RLS policy references project_members,
-- whose own SELECT policy references project_members again → loop.
--
-- The fix: SECURITY DEFINER helper functions that bypass RLS.
-- Run this entire file in the Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- STEP 1: Create helper functions (bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_project_access(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND created_by = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_project_write_access(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND created_by = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
    AND role IN ('owner', 'admin', 'writer', 'editor')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_project_owner_or_admin(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND created_by = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_script_access(p_script_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.scripts s
    JOIN public.projects p ON s.project_id = p.id
    WHERE s.id = p_script_id AND p.created_by = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.scripts s
    JOIN public.project_members pm ON s.project_id = pm.project_id
    WHERE s.id = p_script_id AND pm.user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- STEP 2: Drop ALL existing policies
-- ============================================================

-- projects
DROP POLICY IF EXISTS "Project members can view projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
DROP POLICY IF EXISTS "Project owners and admins can update projects" ON projects;
DROP POLICY IF EXISTS "Project owners can delete projects" ON projects;

-- project_members
DROP POLICY IF EXISTS "Project members can view other members" ON project_members;
DROP POLICY IF EXISTS "Project owners and admins can manage members" ON project_members;
DROP POLICY IF EXISTS "Project owners and admins can update members" ON project_members;
DROP POLICY IF EXISTS "Project owners and admins can remove members" ON project_members;

-- scripts
DROP POLICY IF EXISTS "Script access follows project access" ON scripts;
DROP POLICY IF EXISTS "Writers can create scripts" ON scripts;
DROP POLICY IF EXISTS "Writers can update scripts" ON scripts;
DROP POLICY IF EXISTS "Owners can delete scripts" ON scripts;

-- script_elements
DROP POLICY IF EXISTS "Script elements follow script access" ON script_elements;
DROP POLICY IF EXISTS "Writers can insert elements" ON script_elements;
DROP POLICY IF EXISTS "Writers can update elements" ON script_elements;
DROP POLICY IF EXISTS "Writers can delete elements" ON script_elements;

-- characters
DROP POLICY IF EXISTS "Characters follow project access" ON characters;

-- locations
DROP POLICY IF EXISTS "Locations follow project access" ON locations;

-- scenes
DROP POLICY IF EXISTS "Scenes follow project access" ON scenes;

-- shots
DROP POLICY IF EXISTS "Shots follow project access" ON shots;

-- production_schedule
DROP POLICY IF EXISTS "Schedule follows project access" ON production_schedule;

-- ideas
DROP POLICY IF EXISTS "Ideas follow project access" ON ideas;

-- budget_items
DROP POLICY IF EXISTS "Budget follows project access" ON budget_items;

-- comments
DROP POLICY IF EXISTS "Comments follow project access" ON comments;

-- revisions
DROP POLICY IF EXISTS "Revisions follow script access" ON revisions;

-- user_presence
DROP POLICY IF EXISTS "Presence follows project access" ON user_presence;

-- ============================================================
-- STEP 3: Recreate ALL policies using helper functions
-- ============================================================

-- ---- PROJECTS ----
CREATE POLICY "Project members can view projects"
  ON projects FOR SELECT USING (
    created_by = auth.uid()
    OR public.is_project_member(id, auth.uid())
  );

CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project owners and admins can update projects"
  ON projects FOR UPDATE USING (
    public.is_project_owner_or_admin(id, auth.uid())
  );

CREATE POLICY "Project owners can delete projects"
  ON projects FOR DELETE USING (created_by = auth.uid());

-- ---- PROJECT MEMBERS ----
CREATE POLICY "Project members can view other members"
  ON project_members FOR SELECT USING (
    user_id = auth.uid()
    OR public.has_project_access(project_id, auth.uid())
  );

CREATE POLICY "Project owners and admins can manage members"
  ON project_members FOR INSERT WITH CHECK (
    public.is_project_owner_or_admin(project_id, auth.uid())
  );

CREATE POLICY "Project owners and admins can update members"
  ON project_members FOR UPDATE USING (
    public.is_project_owner_or_admin(project_id, auth.uid())
  );

CREATE POLICY "Project owners and admins can remove members"
  ON project_members FOR DELETE USING (
    user_id = auth.uid()
    OR public.is_project_owner_or_admin(project_id, auth.uid())
  );

-- ---- SCRIPTS ----
CREATE POLICY "Script access follows project access"
  ON scripts FOR SELECT USING (
    public.has_project_access(project_id, auth.uid())
  );

CREATE POLICY "Writers can create scripts"
  ON scripts FOR INSERT WITH CHECK (
    public.has_project_write_access(project_id, auth.uid())
  );

CREATE POLICY "Writers can update scripts"
  ON scripts FOR UPDATE USING (
    public.has_project_write_access(project_id, auth.uid())
  );

CREATE POLICY "Owners can delete scripts"
  ON scripts FOR DELETE USING (
    public.is_project_owner_or_admin(project_id, auth.uid())
  );

-- ---- SCRIPT ELEMENTS ----
CREATE POLICY "Script elements follow script access"
  ON script_elements FOR SELECT USING (
    public.has_script_access(script_id, auth.uid())
  );

CREATE POLICY "Writers can insert elements"
  ON script_elements FOR INSERT WITH CHECK (
    public.has_script_access(script_id, auth.uid())
  );

CREATE POLICY "Writers can update elements"
  ON script_elements FOR UPDATE USING (
    public.has_script_access(script_id, auth.uid())
  );

CREATE POLICY "Writers can delete elements"
  ON script_elements FOR DELETE USING (
    public.has_script_access(script_id, auth.uid())
  );

-- ---- CHARACTERS ----
CREATE POLICY "Characters follow project access"
  ON characters FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- LOCATIONS ----
CREATE POLICY "Locations follow project access"
  ON locations FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- SCENES ----
CREATE POLICY "Scenes follow project access"
  ON scenes FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- SHOTS ----
CREATE POLICY "Shots follow project access"
  ON shots FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- SCHEDULE ----
CREATE POLICY "Schedule follows project access"
  ON production_schedule FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- IDEAS ----
CREATE POLICY "Ideas follow project access"
  ON ideas FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- BUDGET ----
CREATE POLICY "Budget follows project access"
  ON budget_items FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- COMMENTS ----
CREATE POLICY "Comments follow project access"
  ON comments FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- REVISIONS ----
CREATE POLICY "Revisions follow script access"
  ON revisions FOR ALL USING (
    public.has_script_access(script_id, auth.uid())
  );

-- ---- PRESENCE ----
CREATE POLICY "Presence follows project access"
  ON user_presence FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );
