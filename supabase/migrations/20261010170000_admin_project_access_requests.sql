-- Migration: Admin Project Access Requests
-- Allows platform administrators to request moderatory (read + comment) access to projects.
-- Only project owners may accept or deny access requests.
-- Accepted requests grant the admin 'viewer' role with job_title 'Platform Moderator'.

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_project_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_type TEXT NOT NULL DEFAULT 'standard' CHECK (reason_type IN ('standard', 'custom')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'denied', 'revoked')),
  access_type TEXT NOT NULL DEFAULT 'moderation_view' CHECK (access_type IN ('moderation_view', 'full_edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  response_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_project_access_project_id ON public.admin_project_access_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_admin_project_access_owner_id ON public.admin_project_access_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_admin_project_access_requester_id ON public.admin_project_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_admin_project_access_status ON public.admin_project_access_requests(status);

ALTER TABLE public.admin_project_access_requests ENABLE ROW LEVEL SECURITY;

-- Project owners can view requests for their projects; requesters & admins can view
DROP POLICY IF EXISTS "owners_view_project_access_requests" ON public.admin_project_access_requests;
CREATE POLICY "owners_view_project_access_requests" ON public.admin_project_access_requests
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = admin_project_access_requests.project_id
        AND projects.created_by = auth.uid()
    )
    OR requester_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'moderator')
    )
  );

-- Project owners can update (accept/deny) requests for their projects
DROP POLICY IF EXISTS "owners_update_project_access_requests" ON public.admin_project_access_requests;
CREATE POLICY "owners_update_project_access_requests" ON public.admin_project_access_requests
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = admin_project_access_requests.project_id
        AND projects.created_by = auth.uid()
    )
  );

-- Admins and moderators can insert requests
DROP POLICY IF EXISTS "admins_insert_project_access_requests" ON public.admin_project_access_requests;
CREATE POLICY "admins_insert_project_access_requests" ON public.admin_project_access_requests
  FOR INSERT WITH CHECK (
    requester_id = auth.uid()
    AND (
      auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'moderator')
      )
    )
  );

COMMIT;
