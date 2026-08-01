import path from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * RLS integration tests — run against the live Supabase stack, not mocks.
 *
 * Separate from vitest.config.ts on purpose: these tests need real network
 * access to Kong/PostgREST/GoTrue and take noticeably longer, so they must
 * never run as a side effect of `npm test` (the default CI/pre-commit path).
 * They are what actually proves the RLS policies work, as opposed to unit
 * tests that only prove our TypeScript logic is self-consistent.
 *
 * `envDir` points at the repository root so this config reads the real
 * ANON_KEY etc. from the project's own .env — the one docker-compose uses —
 * rather than the dummy values in web/.env.test.
 */
export default defineConfig({
  envDir: path.resolve(import.meta.dirname, '..'),
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.int.test.ts'],
    // Each test signs in, exercises RLS, and the stack runs on localhost —
    // slower than a mocked unit test, but this is still real network I/O
    // against a real process, so a generous ceiling beats a flaky timeout.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // RLS/session state must not leak between test files sharing one worker.
    fileParallelism: false,
  },
});
