import { AuthError } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { getErrorMessage, isAuthenticationError } from '@/lib/errors';

function postgrestError(code: string, message = 'generic message'): PostgrestError {
  return {
    name: 'PostgrestError',
    message,
    details: '',
    hint: '',
    code,
    toJSON: () => ({ name: 'PostgrestError', message, details: '', hint: '', code }),
  };
}

function authError(message: string, status: number): AuthError {
  return new AuthError(message, status);
}

describe('getErrorMessage', () => {
  it('maps a unique-violation code to a human message', () => {
    expect(getErrorMessage(postgrestError('23505'))).toBe('That already exists.');
  });

  it('maps an RLS-denial code without revealing the underlying reason', () => {
    expect(getErrorMessage(postgrestError('42501'))).toBe(
      'You do not have permission to do that.',
    );
  });

  it('maps PGRST116 (no row from .single()) the same way for missing or hidden data', () => {
    expect(getErrorMessage(postgrestError('PGRST116'))).toBe(
      'Not found, or you do not have access to it.',
    );
  });

  it('preserves a hand-written RAISE EXCEPTION message from the membership RPC', () => {
    const error = postgrestError('P0002', 'No user is registered with the email x@example.com');
    expect(getErrorMessage(error)).toBe(
      'No user is registered with the email x@example.com',
    );
  });

  it('falls back to the raw message for an unrecognised code', () => {
    const error = postgrestError('99999', 'a message nobody mapped');
    expect(getErrorMessage(error)).toBe('a message nobody mapped');
  });

  it('rewrites "Invalid login credentials" without confirming which field was wrong', () => {
    const error = authError('Invalid login credentials', 400);
    expect(getErrorMessage(error)).toBe('Incorrect email or password.');
  });

  it('rewrites a duplicate-registration auth error', () => {
    const error = authError('User already registered', 400);
    expect(getErrorMessage(error)).toBe('An account with that email already exists.');
  });

  it('rewrites a rate-limit auth error', () => {
    const error = authError('email rate limit exceeded', 429);
    expect(getErrorMessage(error)).toBe(
      'Too many attempts. Please wait a moment and try again.',
    );
  });

  it('detects a fetch failure and reports connectivity rather than a stack trace', () => {
    const error = new TypeError('Failed to fetch');
    expect(getErrorMessage(error)).toBe(
      'Could not reach the server. Check that the stack is running.',
    );
  });

  it('falls back to a generic message for a value that is not an Error at all', () => {
    expect(getErrorMessage('a bare string')).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.');
  });
});

describe('isAuthenticationError', () => {
  it('is true for a 401 AuthError', () => {
    expect(isAuthenticationError(authError('expired', 401))).toBe(true);
  });

  it('is true for a 403 AuthError', () => {
    expect(isAuthenticationError(authError('forbidden', 403))).toBe(true);
  });

  it('is false for a 400 AuthError (a validation problem, not a session problem)', () => {
    expect(isAuthenticationError(authError('bad request', 400))).toBe(false);
  });

  it('is true for PGRST301 (expired PostgREST JWT)', () => {
    expect(isAuthenticationError(postgrestError('PGRST301'))).toBe(true);
  });

  it('is false for an unrelated Postgrest error', () => {
    expect(isAuthenticationError(postgrestError('23505'))).toBe(false);
  });

  it('is false for a plain Error', () => {
    expect(isAuthenticationError(new Error('oops'))).toBe(false);
  });
});
