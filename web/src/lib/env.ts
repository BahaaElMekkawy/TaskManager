/**
 * Validated access to build-time configuration.
 *
 * Vite inlines `import.meta.env.VITE_*` at build time, so a missing variable
 * does not fail the build — it silently becomes `undefined` and surfaces much
 * later as an unhelpful "Invalid URL" from deep inside supabase-js. Checking
 * here converts that into one clear error at startup naming the exact variable
 * and where to set it.
 */

interface AppEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}.\n` +
        `Set it in .env at the repository root, then rebuild with ` +
        `\`docker compose up --build\` — VITE_* values are inlined at build ` +
        `time, so a restart alone will not pick up the change.`,
    );
  }
  return value;
}

export const env: AppEnv = {
  supabaseUrl: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: required(
    'VITE_SUPABASE_ANON_KEY',
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  ),
};
