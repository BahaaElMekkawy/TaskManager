import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Empty state for lists.
 *
 * Distinguishing "nothing here yet" from "nothing matched your filters" matters:
 * the first calls for a create button, the second for a way to clear filters.
 * Showing the wrong one leaves the user believing their data is gone.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden />
      </div>

      <div className="space-y-1">
        <h3 className="font-medium">{title}</h3>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">{description}</p>
        ) : null}
      </div>

      {action}
    </div>
  );
}
