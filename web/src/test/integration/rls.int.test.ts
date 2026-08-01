import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, signInAs } from '@/test/integration/clients';
import type { Database } from '@/types/database';

/**
 * Proves Row Level Security actually isolates user data on the live stack.
 *
 * Run with `npm run test:integration` against a running, seeded
 * `docker compose up` stack. Every other test suite in this repo mocks the
 * Supabase client; this one deliberately does not, because a unit test can
 * only prove the TypeScript is self-consistent — it cannot prove the RLS
 * policies compiled into Postgres reject what they are supposed to reject.
 * This suite is the actual evidence for the assignment's security
 * requirement.
 *
 * Depends on supabase/seed/seed.sql producing:
 *   - "Website Redesign"    — alice owns, bob is a member (shared)
 *   - "Mobile App Launch"   — alice only (private)
 *   - "Internal Tooling"    — bob owns, carol is a member (shared)
 *   - "Q3 Marketing Campaign" — carol only (private)
 *
 * A PostgREST/RLS query never errors just because rows are hidden — a SELECT
 * that matches nothing you're allowed to see returns an empty array with
 * `error: null`, not a 403. That is what most assertions below check for:
 * silence, not a thrown error. An error is only expected where a table's
 * privilege grants block the verb outright (there are none such here) or a
 * SECURITY DEFINER function performs its own explicit authorisation check.
 */

type Clients = {
  alice: SupabaseClient<Database>;
  bob: SupabaseClient<Database>;
  carol: SupabaseClient<Database>;
  anon: SupabaseClient<Database>;
};

const clients = {} as Clients;

const projectIds = {} as {
  sharedWebsiteRedesign: string;
  alicePrivateMobileApp: string;
  bobOwnedInternalTooling: string;
  carolPrivateMarketing: string;
};

beforeAll(async () => {
  clients.alice = await signInAs('alice');
  clients.bob = await signInAs('bob');
  clients.carol = await signInAs('carol');
  clients.anon = anonClient();

  const { data: aliceProjects, error: aliceProjectsError } = await clients.alice
    .from('projects')
    .select('id, name');
  if (aliceProjectsError) throw aliceProjectsError;

  const { data: carolProjects, error: carolProjectsError } = await clients.carol
    .from('projects')
    .select('id, name');
  if (carolProjectsError) throw carolProjectsError;

  const find = (rows: { id: string; name: string }[], name: string): string => {
    const row = rows.find((project) => project.name === name);
    if (!row) {
      throw new Error(
        `Seed project "${name}" not found. Has \`docker compose up\` seeded the database?`,
      );
    }
    return row.id;
  };

  projectIds.sharedWebsiteRedesign = find(aliceProjects, 'Website Redesign');
  projectIds.alicePrivateMobileApp = find(aliceProjects, 'Mobile App Launch');
  projectIds.bobOwnedInternalTooling = find(carolProjects, 'Internal Tooling');
  projectIds.carolPrivateMarketing = find(carolProjects, 'Q3 Marketing Campaign');
});

