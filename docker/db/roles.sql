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

\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator            WITH PASSWORD :'pgpass';
ALTER USER pgbouncer                WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin      WITH PASSWORD :'pgpass';
ALTER USER supabase_functions_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin   WITH PASSWORD :'pgpass';
