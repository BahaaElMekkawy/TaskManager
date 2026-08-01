import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // host:true so the dev server is reachable from outside a container.
    host: true,
    port: 5173,
  },
  build: {
    // Source maps ship with the build: this is an internal tool and being able
    // to read a real stack trace from a reviewer's console is worth more than
    // hiding the source of an application whose bundle is public anyway.
    sourcemap: true,
  },
});
