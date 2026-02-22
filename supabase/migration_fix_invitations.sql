-- ============================================================
-- Fix Company Invitation System
-- 1. get_invitation_by_token — public lookup for invite pages
-- 2. decline_company_invitation — SECURITY DEFINER (avoids RLS)
-- 3. get_pending_invitations — returns pending invites for current user
-- 4. check_invitations_for_new_user — trigger on profile creation
-- ============================================================

-- 1. Get invitation by token (for /company/invite/[token] page)
-- Uses SECURITY DEFINER so anyone with the link can view it
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv RECORD;
  v_company RECORD;
BEGIN
  SELECT * INTO v_inv FROM company_invitations WHERE token = p_token;
  IF v_inv IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, name, slug, logo_url, brand_color INTO v_company
  FROM companies WHERE id = v_inv.company_id;

  RETURN jsonb_build_object(
    'id', v_inv.id,
    'company_id', v_inv.company_id,
    'email', v_inv.email,
    'role', v_inv.role,
    'accepted', v_inv.accepted,
    'expires_at', v_inv.expires_at,
    'created_at', v_inv.created_at,
    'token', v_inv.token,
    'company', jsonb_build_object(
      'id', v_company.id,
      'name', v_company.name,
      'slug', v_company.slug,
      'logo_url', v_company.logo_url,
      'brand_color', v_company.brand_color
    )
  );
END;
$$;

-- 2. Decline invitation (SECURITY DEFINER so RLS doesn't block it)
CREATE OR REPLACE FUNCTION decline_company_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv company_invitations%ROWTYPE;
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_inv FROM company_invitations WHERE id = p_invitation_id;
  IF v_inv IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Invitation not found');
  END IF;

  -- Verify the current user is the invitee (match by email)
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS DISTINCT FROM v_inv.email THEN
    -- Also allow company admins to revoke
    IF NOT EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = v_inv.company_id AND user_id = v_user_id AND role IN ('owner', 'admin')
    ) THEN
      RAISE EXCEPTION 'Not authorized to decline this invitation';
    END IF;
  END IF;

  DELETE FROM company_invitations WHERE id = p_invitation_id;

  -- Log the decline
  INSERT INTO company_activity_log (company_id, user_id, action, entity_type, metadata)
  VALUES (v_inv.company_id, v_user_id, 'declined_invitation', 'member',
    jsonb_build_object('email', v_inv.email, 'role', v_inv.role));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. Get pending invitations for the current user
CREATE OR REPLACE FUNCTION get_pending_invitations()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(inv_with_company)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT ci.id, ci.company_id, ci.email, ci.role, ci.token, ci.created_at, ci.expires_at,
           c.name as company_name, c.slug as company_slug, c.logo_url as company_logo,
           c.brand_color as company_color,
           p.display_name as invited_by_name
    FROM company_invitations ci
    JOIN companies c ON c.id = ci.company_id
    LEFT JOIN profiles p ON p.id = ci.invited_by
    WHERE ci.email = v_user_email
      AND ci.accepted = false
      AND (ci.expires_at IS NULL OR ci.expires_at > NOW())
    ORDER BY ci.created_at DESC
  ) inv_with_company;

  RETURN v_result;
END;
$$;

-- 4. Trigger: when a new user registers, check if there are pending invitations
-- and create notifications for them
CREATE OR REPLACE FUNCTION check_invitations_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_inv RECORD;
  v_company RECORD;
  v_actor_name TEXT;
BEGIN
  -- Find any pending invitations for this email
  FOR v_inv IN
    SELECT * FROM company_invitations
    WHERE email = NEW.email AND accepted = false
      AND (expires_at IS NULL OR expires_at > NOW())
  LOOP
    SELECT id, name, slug INTO v_company FROM companies WHERE id = v_inv.company_id;

    SELECT COALESCE(display_name, full_name, 'Someone')
    INTO v_actor_name FROM profiles WHERE id = v_inv.invited_by;

    -- Create notification for the newly registered user
    PERFORM create_notification(
      NEW.id, 'company_invitation',
      'You were invited to join ' || v_company.name,
      COALESCE(v_actor_name, 'Someone') || ' invited you as ' || v_inv.role,
      '/company/invite/' || v_inv.token::text,
      v_inv.invited_by, 'company_invitation', v_inv.id,
      jsonb_build_object(
        'company_id', v_company.id,
        'company_name', v_company.name,
        'invitation_id', v_inv.id,
        'role', v_inv.role,
        'token', v_inv.token
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists, create new one on profiles table
DROP TRIGGER IF EXISTS check_invitations_on_signup ON profiles;
CREATE TRIGGER check_invitations_on_signup
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_invitations_for_new_user();

-- Also update the notify_on_company_invitation to include token in action_url
CREATE OR REPLACE FUNCTION notify_on_company_invitation()
RETURNS TRIGGER AS $$
DECLARE
  v_company RECORD;
  v_actor_name TEXT;
  v_target_user UUID;
BEGIN
  SELECT id, name, slug INTO v_company FROM companies WHERE id = NEW.company_id;
  IF v_company IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor_name FROM profiles WHERE id = NEW.invited_by;

  SELECT id INTO v_target_user FROM profiles WHERE email = NEW.email;

  IF v_target_user IS NOT NULL THEN
    PERFORM create_notification(
      v_target_user, 'company_invitation',
      'You were invited to join ' || v_company.name,
      v_actor_name || ' invited you as ' || NEW.role,
      '/company/invite/' || NEW.token::text,
      NEW.invited_by, 'company_invitation', NEW.id,
      jsonb_build_object(
        'company_id', v_company.id,
        'company_name', v_company.name,
        'invitation_id', NEW.id,
        'role', NEW.role,
        'token', NEW.token
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow invited users to read their own invitations
DROP POLICY IF EXISTS "Users can see invitations for their email" ON company_invitations;
CREATE POLICY "Users can see invitations for their email" ON company_invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = company_invitations.company_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
