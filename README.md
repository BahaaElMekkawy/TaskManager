# TaskManager

A task management web application: authenticated users create projects, invite
collaborators, and manage tasks with search, filtering, and comments — built
entirely on a self-hosted local Supabase stack.

```
cp .env.example .env
docker compose up --build
```

Then open **http://localhost:3000** and sign in as `alice@example.com` /
`Password123!` (see [Demo accounts](#demo-accounts)).

---

## Table of contents

- [Project overview](#project-overview)
- [Architecture overview](#architecture-overview)
- [Folder structure](#folder-structure)
- [Setup instructions](#setup-instructions)
- [Running the application](#running-the-application)
- [Running the tests](#running-the-tests)
- [Assumptions](#assumptions)
- [Design decisions](#design-decisions)
- [Known limitations](#known-limitations)
- [Future improvements](#future-improvements)

---

## Project overview

Users register and log in, create **projects**, invite other registered users
to collaborate on a project, and manage **tasks** within it — title,
description, status (Todo / In Progress / Done), priority (Low / Medium /
High), due date, and an optional assignee. Tasks support threaded
**comments**. Task lists support free-text search by title, filtering by
status/priority/assignee/due date, and pagination.

Authorization is enforced by PostgreSQL **Row Level Security**, not by
application code: every table's access rules live in SQL and apply no matter
which client issues the request — the React app, `curl`, or Supabase Studio.

## Architecture overview

There is no custom backend service. Supabase *is* the backend:

```
Browser ──► nginx (web:3000, static SPA)
   │
   └──► Kong (:8000) ──┬──► GoTrue      /auth/v1    (registration, login, JWTs)
                        ├──► PostgREST   /rest/v1    (public schema → REST API)
                        └──► pg-meta     /pg/        (schema introspection)
                                              │
                                              ▼
                                         PostgreSQL
                                     (RLS enforced here)

Supabase Studio (:3001) ──► pg-meta ──► PostgreSQL   (browse schema & data)
migrator (one-shot)     ──► migrations + seed ──► PostgreSQL
```

- **React SPA** (Vite + TypeScript + React Router + TanStack Query) talks to
  Postgres exclusively through `supabase-js`, which calls PostgREST via Kong.
  There is no application-layer authorization check anywhere in the frontend —
  it would be redundant with, and could drift from, the database's own rules.
- **PostgREST** turns the `public` schema into a REST API. It connects as a
  low-privilege `authenticator` role and switches to `anon` or `authenticated`
  per request based on the caller's JWT — that role switch is what makes RLS
  apply differently per user.
- **GoTrue** issues the JWTs that carry each user's identity (`auth.uid()`).
- **PostgreSQL** is where the actual authorization logic lives: every table
  has RLS enabled with explicit per-command policies (see
  [Design decisions](#design-decisions)).
- **Kong** is the single public entrypoint, fronting all of the above so the
  SPA only needs one URL and one publishable key.
- The **migrator** is a one-shot container that waits for Postgres and GoTrue,
  applies SQL migrations, and seeds demo data — see
  [Setup instructions](#setup-instructions).

This means business rules that would live in a Node/Express layer in a
traditional stack instead live in **Postgres functions, triggers, and RLS
policies**. That is a deliberate trade-off, discussed in
[Design decisions](#design-decisions).

## Folder structure

```
TaskManager/
├── docker-compose.yml       # the entire stack; `docker compose up --build` is the only command needed
├── .env.example              # every variable the stack needs, with working local defaults
├── docker/
│   ├── kong/kong.yml          # API gateway routes (auth/rest/meta)
│   ├── db/*.sql                # Postgres role passwords, JWT secret, internal schemas
│   └── migrator/Dockerfile    # the one-shot provisioning container
├── supabase/
│   ├── migrations/            # numbered, ordered SQL — schema, RLS, indexes
│   ├── seed/seed.sql          # demo projects/tasks/comments
│   └── scripts/migrate.sh     # waits for the DB, applies migrations, seeds
├── scripts/
│   └── generate-jwt-keys.js   # regenerate ANON_KEY/SERVICE_ROLE_KEY if JWT_SECRET changes
└── web/                       # the React application
    ├── Dockerfile              # multi-stage: node build → nginx runtime
    ├── nginx.conf
    └── src/
        ├── app/                # router, providers, protected-route layout, theme
        ├── components/         # shared UI (pagination, empty/error states, confirm dialog…)
        ├── components/ui/      # shadcn/ui primitives
        ├── features/
        │   ├── auth/            # AuthProvider, login/register forms, schemas
        │   ├── projects/        # api.ts, hooks.ts, schemas.ts, dialogs, members panel
        │   ├── tasks/            # api.ts, hooks.ts, filters.ts, list, filter bar, forms
        │   └── comments/        # api.ts, hooks.ts, comment thread
        ├── lib/                 # supabase client, error mapper, pagination, query keys
        ├── types/database.ts    # hand-maintained types mirroring the migrations
        └── test/                # Vitest setup + RLS integration test harness
```

**The rule that keeps this maintainable:** components never import the
Supabase client directly. Each feature exposes a typed `api.ts` (pure
functions wrapping `supabase-js` calls) and `hooks.ts` (TanStack Query
bindings over `api.ts`). This is what makes the data layer independently
testable and keeps query construction out of component code.

## Setup instructions

**Requirements:** Docker Desktop (or Docker Engine + Compose v2). Nothing
else — no local Node.js, PostgreSQL, or Supabase CLI installation is required
to run the app.

```bash
git clone https://github.com/BahaaElMekkawy/TaskManager.git
cd TaskManager
cp .env.example .env
docker compose up --build
```

That's it. No manual database setup, migration command, or seeding step is
needed — the `migrator` service handles all three automatically on first
boot (see [How provisioning works](#how-provisioning-works) below).

The `.env.example` values are working defaults for local development,
including a JWT secret and matching `ANON_KEY`/`SERVICE_ROLE_KEY` — the
[Security](#security) note under Design decisions explains why these are safe
to commit and what to do differently for a real deployment.

### How provisioning works

The `migrator` container:

1. waits for Postgres to accept connections;
2. waits for GoTrue to finish creating the `auth` schema — this matters
   because several tables have foreign keys into `auth.users`, and GoTrue
   creates that table itself on first boot, slightly after its container
   reports healthy;
3. applies every file in `supabase/migrations/` in order, tracking applied
   versions in `supabase_migrations.schema_migrations` — a dedicated schema,
   not `public`, so this bookkeeping table is never exposed over the REST API
   (idempotent — safe to re-run);
4. seeds three demo users through the **GoTrue admin API** (not by writing
   rows into `auth.users` directly) and then seeds demo projects, tasks, and
   comments via `psql` (also idempotent — skipped if data already exists).

Run `docker compose logs migrator` to watch this happen.

## Running the application

| URL | What |
|---|---|
| http://localhost:3000 | The application |
| http://localhost:3001 | Supabase Studio — browse the schema, confirm RLS is enabled, inspect seeded rows |
| http://localhost:8000 | Kong (the API Kong fronts — not meant to be opened directly) |

### Demo accounts

Seeded by `supabase/seed/seed.sql`, password `Password123!` for all three:

| Email | Owns | Member of |
|---|---|---|
| `alice@example.com` | Website Redesign, Mobile App Launch | — |
| `bob@example.com` | Internal Tooling | Website Redesign |
| `carol@example.com` | Q3 Marketing Campaign | Internal Tooling |

Logging in as different users demonstrates the access model directly: `carol`
cannot see `alice`'s "Mobile App Launch" project at all — not a permission
error, it simply does not appear, because RLS filters it out of the query.

You can also register a brand-new account through the UI; email confirmation
is auto-approved locally (see [Assumptions](#assumptions)).

### Stopping / resetting

```bash
docker compose down        # stop, keep data
docker compose down -v     # stop and wipe the database volume
docker compose up --build  # rebuild + start fresh (re-provisions automatically)
```

## Running the tests

All test commands run inside `web/`.

```bash
cd web
npm install          # only needed if running outside Docker

npm run test          # unit + component tests (Vitest + React Testing Library)
npm run test:coverage # same, with coverage
npm run typecheck      # tsc --build, strict mode
npm run lint            # ESLint
npm run build            # production build
```

### RLS integration tests

```bash
docker compose up --build -d   # stack must be running and seeded
cd web
npm run test:integration
```

This suite is the one that actually matters for the security requirement. It
signs in as the real seeded users over the network — no mocking — and
asserts things like: `bob` cannot read, insert into, update, or delete
`alice`'s private project; a comment can only be deleted by its author; an
anonymous request returns zero rows rather than an error; the
`add_project_member_by_email` RPC rejects a caller who isn't the project
owner. Every other suite in this repo mocks the Supabase client and therefore
only proves the TypeScript is self-consistent — this one proves the database
itself enforces the rules.

## Assumptions

Where the brief left a decision open, here is what was assumed and why:

- **Projects are shareable.** The brief lists "Assignee (optional)" as a task
  field but doesn't say whether a project can have more than one user. A
  single-owner model would make "assignee" and "filter by assignee" nearly
  meaningless (you can only ever assign a task to yourself). Projects
  therefore have an owner plus zero or more invited members
  (`project_members`), and "your data" is defined as "a project you are a
  member of."
- **Email confirmation is auto-approved locally.** No SMTP server exists to
  deliver a real confirmation email in a local Docker stack, so
  `GOTRUE_MAILER_AUTOCONFIRM=true` lets a newly registered user sign in
  immediately. This is explicitly a local-only convenience — see
  [Known limitations](#known-limitations).
- **An assignee must be a project member.** Enforced by a trigger
  (`assert_assignee_is_project_member`), not just in the UI, so the
  constraint holds even for a direct API call.
- **Comments are not editable**, only deletable by their author, matching the
  fields the brief specifies for a comment (author, message, created date —
  no "updated date").
- **A project owner cannot remove themselves** via the members list (they can
  delete the project instead), so a project can never end up with no one able
  to administer it.
- **Search matches task *title* only** (as specified); description is not
  included in the search index.

## Design decisions

#### RLS via SECURITY DEFINER helper functions

Writing policies as direct correlated subqueries across `projects` →
`project_members` → `tasks` → `comments` causes Postgres to report
`infinite recursion detected in policy for relation` — each table's policy
ends up depending on another table whose own policy depends back on the
first. The fix is four small `SECURITY DEFINER` SQL functions
(`is_project_member`, `is_project_owner`, `can_access_task`,
`shares_project_with`) that evaluate outside RLS and are then called *from*
policies. Each is `STABLE`, returns only a boolean, is scoped to
`auth.uid()` (which a client cannot forge — it's derived from the JWT
signature), has `search_path` pinned to prevent object-shadowing attacks, and
has `EXECUTE` revoked from `anon`/`PUBLIC`. See
`supabase/migrations/20260801000800_rls_helpers.sql`.

#### Adding a member is a RPC, not a plain INSERT

An owner invites a collaborator by email. Resolving that email to a user id
means reading a `profiles` row the owner isn't yet allowed to see under RLS
(you can only see profiles of people you already share a project with — and
before the invite, you share nothing). Rather than making `profiles`
world-readable to solve this, `add_project_member_by_email` is a
`SECURITY DEFINER` function that performs the lookup itself, after explicitly
re-checking that the caller is the project owner (RLS is bypassed inside the
function, so that check has to be restated, not assumed).

#### Status/priority are Postgres enums, not text + CHECK

Invalid values are rejected by the database itself, not only by client-side
validation, and the generated TypeScript types become real string unions.
Trade-off: adding a new status later requires an `ALTER TYPE` migration
instead of a one-line constraint edit — acceptable given these values come
directly from the specification.

#### Filter state lives in the URL, not component state

`features/tasks/filters.ts` is the single place that reads/writes
`?q=&status=&priority=&assignee=&due_from=&due_to=&page=`. This makes a
filtered view linkable and bookmarkable, survives a refresh, and gets
back/forward navigation for free through React Router — none of which a
`useState`-based filter panel provides.

#### Only Postgres, Auth, PostgREST, Kong, and Studio run — not the full Supabase surface

The brief's "Backend" section lists PostgreSQL, Supabase Auth, and RLS — it
does not ask for Realtime, Storage, or image processing. Earlier drafts ran
the full self-hosted service set "for stack completeness," but that adds
containers, secrets, and Kong routes that nothing in the app exercises. They
were removed; `postgres-meta` and Studio stay because they let a reviewer
inspect the schema and confirm RLS without installing anything, which is a
real (if optional) part of the brief's "Developer Experience" evaluation.

#### No custom backend service

All business logic that would traditionally live in an Express/Nest layer —
authorization, the membership invite flow, the "assignee must be a project
member" rule — lives in Postgres (RLS policies, `SECURITY DEFINER`
functions, and triggers) instead. This is what the brief's stack asks for
(Supabase + RLS as the enforcement point), and it means the security
guarantee holds for *any* client, not just this one. The trade-off is that
this logic is written in SQL/PL-pgSQL rather than TypeScript, which is less
familiar to some reviewers and is exercised by the integration test suite
rather than unit tests.

#### `profiles`, not `auth.users`, as the foreign key target

`projects.owner_id`, `project_members.user_id`, `tasks.assignee_id`, and
`comments.author_id` all reference `public.profiles`, not `auth.users`
directly. `auth.users` contains credential material and is intentionally
outside PostgREST's exposed schemas; a foreign key into it can't be embedded
in a PostgREST query. Pointing at `profiles` (which mirrors `auth.users` via
an `AFTER INSERT` trigger and cascades from it) means a single request like
`GET /tasks?select=*,assignee:profiles(*)` returns the assignee's name, with
identical referential integrity.

#### Optimistic status updates

Changing a task's status from the list or detail view updates the
TanStack Query cache immediately and only rolls back if the request fails
(`useUpdateTaskStatus` in `features/tasks/hooks.ts`). Every other mutation in
the app (create/edit/delete) waits for the server response before updating
the UI, since status is the one interaction frequent and low-risk enough to
be worth the added complexity.

<a id="security"></a>

#### Why committed secrets are acceptable here

`.env.example` (and the working `.env` you create from it) contains a JWT
secret and matching `ANON_KEY`/`SERVICE_ROLE_KEY` in plain text. This is
intentional: the brief requires `docker compose up --build` alone to run the
app, which is incompatible with secrets a reviewer would have to generate or
be handed out-of-band. These are placeholder development values — see the
warning block at the top of `.env.example`, and use
`scripts/generate-jwt-keys.js` to mint your own if you deploy this anywhere
real.

## Known limitations

- **No file attachments.** There's no attachment field on tasks or comments,
  and no Storage service running — see [Design decisions](#design-decisions)
  for why Realtime/Storage/imgproxy were dropped from the stack.
- **No real email delivery.** Registration auto-confirms locally; a
  production deployment would need a real SMTP provider and would need
  `ENABLE_EMAIL_AUTOCONFIRM` turned off.
- **Single main bundle.** The production build produces one ~260 KB
  (gzipped) JS chunk; Vite's chunk-size warning flags this. Route-based code
  splitting was left out to keep the build config simple for a project this
  size — see Future improvements.
- **No rate limiting** beyond whatever GoTrue applies by default. A
  public-facing deployment would want it in front of Kong.
- **Comments cannot be edited**, only deleted, per the [Assumptions](#assumptions)
  above.
- **`npm install` rather than `npm ci` in the web Dockerfile** — a Windows-
  generated lockfile does not pin the Linux-musl native binaries some
  dependencies (Tailwind's oxide engine, Rollup) need inside the Alpine build
  image, so `npm ci`'s strict lockfile match fails there. `npm install`
  resolves correctly for the build platform at the cost of `npm ci`'s
  byte-for-byte reproducibility guarantee.

## Future improvements

- **Realtime task boards.** Adding the `realtime` service back and wiring
  `supabase-js`'s realtime subscriptions into the task list would turn it
  into a live board.
- **Task attachments** via a Storage service, if file uploads become a
  requirement.
- **Route-based code splitting** (`React.lazy` per top-level route) to bring
  the initial bundle down.
- **Activity log** on a task (status changes, reassignments) — the data is
  already implicitly available via `updated_at` and could be captured with an
  audit trigger.
- **Bulk actions** on the task list (multi-select → change status/assignee).
- **Playwright end-to-end tests** covering the full register → create project
  → create task → comment flow in a real browser, layered on top of the
  existing unit/component/RLS-integration suites.
