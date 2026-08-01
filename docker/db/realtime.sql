-- Schema used by the Realtime service for tenant and subscription bookkeeping.
--
-- Created in the application database (not `_supabase`) because the realtime
-- container connects with DB_NAME=${POSTGRES_DB} and sets its search_path to
-- `_realtime` after connecting. Keep this file and that env var in sync.

CREATE SCHEMA IF NOT EXISTS _realtime;
ALTER SCHEMA _realtime OWNER TO supabase_admin;
