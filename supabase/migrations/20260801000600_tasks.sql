-- ============================================================================
-- tasks
-- ============================================================================

CREATE TABLE public.tasks (
  id          uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid                 NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  title       text                 NOT NULL,
  description text,
  status      public.task_status   NOT NULL DEFAULT 'todo',
  priority    public.task_priority NOT NULL DEFAULT 'medium',
  due_date    date,

  -- ON DELETE SET NULL, not CASCADE: removing a person from the system should
  -- orphan their assignments, never silently delete the team's work.
  assignee_id uuid                 REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_by  uuid                 REFERENCES public.profiles (id) ON DELETE SET NULL,

  created_at  timestamptz          NOT NULL DEFAULT now(),
  updated_at  timestamptz          NOT NULL DEFAULT now(),

  CONSTRAINT tasks_title_length
    CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  CONSTRAINT tasks_description_length
    CHECK (description IS NULL OR char_length(description) <= 5000)
);

COMMENT ON TABLE public.tasks IS
  'A unit of work inside a project. due_date is a calendar date, not a timestamp.';

COMMENT ON COLUMN public.tasks.due_date IS
  'DATE rather than TIMESTAMPTZ: a deadline of "the 5th" means the same day in '
  'every timezone, and storing it as an instant would shift it across the date '
  'line for some users.';

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- An assignee must belong to the task's project.
--
-- RLS alone cannot express this: policies decide whether the *caller* may write
-- the row, not whether the row's contents are internally consistent. Without
-- this check a member could assign work to an arbitrary user id, leaking that
-- the id exists and producing tasks whose assignee cannot see them.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_assignee_is_project_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM public.project_members
        WHERE project_id = NEW.project_id
          AND user_id    = NEW.assignee_id
     )
  THEN
    RAISE EXCEPTION 'Assignee must be a member of the project'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_assignee_must_be_project_member
  BEFORE INSERT OR UPDATE OF assignee_id, project_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.assert_assignee_is_project_member();
