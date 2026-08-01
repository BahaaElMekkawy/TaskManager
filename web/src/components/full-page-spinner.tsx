import { Loader2Icon } from 'lucide-react';

/**
 * Full-viewport loading state, used while the session is being restored.
 *
 * `role="status"` plus the visually-hidden label means a screen reader
 * announces the wait; a bare spinning icon announces nothing at all.
 */
export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-3"
    >
      <Loader2Icon className="text-muted-foreground size-6 animate-spin" aria-hidden />
      <p className="text-muted-foreground text-sm">{label}…</p>
    </div>
  );
}
