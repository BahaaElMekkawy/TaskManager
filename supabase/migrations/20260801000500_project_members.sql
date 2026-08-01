-- ============================================================================
-- project_members — the collaboration model
-- ============================================================================
--
-- The specification asks for an optional task assignee. An assignee is only
-- meaningful if a project can involve more than one person, so projects are
-- shareable: one owner plus any number of members.
--
-- This also gives "users can only access their own data" a precise definition:
-- a row is yours if you are a member of the project it belongs to. Every RLS
-- policy in this schema ultimately resolves to a lookup against this table.

CREATE TABLE public.project_members (
  project_id uuid              NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id    uuid              NOT NULL REFERENCES auth.users (id)      ON DELETE CASCADE,
  role       public.project_role NOT NULL DEFAULT 'member',
  created_at timestamptz       NOT NULL DEFAULT now(),

  PRIMARY KEY (project_id, user_id)
);

COMMENT ON TABLE public.project_members IS
  'Membership join table. Access control for the whole schema resolves here.';

-- ----------------------------------------------------------------------------
-- Every project gets its owner as a member, automatically.
--
-- Doing this in a trigger rather than in the client guarantees the invariant
-- holds no matter how the row was created — through the UI, through a seed
-- script, or through a direct psql session. If the client were responsible,
-- a failed second request would leave a project nobody could see, including
-- the person who just created it.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();
