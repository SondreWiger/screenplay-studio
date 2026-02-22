-- ============================================================
-- Fix: accept_company_invitation role casting
-- Error: column "role" is of type user_role but expression is of type text
-- Fix: Explicitly cast the role value to avoid type mismatch
-- ============================================================

CREATE OR REPLACE FUNCTION accept_company_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv company_invitations%ROWTYPE;
  v_user_id UUID;
  v_company_name TEXT;
  v_role_text TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch the invitation
  SELECT * INTO v_inv FROM company_invitations WHERE id = p_invitation_id;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  -- Check it hasn't already been accepted
  IF v_inv.accepted THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Already accepted');
  END IF;

  -- Check it hasn't expired
  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < NOW() THEN
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- Extract role as text for safe casting
  v_role_text := v_inv.role::text;

  -- Mark invitation as accepted
  UPDATE company_invitations SET accepted = true WHERE id = p_invitation_id;

  -- Insert into company_members with explicit role cast
  -- Use text intermediate to avoid enum-to-enum casting issues
  EXECUTE format(
    'INSERT INTO company_members (company_id, user_id, role, invited_by)
     VALUES ($1, $2, $3::%I, $4)
     ON CONFLICT (company_id, user_id) DO UPDATE SET role = $3::%I',
    (SELECT typname FROM pg_type WHERE oid = (
      SELECT atttypid FROM pg_attribute
      WHERE attrelid = 'company_members'::regclass AND attname = 'role'
    )),
    (SELECT typname FROM pg_type WHERE oid = (
      SELECT atttypid FROM pg_attribute
      WHERE attrelid = 'company_members'::regclass AND attname = 'role'
    ))
  ) USING v_inv.company_id, v_user_id, v_role_text, v_inv.invited_by;

  -- Update profile company_id
  UPDATE profiles SET company_id = v_inv.company_id WHERE id = v_user_id;

  -- Get company name for response
  SELECT name INTO v_company_name FROM companies WHERE id = v_inv.company_id;

  -- Log activity
  INSERT INTO company_activity_log (company_id, user_id, action, entity_type, metadata)
  VALUES (v_inv.company_id, v_user_id, 'accepted_invitation', 'member',
    jsonb_build_object('role', v_role_text));

  RETURN jsonb_build_object('ok', true, 'company_id', v_inv.company_id, 'company_name', v_company_name);
END;
$$;
