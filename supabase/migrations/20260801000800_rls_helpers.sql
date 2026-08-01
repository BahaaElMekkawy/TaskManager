-- ============================================================================
-- RLS helper functions
-- ============================================================================
--
-- WHY THESE EXIST
--
-- The natural way to write these policies is with a correlated subquery, e.g.
--
--     CREATE POLICY ... ON public.tasks USING (
--       EXISTS (SELECT 1 FROM public.project_members m
--                WHERE m.project_id = tasks.project_id
--                  AND m.user_id = auth.uid())
--     );
--
-- That reads well but is a trap. The subquery touches project_members, whose
-- own SELECT policy touches projects, whose policy touches project_members —
-- and Postgres raises `infinite recursion detected in policy for relation`.
--
-- SECURITY DEFINER breaks the cycle: the function executes as its owner, whose
-- queries are not subject to RLS, so evaluating a policy never re-enters the
-- policy system.
--
-- SAFETY OF THAT CHOICE
--
-- SECURITY DEFINER is a privilege escalation primitive and deserves scrutiny.
-- These functions are safe because:
--
--   * every one is STABLE and returns only a boolean — no row data escapes
--   * every one is scoped to `auth.uid()`, the caller's own identity, which a
--     client cannot forge (it is derived from the JWT signature)
--   * search_path is pinned, so a caller cannot shadow `project_members` with
--     a temp table and trick the function into reading it
--   * EXECUTE is revoked from PUBLIC and anon, and granted only to authenticated

-- ----------------------------------------------------------------------------
-- Is the caller a member (of any role) of this project?
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.project_members
     WHERE project_id = p_project_id
       -- Wrapped in a scalar subselect so the planner evaluates auth.uid()
       -- once per query as an InitPlan, rather than once per candidate row.
       AND user_id    = (SELECT auth.uid())
  );
$$;

-- ----------------------------------------------------------------------------
-- Is the caller the owner of this project? Gates destructive operations.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.project_members
     WHERE project_id = p_project_id
       AND user_id    = (SELECT auth.uid())
       AND role       = 'owner'
  );
$$;

-- ----------------------------------------------------------------------------
-- May the caller see this task? Used by comment policies, which are two joins
-- away from a membership row.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_task(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.tasks t
      JOIN public.project_members m ON m.project_id = t.project_id
     WHERE t.id      = p_task_id
       AND m.user_id = (SELECT auth.uid())
  );
$$;

-- ----------------------------------------------------------------------------
-- Does the caller share at least one project with this user?
--
-- This is what makes the assignee dropdown and comment authorship possible
-- without turning profiles into a directory of every account on the instance.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shares_project_with(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.project_members mine
      JOIN public.project_members theirs ON theirs.project_id = mine.project_id
     WHERE mine.user_id   = (SELECT auth.uid())
       AND theirs.user_id = p_user_id
  );
$$;

-- ----------------------------------------------------------------------------
-- Least privilege on the helpers themselves.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_project_owner(uuid)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_task(uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shares_project_with(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_project_member(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_task(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_project_with(uuid) TO authenticated;
