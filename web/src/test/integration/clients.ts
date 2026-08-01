import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/**
 * Signed-in Supabase clients for the RLS integration suite.
 *
 * These sign in as the actual seeded demo users (see supabase/seed/seed.sql)
 * over the network, exactly as the browser would — there is no mocking here,
 * because the entire point of this suite is to prove the RLS policies compiled
 * into the running database actually behave as designed, not merely that our
 * TypeScript calls them correctly.
 */

const SEEDED_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Password123!';

export const SEEDED_USERS = {
  alice: 'alice@example.com',
  bob: 'bob@example.com',
  carol: 'carol@example.com',
} as const;

export type SeededUserKey = keyof typeof SEEDED_USERS;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Integration tests read the repository-root .env — ` +
        `copy .env.example to .env and start the stack before running ` +
        `\`npm run test:integration\`.`,
    );
  }
  return value;
}

function newAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv('VITE_SUPABASE_URL'),
    requireEnv('VITE_SUPABASE_ANON_KEY'),
    // No session persistence: each test file creates its own short-lived
    // clients rather than sharing browser-oriented storage across Node
    // processes, which localStorage-backed persistence assumes exists.
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** A fresh, authenticated client for one of the three seeded demo users. */
export async function signInAs(user: SeededUserKey): Promise<SupabaseClient<Database>> {
  const client = newAnonClient();

  const { error } = await client.auth.signInWithPassword({
    email: SEEDED_USERS[user],
    password: SEEDED_PASSWORD,
  });

  if (error) {
    throw new Error(
      `Could not sign in as ${SEEDED_USERS[user]}: ${error.message}\n` +
        `Is the stack running and seeded? Try: docker compose up --build`,
    );
  }

  return client;
}

/** An unauthenticated client — anon key only, no user session. */
export function anonClient(): SupabaseClient<Database> {
  return newAnonClient();
}
