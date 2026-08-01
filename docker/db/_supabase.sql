-- Creates the internal `_supabase` database.
--
-- Supabase keeps its own operational data (analytics, realtime bookkeeping)
-- out of the application database so that platform internals never appear in
-- the user's schema, never show up in PostgREST's exposed API, and can be
-- dropped independently of application data.

CREATE DATABASE _supabase WITH OWNER supabase_admin;
