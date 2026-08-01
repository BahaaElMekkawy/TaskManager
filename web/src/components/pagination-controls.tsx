import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Previous/next pager with a live range summary.
 *
 * Shows "1–10 of 34" rather than only page numbers, because after applying a
 * filter the useful question is "how many matched?", not "which page am I on?".
 *
 * `aria-live="polite"` announces the new range to screen readers when the page
 * changes — otherwise the content silently swaps with no feedback at all.
 */
export function PaginationControls({
  page,
  pageSize,
  total,
  pageCount,
  onPageChange,
  isLoading = false,
  itemNoun = 'item',
}: {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  itemNoun?: string;
}) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const noun = total === 1 ? itemNoun : `${itemNoun}s`;

  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row"
      aria-label="Pagination"
    >
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Showing <span className="text-foreground font-medium">{first}</span>–
        <span className="text-foreground font-medium">{last}</span> of{' '}
        <span className="text-foreground font-medium">{total}</span> {noun}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
        >
          <ChevronLeftIcon className="size-4" aria-hidden />
          Previous
        </Button>

        <span className="text-muted-foreground px-1 text-sm tabular-nums">
          Page {page} of {pageCount}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount || isLoading}
        >
          Next
          <ChevronRightIcon className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
