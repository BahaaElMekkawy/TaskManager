import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Unit and component tests — everything that does not need a live database.
 *
 * Deliberately excludes `**\/*.int.test.ts`: those run against the real
 * Supabase stack (see vitest.integration.config.ts) and would fail here with
 * a connection error rather than a meaningful assertion failure.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.int.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'src/components/ui/**', // shadcn primitives — generated, not our logic
        'src/types/**',
        'src/test/**',
        '**/*.d.ts',
      ],
    },
  },
});
