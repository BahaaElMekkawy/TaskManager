-- ============================================================================
-- Indexes
-- ============================================================================
--
-- Two distinct needs are served here:
--
--   1. the filters and sorts the task list issues on every page load
--   2. the membership lookups that EVERY RLS policy performs
--
-- (2) is easy to overlook. is_project_member() runs for each row considered by
-- a policy, so an unindexed project_members turns every query in the app into a
-- sequential scan of the membership table.

-- ----------------------------------------------------------------------------
-- Membership — the hot path for RLS.
-- ----------------------------------------------------------------------------
-- The primary key already covers (project_id, user_id). This covers lookups
-- that lead with user_id, i.e. "which projects am I in?".
CREATE INDEX project_members_user_id_idx
  ON public.project_members (user_id);

CREATE INDEX projects_owner_id_idx
  ON public.projects (owner_id);

-- ----------------------------------------------------------------------------
-- Task list: filters are almost always scoped to one project first, so each
-- index leads with project_id. A standalone index on status would be nearly
-- useless — with three possible values it is not selective enough to beat a
-- scan, but as the second column of a project-scoped index it is.
-- ----------------------------------------------------------------------------
CREATE INDEX tasks_project_id_created_at_idx
  ON public.tasks (project_id, created_at DESC);

CREATE INDEX tasks_project_id_status_idx
  ON public.tasks (project_id, status);

CREATE INDEX tasks_project_id_priority_idx
  ON public.tasks (project_id, priority);

CREATE INDEX tasks_project_id_due_date_idx
  ON public.tasks (project_id, due_date);

-- Partial: the majority of tasks are unassigned, and those rows are dead weight
-- in an index that exists to answer "what is assigned to this person?".
CREATE INDEX tasks_assignee_id_idx
  ON public.tasks (assignee_id)
  WHERE assignee_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Search by title.
--
-- The UI issues `title ILIKE '%term%'`. A leading wildcard makes a B-tree index
-- unusable, so this is a trigram GIN index — the one index type that can serve
-- an infix match.
-- ----------------------------------------------------------------------------
CREATE INDEX tasks_title_trgm_idx
  ON public.tasks
  USING gin (title extensions.gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- Comment threads are always read newest-last for one task.
-- ----------------------------------------------------------------------------
CREATE INDEX comments_task_id_created_at_idx
  ON public.comments (task_id, created_at);

CREATE INDEX comments_author_id_idx
  ON public.comments (author_id);
