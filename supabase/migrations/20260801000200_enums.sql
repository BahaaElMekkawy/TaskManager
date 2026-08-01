-- ============================================================================
-- Domain enumerations
-- ============================================================================
--
-- Modelled as native Postgres enums rather than text + CHECK constraints:
--
--   * invalid values are rejected by the database, not merely by the client
--   * PostgREST advertises the allowed values in its OpenAPI output
--   * the generated TypeScript types become real string unions, so an invalid
--     status is a compile error in the frontend rather than a runtime 400
--
-- Trade-off: adding a value later requires an ALTER TYPE migration, which is
-- slightly heavier than editing a CHECK constraint. Given that these three
-- status values and three priority values come straight from the specification
-- and are unlikely to churn, the type-safety win is worth it.

CREATE TYPE public.task_status   AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.project_role  AS ENUM ('owner', 'member');
