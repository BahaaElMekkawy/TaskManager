-- Publishes the JWT secret to the database as a settings GUC.
--
-- Database-side helpers (and some Supabase internals) read
-- `current_setting('app.settings.jwt_secret')` to verify or mint tokens. Note
-- that PostgREST does NOT read this — it verifies signatures itself using
-- PGRST_JWT_SECRET — so the two values must be kept identical. Both come from
-- the single JWT_SECRET variable in .env to make that impossible to get wrong.

\set jwt_secret `echo "$JWT_SECRET"`
\set jwt_exp    `echo "$JWT_EXPIRY"`

ALTER DATABASE postgres SET "app.settings.jwt_secret" TO :'jwt_secret';
ALTER DATABASE postgres SET "app.settings.jwt_exp"    TO :'jwt_exp';
