-- Schema used by the analytics service (Logflare) as its Postgres backend.
-- Lives in the internal `_supabase` database, not the application database.

\c _supabase
CREATE SCHEMA IF NOT EXISTS _analytics;
ALTER SCHEMA _analytics OWNER TO supabase_admin;
\c postgres
