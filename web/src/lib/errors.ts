import { AuthError, type PostgrestError } from '@supabase/supabase-js';

/**
 * Translates errors from Supabase into something a person can act on.
 *
 * Raw errors from PostgREST are written for developers: a user who assigns a
 * task to a non-member sees `new row for relation "tasks" violates check
 * constraint`, and a user hitting an RLS denial sees a bare 42501. Worse, the
 * useful cases are indistinguishable from genuine bugs unless the codes are
 * handled deliberately.
 *
 * One deliberate choice: an RLS denial is reported as "not found or no
 * permission" rather than "you are not allowed to touch project X". Confirming
 * that a hidden resource exists is itself a small information leak, so the
 * message stays vague on purpose.
 */

/** Postgres SQLSTATE codes and PostgREST's own codes that we handle by name. */
const ERROR_MESSAGES: Record<string, string> = {
  // --- Postgres SQLSTATE ---
  '23505': 'That already exists.',
  '23503': 'That refers to something which no longer exists. Try refreshing.',
  '23514': 'Some of those values are not allowed.',
  '23502': 'A required field is missing.',
  '22001': 'That text is too long.',
  '22P02': 'One of those values is not in the expected format.',
  '42501': 'You do not have permission to do that.',

  // --- PostgREST ---
  // Returned by .single() when the filter matched no rows. In an RLS-protected
  // API this is ambiguous by design: the row may not exist, or may exist but be
  // invisible. The message must not distinguish the two.
  PGRST116: 'Not found, or you do not have access to it.',
  PGRST301: 'Your session has expired. Please sign in again.',
  PGRST204: 'That column does not exist. The app may be out of date.',
};

function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'code' in error
  );
}

/**
 * The database raises these with an explicit message meant for the end user:
 * '23514' from the assignee-membership trigger, 'P0001'/'P0002' from the
 * add_project_member_by_email RPC (see supabase/migrations/...membership_rpc.sql).
 * These are more specific than anything in ERROR_MESSAGES — the RPC's "no user
 * registered with x@example.com" names the actual email that was typed — so
 * they are preferred over the generic mapping rather than replaced by it.
 */
function hasCustomDatabaseMessage(error: PostgrestError): boolean {
  return (
    (error.code === '23514' || error.code === 'P0001' || error.code === 'P0002') &&
    typeof error.message === 'string' &&
    // Postgres-generated constraint messages are recognisable by this prefix;
    // anything else came from a RAISE EXCEPTION we wrote ourselves.
    !error.message.startsWith('new row for relation')
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    return mapAuthError(error);
  }

  if (isPostgrestError(error)) {
    if (hasCustomDatabaseMessage(error)) {
      return error.message;
    }

    const mapped = error.code ? ERROR_MESSAGES[error.code] : undefined;
    if (mapped) return mapped;

    return error.message || 'The server rejected that request.';
  }

  // supabase-js surfaces connectivity failures as a plain TypeError from fetch.
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return 'Could not reach the server. Check that the stack is running.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

/**
 * GoTrue's messages are mostly user-appropriate already, so this only rewrites
 * the ones that are misleading or leak information.
 */
function mapAuthError(error: AuthError): string {
  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials')) {
    // Deliberately does not reveal whether the account exists.
    return 'Incorrect email or password.';
  }
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'An account with that email already exists.';
  }
  if (message.includes('password should be at least')) {
    return 'That password is too short.';
  }
  if (message.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }
  if (message.includes('rate limit') || error.status === 429) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  return error.message;
}

/**
 * True when the error means "the session is gone" — the caller should send the
 * user back to the login screen rather than showing a toast they cannot act on.
 */
export function isAuthenticationError(error: unknown): boolean {
  if (error instanceof AuthError) {
    return error.status === 401 || error.status === 403;
  }
  if (isPostgrestError(error)) {
    return error.code === 'PGRST301';
  }
  return false;
}
