# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

`TaskManager` — a software engineering interview take-home assignment (see
`Software Engineering Take-Home Assignment.pdf`, gitignored, not committed).
A task management web app: React + TypeScript frontend, self-hosted Supabase
backend (Postgres + GoTrue + PostgREST behind Kong), Row Level Security as
the actual authorization layer. Full requirements and rationale are in
`README.md` — read that first for anything architectural.

**Status as of 2026-08-01: feature-complete, verified end-to-end, 18 commits.**
Build succeeds, 93 unit/component tests pass, 15 RLS integration tests pass
against the live stack, manual browser QA done (login, projects, tasks,
filters, pagination, comments, status changes all confirmed working).

## Commit style

Plain conventional-commit messages: `feat(scope): summary`, `fix(scope): ...`,
`test(scope): ...`, `docs: ...`. **No `Co-Authored-By: Claude` trailer** — the
user explicitly wants AI attribution left out of this repo's git history. Only
commit when asked; prefer several small commits over one large one when doing
multi-part work, matching the existing history (`git log --oneline`).

## How to run it

```bash
cp .env.example .env      # only if .env doesn't already exist
docker compose up --build
```

That's the whole setup — migrations and seed data apply automatically via
the one-shot `migrator` service. App: http://localhost:3000. Studio (DB
browser): http://localhost:3001. Demo login: `alice@example.com` /
`Password123!` (also `bob@`, `carol@` — see README's Demo accounts table for
who owns/collaborates on what).

**After any change to `supabase/migrations/`, `docker/`, or `docker-compose.yml`,
verify against a truly clean volume, not a reused one:**

```bash
docker compose down -v && docker compose up -d --build
docker compose ps                 # everything healthy, migrator Exited (0)
docker compose logs migrator      # confirm it seeded, not just applied schema
```

Several real bugs (see "Known infra gotchas" below) were invisible against a
reused volume and only showed up on a genuinely fresh one — don't skip this
step when touching infra.

## How to test it

```bash
cd web
npm run typecheck && npm run lint && npm test    # fast, no stack needed
npm run build                                     # production build
npm run test:integration                          # needs the stack running (see below)
```

`npm run test:integration` runs `web/src/test/integration/rls.int.test.ts`
against the **live** stack (real network calls, real seeded users, no
mocking) — it's the actual proof RLS works, not just that the TypeScript is
self-consistent. Requires `docker compose up` to already be running and
seeded; it signs in as alice/bob/carol and reads `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` from the repo-root `.env` (via
`vitest.integration.config.ts`'s `envDir`).

## Architecture, in one paragraph

No custom backend service — Supabase *is* the backend. `supabase-js` in the
React app talks to PostgREST through Kong; PostgREST connects as a
low-privilege `authenticator` role and switches to `anon`/`authenticated`
per request based on the caller's JWT, which is what makes Row Level
Security apply per user. Every table's access rules live in SQL
(`supabase/migrations/`), enforced no matter what client is asking — the
app, `curl`, or Studio. Components never import the Supabase client
directly: each feature under `web/src/features/*` exposes `api.ts` (typed
functions wrapping `supabase-js`) and `hooks.ts` (TanStack Query bindings
over `api.ts`) — keep new features following that pattern.

## Data model / RLS, briefly

Projects are shareable (`project_members`: owner + invited members, not
single-owner) — "your data" means "a project you're a member of." Four
`SECURITY DEFINER` helper functions (`is_project_member`,
`is_project_owner`, `can_access_task`, `shares_project_with` — in
`20260801000800_rls_helpers.sql`) exist specifically because writing RLS
policies as direct cross-table subqueries causes Postgres to reject them as
infinite recursion. Adding a project member goes through the
`add_project_member_by_email` RPC, not a plain insert, because resolving an
email to a user id needs a `profiles` read the caller isn't allowed to make
directly under RLS. Full reasoning for every non-obvious schema/RLS choice
is in README's "Design decisions" section — check there before changing
the schema.

## Known infra gotchas (already fixed — don't reintroduce)

These were real bugs found by testing a clean volume; if you touch the
`docker/db/*.sql` init scripts or `docker-compose.yml`, be aware of them:

- **`auth.uid()`/`auth.role()` ownership**: the `supabase/postgres` image
  pre-creates these owned by `postgres`; GoTrue connects as
  `supabase_auth_admin` and needs to `CREATE OR REPLACE` them, which
  requires ownership. Fixed by transferring ownership in
  `docker/db/auth-ownership.sql`, which must run before GoTrue starts.
- **Role password script must not abort on a missing role**:
  `docker/db/roles.sql` sets several service role passwords. This image
  version doesn't create `supabase_functions_admin`, and the script runs
  with `ON_ERROR_STOP` — a bare `ALTER USER` on a role that doesn't exist
  aborts every statement after it in the same file. Fixed by generating
  ALTERs from `pg_roles` via `\gexec` so only existing roles are touched.
- **Realtime's `DB_ENC_KEY` must be exactly 16 characters** (AES-128-ECB) —
  it's `REALTIME_DB_ENC_KEY` in `.env`/`.env.example`; don't shorten or
  lengthen it without checking.
- **Web container healthcheck must use `127.0.0.1`, not `localhost`** —
  this image resolves `localhost` to `::1` first, and nginx only listens on
  IPv4, so `localhost` always reports unhealthy despite serving traffic fine.
- **`schema_migrations` lives in its own schema** (`supabase_migrations`,
  not `public`) — anything in `public` is exposed over the REST API by
  `PGRST_DB_SCHEMAS`, and this internal bookkeeping table was previously
  world-readable via `curl .../rest/v1/schema_migrations`. Don't move it
  back to `public`.

## Things AI tools get wrong here if you're not careful

- Don't hand-write bcrypt hashes into `auth.users` for seed users — go
  through the **GoTrue admin API** (see `supabase/scripts/migrate.sh`), or
  seeded accounts silently diverge from ones created via real registration.
- Don't reference `auth.users` directly in a new foreign key if the API
  needs to embed the related row — PostgREST can't embed through it
  (outside `PGRST_DB_SCHEMAS`). Point at `public.profiles` instead (see the
  comments in `20260801000400_projects.sql`).
- Foreign-key `git add`/multi-commit staging: `git add` state persists
  across separate tool calls within a turn — if you stage files in one
  call and commit in a later call without checking `git status` first, an
  earlier unrelated staged change can get swept into the wrong commit. This
  actually happened once during this build (see commit history around
  `fix(db): reference profiles...`) and required a `git reset --soft` to
  unwind. Check `git status --short` before every commit.
