-- Fix is_broadcast_member: projects table uses created_by, not user_id
CREATE OR REPLACE FUNCTION is_broadcast_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
