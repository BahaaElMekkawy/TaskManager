-- ============================================================================
-- Row Level Security
-- ============================================================================
--
-- PRIVILEGE MODEL
--
-- PostgREST connects as `authenticator`, a login role with no rights of its
-- own, then SET ROLEs to `anon` or `authenticated` according to the request's
-- JWT. So table GRANTs decide *which verbs a class of caller may attempt*, and
-- RLS policies decide *which rows they actually touch*. Both must be right.
--
-- `anon` is granted SELECT only. RLS then denies every row, because no policy
-- below names anon. That is deliberate belt-and-braces: even if a future
-- migration adds a careless permissive policy, an anonymous caller still has no
-- INSERT/UPDATE/DELETE privilege to abuse.
--
-- Policies are written per command rather than as a single FOR ALL policy, so
-- that "may read" and "may delete" can never accidentally become the same
-- condition — which is exactly how members would end up able to delete a
-- project out from under its owner.

-- ----------------------------------------------------------------------------
-- Privileges
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.profiles, public.projects, public.project_members,
                public.tasks, public.comments
  TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE
   ON public.profiles, public.projects, public.project_members,
      public.tasks, public.comments
   TO authenticated;

-- ----------------------------------------------------------------------------
-- Enable RLS. Without this, the GRANTs above would expose every row.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments        ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- profiles
-- ============================================================================
-- Visible to yourself, and to anyone you share a project with. Without the
-- second clause the UI could not render "assigned to Bob"; with anything
-- broader, any logged-in user could enumerate every account on the instance.

CREATE POLICY profiles_select_self_or_collaborators
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.shares_project_with(id)
  );

CREATE POLICY profiles_update_self
  ON public.profiles FOR UPDATE TO authenticated
  USING      (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- No INSERT policy: rows are created exclusively by the on_auth_user_created
-- trigger. No DELETE policy: profiles disappear with their auth.users row.

-- ============================================================================
-- projects
-- ============================================================================

CREATE POLICY projects_select_members
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(id));

-- WITH CHECK pins owner_id to the caller, so a user cannot create a project
-- that claims to belong to someone else.
CREATE POLICY projects_insert_self_as_owner
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- Both USING and WITH CHECK: USING selects which rows may be updated, WITH
-- CHECK validates the row *after* the update. Omitting WITH CHECK would let an
-- owner reassign owner_id to another user and lock themselves out.
CREATE POLICY projects_update_owner
  ON public.projects FOR UPDATE TO authenticated
  USING      (public.is_project_owner(id))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY projects_delete_owner
  ON public.projects FOR DELETE TO authenticated
  USING (public.is_project_owner(id));

-- ============================================================================
-- project_members
-- ============================================================================
-- Members may see who else is on the project; only the owner may change it.

CREATE POLICY project_members_select_members
  ON public.project_members FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY project_members_insert_owner
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY project_members_update_owner
  ON public.project_members FOR UPDATE TO authenticated
  USING      (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

-- An owner may remove anyone but themselves; a member may remove only
-- themselves, i.e. leave the project. Deleting the owner's own membership row
-- would strand the project with no one able to administer it.
CREATE POLICY project_members_delete_owner_or_self
  ON public.project_members FOR DELETE TO authenticated
  USING (
    (public.is_project_owner(project_id) AND user_id <> (SELECT auth.uid()))
    OR (user_id = (SELECT auth.uid()) AND role <> 'owner')
  );

-- ============================================================================
-- tasks
-- ============================================================================
-- Any member may manage tasks. Restricting edits to the task's creator would
-- defeat the point of a shared board.

CREATE POLICY tasks_select_members
  ON public.tasks FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY tasks_insert_members
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id));

-- WITH CHECK re-tests membership on the resulting row, which blocks moving a
-- task into a project the caller does not belong to.
CREATE POLICY tasks_update_members
  ON public.tasks FOR UPDATE TO authenticated
  USING      (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY tasks_delete_members
  ON public.tasks FOR DELETE TO authenticated
  USING (public.is_project_member(project_id));

-- ============================================================================
-- comments
-- ============================================================================
-- Readable by everyone on the project; writable only by their author.

CREATE POLICY comments_select_project_members
  ON public.comments FOR SELECT TO authenticated
  USING (public.can_access_task(task_id));

CREATE POLICY comments_insert_own
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.can_access_task(task_id)
  );

CREATE POLICY comments_update_own
  ON public.comments FOR UPDATE TO authenticated
  USING      (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));

CREATE POLICY comments_delete_own
  ON public.comments FOR DELETE TO authenticated
  USING (author_id = (SELECT auth.uid()));