describe('project isolation', () => {
  it('lets a member read a project they were invited to', async () => {
    const { data, error } = await clients.bob
      .from('projects')
      .select('id')
      .eq('id', projectIds.sharedWebsiteRedesign)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.id).toBe(projectIds.sharedWebsiteRedesign);
  });

  it("hides another user's private project from a SELECT entirely", async () => {
    const { data, error } = await clients.bob
      .from('projects')
      .select('id')
      .eq('id', projectIds.alicePrivateMobileApp);

    // Not a 403 — the row is simply absent from the result set, same as if
    // it never existed. That is the point: existence itself is not leaked.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('silently blocks INSERT into a project the caller does not belong to', async () => {
    const { data, error } = await clients.bob
      .from('tasks')
      .insert({
        project_id: projectIds.alicePrivateMobileApp,
        title: 'RLS probe: this must never be written',
      })
      .select();

    expect(data).toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('silently blocks UPDATE of a project the caller does not own', async () => {
    const { data, error } = await clients.bob
      .from('projects')
      .update({ name: 'Hijacked by bob' })
      .eq('id', projectIds.alicePrivateMobileApp)
      .select();

    // RLS filters the target row out of the update's candidate set, so this
    // affects zero rows rather than erroring.
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: stillOriginal } = await clients.alice
      .from('projects')
      .select('name')
      .eq('id', projectIds.alicePrivateMobileApp)
      .single();
    expect(stillOriginal?.name).toBe('Mobile App Launch');
  });

  it('silently blocks DELETE of a project the caller does not own', async () => {
    const { data, error } = await clients.bob
      .from('projects')
      .delete()
      .eq('id', projectIds.alicePrivateMobileApp)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: stillExists } = await clients.alice
      .from('projects')
      .select('id')
      .eq('id', projectIds.alicePrivateMobileApp)
      .maybeSingle();
    expect(stillExists).not.toBeNull();
  });

  it('lets carol read the project she was invited to by bob', async () => {
    const { data, error } = await clients.carol
      .from('projects')
      .select('id')
      .eq('id', projectIds.bobOwnedInternalTooling)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.id).toBe(projectIds.bobOwnedInternalTooling);
  });

  it('hides projects carol has no membership in, even in bulk', async () => {
    const { data, error } = await clients.carol
      .from('projects')
      .select('id')
      .in('id', [projectIds.sharedWebsiteRedesign, projectIds.alicePrivateMobileApp]);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe('comment authorship', () => {
  it("blocks a fellow project member from deleting someone else's comment", async () => {
    const { data: aliceComments, error: fetchError } = await clients.alice
      .from('comments')
      .select('id, task_id')
      .limit(1);
    if (fetchError) throw fetchError;
    const target = aliceComments[0];
    if (!target) throw new Error('Expected at least one seeded comment by alice');

    const { data, error } = await clients.bob
      .from('comments')
      .delete()
      .eq('id', target.id)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: stillExists } = await clients.alice
      .from('comments')
      .select('id')
      .eq('id', target.id)
      .maybeSingle();
    expect(stillExists).not.toBeNull();
  });
});

describe('profile visibility', () => {
  it("reveals a co-member's profile", async () => {
    const { data, error } = await clients.bob
      .from('profiles')
      .select('id')
      .eq('email', 'alice@example.com')
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it('hides the profile of a user who shares no project', async () => {
    // alice's projects (Website Redesign, Mobile App Launch) and carol's
    // (Internal Tooling as a member, Q3 Marketing Campaign as owner) never
    // overlap in the seed data — unlike bob, who shares Internal Tooling
    // with carol and Website Redesign with alice.
    const { data, error } = await clients.alice
      .from('profiles')
      .select('id')
      .eq('email', 'carol@example.com')
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

describe('add_project_member_by_email authorisation', () => {
  it('rejects a caller who is a member but not the owner', async () => {
    // bob is a member (not owner) of Website Redesign, owned by alice.
    const { error } = await clients.bob.rpc('add_project_member_by_email', {
      p_project_id: projectIds.sharedWebsiteRedesign,
      p_email: 'carol@example.com',
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('rejects a caller with no relationship to the project at all', async () => {
    const { error } = await clients.carol.rpc('add_project_member_by_email', {
      p_project_id: projectIds.alicePrivateMobileApp,
      p_email: 'carol@example.com',
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('lets the owner add a member, and the RPC cleans up after itself', async () => {
    const { error: addError } = await clients.alice.rpc(
      'add_project_member_by_email',
      { p_project_id: projectIds.alicePrivateMobileApp, p_email: 'carol@example.com' },
    );
    expect(addError).toBeNull();

    // Membership takes effect immediately for the invited user.
    const { data: carolCanNowSeeIt } = await clients.carol
      .from('projects')
      .select('id')
      .eq('id', projectIds.alicePrivateMobileApp)
      .maybeSingle();
    expect(carolCanNowSeeIt?.id).toBe(projectIds.alicePrivateMobileApp);

    // Cleanup: leave the seed data as this suite found it, so re-running the
    // suite (or the app's own manual QA against the same seeded stack) isn't
    // affected by a previous test run.
    const { data: carolProfile } = await clients.alice
      .from('profiles')
      .select('id')
      .eq('email', 'carol@example.com')
      .single();

    await clients.alice
      .from('project_members')
      .delete()
      .eq('project_id', projectIds.alicePrivateMobileApp)
      .eq('user_id', carolProfile?.id ?? '');
  });
});

describe('anonymous access', () => {
  it('returns zero rows for a request carrying no user JWT', async () => {
    const { data, error } = await clients.anon.from('projects').select('*');

    // anon has SELECT privilege on the table (see the RLS policies migration)
    // but no policy names the anon role, so RLS admits nothing.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('cannot call the membership RPC at all', async () => {
    const { error } = await clients.anon.rpc('add_project_member_by_email', {
      p_project_id: projectIds.sharedWebsiteRedesign,
      p_email: 'carol@example.com',
    });

    expect(error).not.toBeNull();
  });
});

afterAll(async () => {
  await Promise.all([
    clients.alice?.auth.signOut(),
    clients.bob?.auth.signOut(),
    clients.carol?.auth.signOut(),
  ]);
});
