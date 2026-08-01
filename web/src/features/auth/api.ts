import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { LoginInput, RegisterInput } from '@/features/auth/schemas';

/**
 * Authentication operations.
 *
 * supabase-js returns errors in the result object rather than throwing. Every
 * function here converts that into a thrown error, so callers can rely on
 * ordinary try/catch and React Query's error handling instead of each call site
 * remembering to check `result.error`. Forgetting that check is the single
 * easiest way to write a form that silently appears to succeed.
 */

export async function signIn({ email, password }: LoginInput): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.session) {
    throw new Error('Sign in succeeded but no session was returned.');
  }

  return data.session;
}

export async function signUp({
  email,
  password,
  displayName,
}: RegisterInput): Promise<{ user: User | null; session: Session | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the on_auth_user_created trigger to populate profiles.display_name.
      data: { display_name: displayName },
    },
  });

  if (error) throw error;

  // With GOTRUE_MAILER_AUTOCONFIRM enabled (the local default) a session comes
  // back immediately. If confirmations were ever switched on, session is null
  // and the caller must tell the user to check their email — hence returning
  // both rather than assuming.
  return { user: data.user, session: data.session };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
