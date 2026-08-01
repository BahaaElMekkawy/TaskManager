-- ============================================================================
-- Extensions and shared helper functions
-- ============================================================================

-- pg_trgm backs the trigram index on tasks.title, so the "search by title"
-- requirement uses an index instead of a sequential ILIKE scan. Installed into
-- the `extensions` schema per Supabase convention, which keeps the public
-- schema (and therefore the generated API surface) free of extension objects.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- Keeps updated_at honest.
--
-- Deliberately a trigger rather than a client-supplied column: the API is
-- publicly reachable, so a client could otherwise backdate a record simply by
-- sending its own updated_at. The database is the only trustworthy clock here.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'BEFORE UPDATE trigger: stamps updated_at with the server clock.';
