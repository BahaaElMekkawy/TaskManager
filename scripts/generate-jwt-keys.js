#!/usr/bin/env node
/**
 * Generates the ANON_KEY and SERVICE_ROLE_KEY JWTs used by the Supabase stack.
 *
 * Both keys are HS256 JWTs signed with JWT_SECRET. PostgREST verifies the
 * signature and adopts the `role` claim as the Postgres role for the request,
 * which is what makes Row Level Security apply to anonymous callers at all.
 * If JWT_SECRET changes, these keys must be regenerated or every request fails
 * with a 401.
 *
 * Usage:
 *   node scripts/generate-jwt-keys.js                 # uses the default dev secret
 *   node scripts/generate-jwt-keys.js "<jwt-secret>"  # uses your own secret
 *
 * Implemented with node:crypto only — no dependencies, so it runs on a clean
 * clone before any `npm install`.
 */

const crypto = require('node:crypto');

const DEFAULT_SECRET =
  'super-secret-jwt-token-with-at-least-32-characters-long';

const ISSUED_AT = 1767225600; // 2026-01-01T00:00:00Z, fixed so output is reproducible
const TEN_YEARS_IN_SECONDS = 60 * 60 * 24 * 3650;

/** @param {object} value */
function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * @param {'anon' | 'service_role'} role
 * @param {string} secret
 */
function signToken(role, secret) {
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlJson({
    role,
    iss: 'supabase',
    iat: ISSUED_AT,
    exp: ISSUED_AT + TEN_YEARS_IN_SECONDS,
  });
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function main() {
  const secret = process.argv[2] ?? DEFAULT_SECRET;

  if (secret.length < 32) {
    console.error(
      `JWT secret must be at least 32 characters (received ${secret.length}).`,
    );
    process.exit(1);
  }

  console.log('# Copy these into your .env file:\n');
  console.log(`JWT_SECRET=${secret}`);
  console.log(`ANON_KEY=${signToken('anon', secret)}`);
  console.log(`SERVICE_ROLE_KEY=${signToken('service_role', secret)}`);
  console.log(`VITE_SUPABASE_ANON_KEY=${signToken('anon', secret)}`);
}

main();
