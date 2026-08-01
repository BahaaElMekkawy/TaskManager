-- ============================================================================
-- profiles — the application-visible mirror of auth.users
-- ============================================================================
--
-- auth.users is owned by GoTrue and contains credential material (password
-- hashes, recovery tokens, confirmation tokens). It must never be exposed
-- through the API. But the UI still needs to show who a task is assigned to
-- and who wrote a comment.
--
-- profiles solves that: a narrow, safe projection of a user that RLS can gate
-- independently. Every foreign key that means "a person" in this schema points
-- at profiles, never at auth.users.

CREATE TABLE public.profiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email        text        NOT NULL,
  display_name text        NOT NULL,
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT profiles_display_name_length
    CHECK (char_length(trim(display_name)) BETWEEN 1 AND 80)
);

COMMENT ON TABLE public.profiles IS
  'Public profile per auth user. Safe to expose; auth.users is not.';

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Provisioning a profile for every new user.
--
-- SECURITY DEFINER because the trigger fires inside GoTrue's transaction, where
-- the effective role has no rights on public.profiles. Without it, every
-- registration would fail.
--
-- search_path is pinned: a SECURITY DEFINER function that resolves object names
-- through a caller-controlled search_path is a privilege-escalation vector.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    -- Fall back to the local part of the email when the client did not supply
    -- a display name, so display_name is never blank in the UI.
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep the mirrored email in step when a user changes it via GoTrue.
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
     SET email = NEW.email
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_change();
