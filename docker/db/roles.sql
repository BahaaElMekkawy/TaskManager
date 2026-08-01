-- Assigns passwords to the service roles that the supabase/postgres image
-- creates during its own bootstrap migrations.
--
-- Each Supabase service connects as its own least-privilege role rather than as
-- a superuser: GoTrue owns the `auth` schema, Storage owns `storage`, and
-- PostgREST connects as `authenticator`, which can do nothing on its own and
-- must SET ROLE to `anon` or `authenticated` based on the request's JWT. That
-- role switch is precisely what makes Row Level Security apply per request.
--
-- Local development only — every service shares POSTGRES_PASSWORD here. A real
-- deployment would issue a distinct secret per role.
--
-- This runs with ON_ERROR_STOP, so a single bare ALTER USER on a role that
-- doesn't exist in a given image version would abort every statement after it
-- — silently skipping later roles' passwords with no obvious error (this is
-- exactly what happened with supabase_functions_admin, which the pinned
-- 15.8.1.060 image does not create, aborting before supabase_storage_admin's
-- password was ever set). Generating the ALTER statements from pg_roles and
-- running them via \gexec means only roles that actually exist are touched,
-- and each runs as an independent statement.
--
-- Note: :'pgpass' substitution only works in top-level psql script text, not
-- inside a dollar-quoted DO $$ ... $$ body — an earlier version of this file
-- wrapped the loop in a DO block and psql left the token un-substituted,
-- producing a syntax error at the literal ':'. \gexec avoids that entirely.

\set pgpass `echo "$POSTGRES_PASSWORD"`

SELECT format('ALTER USER %I WITH PASSWORD %L', rolname, :'pgpass')
FROM pg_roles
WHERE rolname IN (
  'authenticator',
  'pgbouncer',
  'supabase_auth_admin',
  'supabase_functions_admin',
  'supabase_storage_admin'
)
\gexec
