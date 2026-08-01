import { createClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * The single Supabase client for the application.
 *
 * Typed with the generated `Database` schema, which is what makes
 * `supabase.from('tasks').select()` return real `Task` rows and turns a typo in
 * a column name into a compile error.
 *
 * Note the anon key is a public value, safe to ship in the bundle. It only
 * identifies the project and grants the `anon` Postgres role; every row the API
 * returns is still filtered by Row Level Security against the caller's JWT.
 * Security here comes from the database, not from keeping this string secret.
 *
 * Feature code should not import this directly — go through a feature's
 * `api.ts`. See src/features/README for the reasoning.
 */
export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      // Keep the user signed in across reloads and refresh the JWT before it
      // expires, so a session does not die mid-edit.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'taskmanager-auth',
    },
  },
);
