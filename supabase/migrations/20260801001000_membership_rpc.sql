-- ============================================================================
-- add_project_member_by_email — invite flow
-- ============================================================================
--
-- Adding a member is the one operation RLS cannot express on its own, and it is
-- worth being explicit about why.
--
-- The owner knows the invitee's email address, not their user id. Resolving
-- email -> id means reading a profile row the owner is not yet allowed to see:
-- `profiles_select_self_or_collaborators` only reveals people you already share
-- a project with, and before the invite they share nothing. A pure-SQL client
-- flow would therefore need profiles to be world-readable, which would turn the
-- table into a directory of every account on the instance.
--
-- Encapsulating it in a SECURITY DEFINER function keeps that lookup on the
-- server, gated by an explicit ownership check, and leaks nothing beyond
-- "an account with this email does or does not exist" to a project owner.

CREATE OR REPLACE FUNCTION public.add_project_member_by_email(
  p_project_id uuid,
  p_email      text
)
RETURNS public.project_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_member  public.project_members;
BEGIN
  -- Authorisation first: this function bypasses RLS, so it must re-establish
  -- the check that RLS would otherwise have made. 42501 maps to a 403.
  IF NOT public.is_project_owner(p_project_id) THEN
    RAISE EXCEPTION 'Only the project owner can add members'
      USING ERRCODE = '42501';
  END IF;

  SELECT id
    INTO v_user_id
    FROM public.profiles
   WHERE lower(email) = lower(trim(p_email));

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user is registered with the email %', p_email
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (p_project_id, v_user_id, 'member')
  -- Re-inviting an existing member is a no-op rather than an error. Notably it
  -- must NOT demote an owner who is re-invited, hence preserving role.
  ON CONFLICT (project_id, user_id)
    DO UPDATE SET role = public.project_members.role
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

COMMENT ON FUNCTION public.add_project_member_by_email(uuid, text) IS
  'Owner-only: resolves an email to a user and adds them to the project.';

REVOKE EXECUTE ON FUNCTION public.add_project_member_by_email(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_project_member_by_email(uuid, text)
  TO authenticated;
