/**
 * Pagination shared by every list in the application.
 *
 * PostgREST paginates with an inclusive `Range` header rather than
 * limit/offset, and returns the total row count in `Content-Range` when asked
 * with `{ count: 'exact' }`. Both boundaries are inclusive, so a 10-row page
 * starting at 0 ends at 9 — an easy off-by-one that is worth centralising.
 */

export const DEFAULT_PAGE_SIZE = 10;

export interface PageRequest {
  /** 1-based, because it appears in the URL and users count from one. */
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  /** Total matching rows across all pages, not just this one. */
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/** Inclusive [from, to] bounds for `.range()`. */
export function toRange({ page, pageSize }: PageRequest): [number, number] {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.floor(pageSize));
  const from = (safePage - 1) * safeSize;
  return [from, from + safeSize - 1];
}

export function buildPage<T>(
  items: T[],
  total: number,
  { page, pageSize }: PageRequest,
): Page<T> {
  // An empty result still has one (empty) page, otherwise the UI would render
  // "Page 1 of 0".
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    total,
    page,
    pageSize,
    pageCount,
    hasPreviousPage: page > 1,
    hasNextPage: page < pageCount,
  };
}

/**
 * Clamps a page number to the available range.
 *
 * Needed because filters change the result count while the page number stays
 * put: filtering a 5-page list down to 1 page while on page 4 would otherwise
 * request a range past the end and render an empty table with no explanation.
 */
export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), Math.max(1, pageCount));
}
