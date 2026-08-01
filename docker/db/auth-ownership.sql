-- Transfers ownership of auth.uid()/auth.role() to supabase_auth_admin.
--
-- The supabase/postgres image pre-creates these two helper functions (owned
-- by `postgres`) so application migrations can reference auth.uid() in RLS
-- policies immediately. GoTrue's own bootstrap migration then tries to
-- `CREATE OR REPLACE` the very same functions, connected as
-- `supabase_auth_admin` — which fails with "must be owner of function uid"
-- (42501), since REPLACE requires ownership. Transferring ownership here,
-- before GoTrue ever starts, resolves the conflict without touching GoTrue's
-- own migration.
--
-- Guarded with existence checks since which functions a given image version
-- pre-creates is not part of any documented contract.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'role'
  ) THEN
    ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;
  END IF;
END $$;
