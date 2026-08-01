-- ============================================================================
-- comments
-- ============================================================================

CREATE TABLE public.comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid        NOT NULL REFERENCES public.tasks (id)     ON DELETE CASCADE,
  author_id  uuid        NOT NULL REFERENCES public.profiles (id)  ON DELETE CASCADE,
  message    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT comments_message_length
    CHECK (char_length(trim(message)) BETWEEN 1 AND 4000)
);

COMMENT ON TABLE public.comments IS
  'Immutable-by-convention discussion on a task. Only the author may edit or delete.';

-- No updated_at: the specification defines a comment as author + message +
-- created date. Editing is intentionally out of scope, so there is nothing to
-- stamp. Adding it later is a one-line migration.
