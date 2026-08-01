import type { TaskPriority, TaskStatus } from '@/types/database';

/**
 * Task list filter state, and its translation to and from the URL query string.
 *
 * Filters live in the URL rather than in component state. That is a deliberate
 * design decision with several consequences worth stating:
 *
 *   - a filtered view is linkable and bookmarkable ("here are the overdue high
 *     priority tasks"), which is the main reason people ask for filters at all
 *   - browser back undoes a filter change, which is what users expect
 *   - a refresh preserves the view instead of silently resetting it
 *   - the filter object doubles as part of the React Query cache key, so two
 *     different filter sets can never collide in the cache
 *
 * The functions below are pure and are the main unit-tested surface of the
 * frontend: every filter bug in a list UI ultimately lives in this mapping.
 */

export const ALL = 'all' as const;
export const UNASSIGNED = 'unassigned' as const;

export interface TaskFilters {
  /** Free-text match against the task title. */
  search: string;
  status: TaskStatus | typeof ALL;
  priority: TaskPriority | typeof ALL;
  /**
   * A profile id, or the sentinel for "no assignee" / "any assignee".
   *
   * Typed as `string & {}` rather than plain `string`: structurally identical
   * (so any string is still assignable), but it stops the ALL/UNASSIGNED
   * literals from collapsing into `string` in editor tooltips and keeps
   * `no-redundant-type-constituents` from flagging them as dead code.
   */
  assigneeId: (string & {}) | typeof ALL | typeof UNASSIGNED;
  /** Inclusive ISO dates (yyyy-MM-dd), or null for unbounded. */
  dueFrom: string | null;
  dueTo: string | null;
  page: number;
}

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  search: '',
  status: ALL,
  priority: ALL,
  assigneeId: ALL,
  dueFrom: null,
  dueTo: null,
  page: 1,
};

const STATUS_VALUES: readonly TaskStatus[] = ['todo', 'in_progress', 'done'];
const PRIORITY_VALUES: readonly TaskPriority[] = ['low', 'medium', 'high'];

/** yyyy-MM-dd, and a real date — '2026-02-31' is rejected. */
function parseIsoDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  // Round-trip check: Date rolls 2026-02-31 forward to 2026-03-03 rather than
  // rejecting it, so compare the normalised output against the input.
  return date.toISOString().slice(0, 10) === value ? value : null;
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * Reads filters out of the query string.
 *
 * Every unrecognised value falls back to its default rather than throwing. A
 * hand-edited or stale URL should show an unfiltered list, never a crash.
 */
export function parseTaskFilters(params: URLSearchParams): TaskFilters {
  const status = params.get('status');
  const priority = params.get('priority');
  const assigneeId = params.get('assignee');

  return {
    search: params.get('q')?.trim() ?? '',
    status: STATUS_VALUES.includes(status as TaskStatus) ? (status as TaskStatus) : ALL,
    priority: PRIORITY_VALUES.includes(priority as TaskPriority)
      ? (priority as TaskPriority)
      : ALL,
    assigneeId: assigneeId && assigneeId.length > 0 ? assigneeId : ALL,
    dueFrom: parseIsoDate(params.get('due_from')),
    dueTo: parseIsoDate(params.get('due_to')),
    page: parsePage(params.get('page')),
  };
}

/**
 * Serialises filters back to a query string, omitting anything at its default.
 *
 * Keeping defaults out of the URL matters: `/projects/x` and
 * `/projects/x?status=all&page=1` should be the same place, and a URL full of
 * redundant parameters is unpleasant to share.
 */
export function taskFiltersToSearchParams(filters: TaskFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search.trim()) params.set('q', filters.search.trim());
  if (filters.status !== ALL) params.set('status', filters.status);
  if (filters.priority !== ALL) params.set('priority', filters.priority);
  if (filters.assigneeId !== ALL) params.set('assignee', filters.assigneeId);
  if (filters.dueFrom) params.set('due_from', filters.dueFrom);
  if (filters.dueTo) params.set('due_to', filters.dueTo);
  if (filters.page > 1) params.set('page', String(filters.page));

  return params;
}

/** True when anything other than pagination is narrowing the list. */
export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.status !== ALL ||
    filters.priority !== ALL ||
    filters.assigneeId !== ALL ||
    filters.dueFrom !== null ||
    filters.dueTo !== null
  );
}

/** Count of active filters, for the badge on the mobile "Filters" button. */
export function activeFilterCount(filters: TaskFilters): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.status !== ALL) count += 1;
  if (filters.priority !== ALL) count += 1;
  if (filters.assigneeId !== ALL) count += 1;
  if (filters.dueFrom || filters.dueTo) count += 1;
  return count;
}

/**
 * Applies a partial change and resets to page 1.
 *
 * Changing a filter while on page 3 would otherwise request page 3 of a result
 * set that may now have one page, showing an empty list with no explanation.
 * Page changes themselves pass `page` explicitly and are unaffected.
 */
export function withFilterChange(
  filters: TaskFilters,
  change: Partial<TaskFilters>,
): TaskFilters {
  return { ...filters, page: 1, ...change };
}
