-- ============================================================================
-- Demo data
-- ============================================================================
--
-- Runs as supabase_admin (which bypasses RLS) from the migrator container,
-- after the three demo users have been created through the GoTrue admin API.
-- Their profile rows already exist by this point, courtesy of the
-- on_auth_user_created trigger — so this file resolves users by email rather
-- than hardcoding uuids, and never touches auth.users itself.
--
-- The dataset is shaped to exercise the requirements rather than to look full:
--
--   * one project shared between two users, proving the membership model and
--     making "filter by assignee" meaningful
--   * one private project per user, so RLS isolation is observable by simply
--     logging in as someone else
--   * enough tasks in one project to push the list past a single page
--   * every status, every priority, and due dates in the past, present and
--     future so each filter has something to match
--
-- Guarded by the caller: migrate.sh skips this file entirely if any project
-- already exists, which keeps `docker compose up` re-runnable.

DO $$
DECLARE
  alice        uuid;
  bob          uuid;
  carol        uuid;

  p_website    uuid;
  p_mobile     uuid;
  p_tooling    uuid;
  p_marketing  uuid;

  t_audit      uuid;
  t_nav        uuid;
  t_checkout   uuid;
BEGIN
  ---------------------------------------------------------------------------
  -- Resolve the seeded users
  ---------------------------------------------------------------------------
  SELECT id INTO alice FROM public.profiles WHERE email = 'alice@example.com';
  SELECT id INTO bob   FROM public.profiles WHERE email = 'bob@example.com';
  SELECT id INTO carol FROM public.profiles WHERE email = 'carol@example.com';

  IF alice IS NULL OR bob IS NULL OR carol IS NULL THEN
    RAISE EXCEPTION
      'Seed users are missing. Expected profiles for alice/bob/carol@example.com — '
      'did the GoTrue admin API calls in migrate.sh succeed?';
  END IF;

  ---------------------------------------------------------------------------
  -- Projects. The owner's membership row is created by the on_project_created
  -- trigger, so only additional collaborators are inserted explicitly.
  ---------------------------------------------------------------------------
  INSERT INTO public.projects (owner_id, name, description, created_at)
  VALUES (
    alice,
    'Website Redesign',
    'Rebuild the marketing site with a new design system, refreshed content and a measurable improvement to Core Web Vitals.',
    now() - interval '42 days'
  )
  RETURNING id INTO p_website;

  -- The shared project: Alice owns it, Bob collaborates.
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (p_website, bob, 'member');

  INSERT INTO public.projects (owner_id, name, description, created_at)
  VALUES (
    alice,
    'Mobile App Launch',
    'Ship the iOS and Android clients to the public stores, including store listings and a staged rollout plan.',
    now() - interval '28 days'
  )
  RETURNING id INTO p_mobile;

  INSERT INTO public.projects (owner_id, name, description, created_at)
  VALUES (
    bob,
    'Internal Tooling',
    'Developer experience work: faster CI, a reusable component library and better local environment setup.',
    now() - interval '20 days'
  )
  RETURNING id INTO p_tooling;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (p_tooling, carol, 'member');

  INSERT INTO public.projects (owner_id, name, description, created_at)
  VALUES (
    carol,
    'Q3 Marketing Campaign',
    'Plan and execute the third quarter campaign across email, paid social and the partner newsletter.',
    now() - interval '11 days'
  )
  RETURNING id INTO p_marketing;

  ---------------------------------------------------------------------------
  -- Website Redesign — 14 tasks, enough to page through at 10 per page.
  -- Assignees are restricted to Alice and Bob: the tasks_assignee_must_be_
  -- project_member trigger rejects anyone else.
  ---------------------------------------------------------------------------
  INSERT INTO public.tasks
    (project_id, title, description, status, priority, due_date, assignee_id, created_by, created_at)
  VALUES
    (p_website, 'Audit current information architecture',
     'Catalogue every existing page, note traffic and owner, and flag anything that should be merged or retired.',
     'done', 'high', current_date - 30, alice, alice, now() - interval '41 days'),

    (p_website, 'Define colour and typography tokens',
     'Agree the palette and type scale, then express them as design tokens both design and code consume.',
     'done', 'high', current_date - 24, bob, alice, now() - interval '40 days'),

    (p_website, 'Rebuild the primary navigation',
     'Implement the new header with a responsive drawer under 768px and full keyboard support.',
     'in_progress', 'high', current_date + 2, bob, alice, now() - interval '22 days'),

    (p_website, 'Redesign the homepage hero',
     'New hero layout with a single clear call to action. Must not regress Largest Contentful Paint.',
     'in_progress', 'medium', current_date + 5, alice, alice, now() - interval '19 days'),

    (p_website, 'Migrate blog posts to the new template',
     'Move all 60 existing posts, preserving slugs so nothing 404s.',
     'todo', 'medium', current_date + 12, bob, alice, now() - interval '16 days'),

    (p_website, 'Improve Lighthouse performance score',
     'Target 90+ on mobile. Focus on image formats, font loading strategy and render-blocking scripts.',
     'todo', 'high', current_date + 9, alice, alice, now() - interval '15 days'),

    (p_website, 'Add cookie consent banner',
     'Region-aware consent that blocks analytics until the visitor accepts.',
     'todo', 'medium', current_date + 18, NULL, alice, now() - interval '14 days'),

    (p_website, 'Write accessible form components',
     'Inputs, selects and error states with correct labelling and focus management.',
     'in_progress', 'medium', current_date + 7, bob, bob, now() - interval '12 days'),

    (p_website, 'Set up visual regression tests',
     'Snapshot the key templates so unintended layout changes are caught in CI.',
     'todo', 'low', current_date + 25, NULL, bob, now() - interval '10 days'),

    (p_website, 'Localise the pricing page',
     'Support English, German and Spanish, including currency formatting.',
     'todo', 'low', current_date + 34, NULL, alice, now() - interval '9 days'),

    (p_website, 'Fix contrast issues flagged in the audit',
     'Fourteen elements fall below WCAG AA. Adjust tokens rather than patching individual components.',
     'todo', 'high', current_date - 3, bob, bob, now() - interval '8 days'),

    (p_website, 'Draft the 404 and 500 pages',
     'Friendly copy plus a route back into the main navigation.',
     'todo', 'low', NULL, NULL, alice, now() - interval '6 days'),

    (p_website, 'Review analytics event taxonomy',
     'Agree naming conventions before instrumenting the new pages.',
     'todo', 'medium', current_date + 15, alice, bob, now() - interval '4 days'),

    (p_website, 'Prepare launch checklist',
     'Redirects, sitemap, robots.txt, monitoring and a rollback plan.',
     'todo', 'high', current_date + 21, alice, alice, now() - interval '2 days');

  ---------------------------------------------------------------------------
  -- Mobile App Launch — Alice only.
  ---------------------------------------------------------------------------
  INSERT INTO public.tasks
    (project_id, title, description, status, priority, due_date, assignee_id, created_by, created_at)
  VALUES
    (p_mobile, 'Finalise app store screenshots',
     'Six screenshots per platform at every required resolution.',
     'in_progress', 'medium', current_date + 4, alice, alice, now() - interval '26 days'),

    (p_mobile, 'Write the privacy policy',
     'Both stores reject submissions without a reachable privacy policy URL.',
     'done', 'high', current_date - 12, alice, alice, now() - interval '25 days'),

    (p_mobile, 'Configure crash reporting',
     'Symbol upload wired into the release pipeline so stack traces are readable.',
     'todo', 'high', current_date + 6, alice, alice, now() - interval '18 days'),

    (p_mobile, 'Set up staged rollout',
     'Start at 10% of users and hold for 48 hours before widening.',
     'todo', 'medium', current_date + 13, NULL, alice, now() - interval '13 days'),

    (p_mobile, 'Test on low-end Android devices',
     'Verify acceptable performance on 3GB RAM hardware.',
     'todo', 'low', current_date + 20, NULL, alice, now() - interval '7 days'),

    (p_mobile, 'Draft the release announcement',
     'Blog post plus in-app changelog entry.',
     'todo', 'low', NULL, NULL, alice, now() - interval '3 days');

  ---------------------------------------------------------------------------
  -- Internal Tooling — Bob owns, Carol collaborates.
  ---------------------------------------------------------------------------
  INSERT INTO public.tasks
    (project_id, title, description, status, priority, due_date, assignee_id, created_by, created_at)
  VALUES
    (p_tooling, 'Cut CI pipeline runtime in half',
     'Cache dependencies between runs and parallelise the test suite.',
     'in_progress', 'high', current_date + 3, bob, bob, now() - interval '19 days'),

    (p_tooling, 'Publish the shared component library',
     'Version and publish to the internal registry with a changelog.',
     'todo', 'medium', current_date + 16, carol, bob, now() - interval '15 days'),

    (p_tooling, 'One-command local environment',
     'A new engineer should be productive without reading a setup wiki.',
     'done', 'high', current_date - 6, bob, bob, now() - interval '14 days'),

    (p_tooling, 'Document the release process',
     'Cover the happy path and, more importantly, how to roll back.',
     'todo', 'low', current_date + 28, carol, carol, now() - interval '5 days'),

    (p_tooling, 'Add pre-commit hooks',
     'Formatting and lint on staged files only, to keep the hook fast.',
     'todo', 'medium', current_date - 1, NULL, bob, now() - interval '2 days');

  ---------------------------------------------------------------------------
  -- Q3 Marketing Campaign — Carol only. Invisible to Alice and Bob, which
  -- makes RLS isolation demonstrable by logging in as a different user.
  ---------------------------------------------------------------------------
  INSERT INTO public.tasks
    (project_id, title, description, status, priority, due_date, assignee_id, created_by, created_at)
  VALUES
    (p_marketing, 'Segment the mailing list',
     'Split by plan tier and engagement over the last 90 days.',
     'in_progress', 'high', current_date + 1, carol, carol, now() - interval '10 days'),

    (p_marketing, 'Design paid social creatives',
     'Three variants per channel for A/B testing.',
     'todo', 'medium', current_date + 8, carol, carol, now() - interval '8 days'),

    (p_marketing, 'Negotiate partner newsletter slot',
     'Aim for the first week of the quarter.',
     'todo', 'low', current_date + 22, NULL, carol, now() - interval '5 days'),

    (p_marketing, 'Set campaign success metrics',
     'Agree the target numbers before launch, not after.',
     'done', 'high', current_date - 4, carol, carol, now() - interval '9 days');

  ---------------------------------------------------------------------------
  -- Comments. Threaded on the shared project so both Alice and Bob can see a
  -- conversation they each contributed to.
  ---------------------------------------------------------------------------
  SELECT id INTO t_audit
    FROM public.tasks
   WHERE project_id = p_website AND title = 'Audit current information architecture';

  SELECT id INTO t_nav
    FROM public.tasks
   WHERE project_id = p_website AND title = 'Rebuild the primary navigation';

  SELECT id INTO t_checkout
    FROM public.tasks
   WHERE project_id = p_website AND title = 'Fix contrast issues flagged in the audit';

  INSERT INTO public.comments (task_id, author_id, message, created_at)
  VALUES
    (t_audit, alice,
     'Spreadsheet is in the shared drive — 214 pages, of which about 60 get meaningful traffic.',
     now() - interval '38 days'),

    (t_audit, bob,
     'That tracks with the analytics export. I would retire anything under 50 visits a month unless legal needs it.',
     now() - interval '37 days'),

    (t_audit, alice,
     'Agreed. Marking this done and carrying the retirement list into the migration task.',
     now() - interval '36 days'),

    (t_nav, bob,
     'Drawer is working on mobile. Still deciding whether the submenu should open on hover or click on desktop.',
     now() - interval '9 days'),

    (t_nav, alice,
     'Click, please. Hover menus are painful on touch-capable laptops and awkward for keyboard users.',
     now() - interval '8 days'),

    (t_nav, bob,
     'Switched to click and added Escape to close. Ready for review tomorrow.',
     now() - interval '2 days'),

    (t_checkout, bob,
     'Most of these come from the muted text token. Fixing it at the token level clears eleven of the fourteen.',
     now() - interval '6 days'),

    (t_checkout, alice,
     'Nice. The remaining three are the disabled button states — those need a separate decision.',
     now() - interval '5 days');

  RAISE NOTICE 'Seeded 4 projects, 29 tasks and 8 comments.';
END $$;
