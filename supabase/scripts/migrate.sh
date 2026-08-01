#!/usr/bin/env bash
#
# Database provisioning for the TaskManager stack.
#
# Runs once per `docker compose up` as the `migrator` service and is responsible
# for everything that would otherwise be a manual setup step:
#
#   1. wait for Postgres to accept connections
#   2. wait for GoTrue to finish creating the `auth` schema
#   3. apply any migration not yet recorded in supabase_migrations.schema_migrations
#   4. seed demo data (users via the GoTrue admin API, domain rows via psql)
#
# The script is idempotent: re-running it applies only new migrations and
# re-seeds nothing. That means `docker compose up` is safe to run repeatedly.

set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/supabase/migrations}"
SEED_DIR="${SEED_DIR:-/supabase/seed}"

AUTH_URL="${AUTH_URL:-http://auth:9999}"
SEED_DATABASE="${SEED_DATABASE:-true}"
SEED_USER_PASSWORD="${SEED_USER_PASSWORD:-Password123!}"

# Fail fast and loudly on any SQL error rather than leaving a half-built schema.
PSQL=(psql --quiet --no-psqlrc --set ON_ERROR_STOP=1)

log()  { printf '[migrator] %s\n' "$*"; }
fail() { printf '[migrator] ERROR: %s\n' "$*" >&2; exit 1; }

# ------------------------------------------------------------------------------
# 1. Wait for Postgres
# ------------------------------------------------------------------------------
wait_for_postgres() {
  log "waiting for postgres at ${PGHOST}:${PGPORT}..."
  for _ in $(seq 1 60); do
    if pg_isready --quiet --host "$PGHOST" --port "$PGPORT" --username "$PGUSER"; then
      log "postgres is accepting connections"
      return 0
    fi
    sleep 1
  done
  fail "postgres did not become ready within 60s"
}

# ------------------------------------------------------------------------------
# 2. Wait for GoTrue's own migrations
#
# Our foreign keys reference auth.users. GoTrue creates and migrates that table
# itself on first boot, and its container reports healthy slightly before the
# table is guaranteed to exist. Polling for the table directly removes the race
# that would otherwise make the very first `docker compose up` fail.
# ------------------------------------------------------------------------------
wait_for_auth_schema() {
  log "waiting for GoTrue to provision the auth schema..."
  for _ in $(seq 1 60); do
    local exists
    exists=$("${PSQL[@]}" --tuples-only --no-align \
      --command "SELECT to_regclass('auth.users') IS NOT NULL;" 2>/dev/null || echo 'f')
    if [ "$exists" = 't' ]; then
      log "auth.users is present"
      return 0
    fi
    sleep 1
  done
  fail "auth.users did not appear within 60s — is the auth service healthy?"
}

# ------------------------------------------------------------------------------
# 3. Migrations
# ------------------------------------------------------------------------------
ensure_migrations_table() {
  # A dedicated schema, not public: PGRST_DB_SCHEMAS exposes every table in
  # `public` over the REST API, and this bookkeeping table has no RLS reason
  # to exist there — an earlier version lived in public.schema_migrations and
  # was readable by anon, leaking migration filenames and timestamps to any
  # caller. Naming matches the Supabase CLI's own convention for the same table.
  "${PSQL[@]}" --command "
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version     text        PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    );
  "
}

migration_applied() {
  local version=$1 result
  result=$("${PSQL[@]}" --tuples-only --no-align \
    --command "SELECT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${version}');")
  [ "$result" = 't' ]
}

apply_migrations() {
  shopt -s nullglob
  local files=("$MIGRATIONS_DIR"/*.sql)
  shopt -u nullglob

  if [ ${#files[@]} -eq 0 ]; then
    log "no migrations found in ${MIGRATIONS_DIR}"
    return 0
  fi

  local applied=0
  for file in "${files[@]}"; do
    local version
    version=$(basename "$file" .sql)

    if migration_applied "$version"; then
      continue
    fi

    log "applying ${version}"
    # --single-transaction so a failing migration leaves no partial schema
    # behind; recording the version inside the same transaction keeps
    # schema_migrations honest even if the container is killed mid-run.
    "${PSQL[@]}" --single-transaction \
      --file "$file" \
      --command "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${version}');" \
      || fail "migration ${version} failed"

    applied=$((applied + 1))
  done

  if [ "$applied" -eq 0 ]; then
    log "schema already up to date (${#files[@]} migrations)"
  else
    log "applied ${applied} migration(s)"
  fi
}

# ------------------------------------------------------------------------------
# 4. Seeding
# ------------------------------------------------------------------------------

# Users are created through the GoTrue admin API rather than by inserting into
# auth.users directly. Hand-writing bcrypt hashes and identity rows is a common
# shortcut, but it silently breaks whenever GoTrue changes its internal schema.
# Going through the API means the seeded accounts are byte-for-byte identical to
# ones created by registering through the UI.
seed_user() {
  local email=$1 display_name=$2
  local response status

  response=$(curl --silent --show-error --write-out '\n%{http_code}' \
    --request POST "${AUTH_URL}/admin/users" \
    --header "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    --header "apikey: ${SERVICE_ROLE_KEY}" \
    --header 'Content-Type: application/json' \
    --data "{
      \"email\": \"${email}\",
      \"password\": \"${SEED_USER_PASSWORD}\",
      \"email_confirm\": true,
      \"user_metadata\": { \"display_name\": \"${display_name}\" }
    }")

  status=$(printf '%s' "$response" | tail -n 1)

  case "$status" in
    200|201)
      log "created user ${email}"
      ;;
    409|422)
      # Already exists — expected on a re-run against an existing volume.
      log "user ${email} already exists, skipping"
      ;;
    *)
      printf '%s\n' "$response" >&2
      fail "failed to create user ${email} (HTTP ${status})"
      ;;
  esac
}

already_seeded() {
  local result
  result=$("${PSQL[@]}" --tuples-only --no-align \
    --command "SELECT EXISTS (SELECT 1 FROM public.projects);" 2>/dev/null || echo 'f')
  [ "$result" = 't' ]
}

seed_database() {
  if [ "$SEED_DATABASE" != 'true' ]; then
    log "SEED_DATABASE is not 'true' — skipping seed"
    return 0
  fi

  if already_seeded; then
    log "database already contains projects — skipping seed"
    return 0
  fi

  log "seeding demo users"
  seed_user 'alice@example.com' 'Alice Johnson'
  seed_user 'bob@example.com'   'Bob Martinez'
  seed_user 'carol@example.com' 'Carol Nguyen'

  if [ -f "${SEED_DIR}/seed.sql" ]; then
    log "seeding demo projects, tasks and comments"
    "${PSQL[@]}" --single-transaction --file "${SEED_DIR}/seed.sql" \
      || fail "seed.sql failed"
  else
    log "no seed.sql found in ${SEED_DIR}"
  fi

  log "seed complete — sign in as alice@example.com / ${SEED_USER_PASSWORD}"
}

# ------------------------------------------------------------------------------
main() {
  wait_for_postgres
  wait_for_auth_schema
  ensure_migrations_table
  apply_migrations
  seed_database
  log "done"
}

main "$@"
