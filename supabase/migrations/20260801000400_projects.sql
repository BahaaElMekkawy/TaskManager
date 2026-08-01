-- ============================================================================
-- projects
-- ============================================================================

CREATE TABLE public.projects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References profiles rather than auth.users. Integrity is identical
  -- (profiles.id is itself a cascading FK to auth.users), but it lets PostgREST
  -- embed the owner's name in a single request — `select=*,owner:profiles(*)`.
  -- A foreign key into auth.users would be invisible to the API, forcing a
  -- second round trip just to render "owned by Alice".
  owner_id    uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- trim() in the check stops a whitespace-only name from passing as non-empty.
  CONSTRAINT projects_name_length
    CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  CONSTRAINT projects_description_length
    CHECK (description IS NULL OR char_length(description) <= 2000)
);

COMMENT ON TABLE public.projects IS
  'A project owned by one user and shared with zero or more members.';

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
