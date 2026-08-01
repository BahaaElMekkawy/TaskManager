import { describe, expect, it } from 'vitest';

import {
  ALL,
  DEFAULT_TASK_FILTERS,
  UNASSIGNED,
  activeFilterCount,
  hasActiveFilters,
  parseTaskFilters,
  taskFiltersToSearchParams,
  withFilterChange,
} from '@/features/tasks/filters';

describe('parseTaskFilters', () => {
  it('returns defaults for an empty query string', () => {
    expect(parseTaskFilters(new URLSearchParams(''))).toEqual(DEFAULT_TASK_FILTERS);
  });

  it('reads a fully populated query string', () => {
    const params = new URLSearchParams(
      'q=navigation&status=in_progress&priority=high&assignee=user-123&due_from=2026-01-01&due_to=2026-01-31&page=3',
    );

    expect(parseTaskFilters(params)).toEqual({
      search: 'navigation',
      status: 'in_progress',
      priority: 'high',
      assigneeId: 'user-123',
      dueFrom: '2026-01-01',
      dueTo: '2026-01-31',
      page: 3,
    });
  });

  it('falls back to ALL for an invalid status rather than throwing', () => {
    const params = new URLSearchParams('status=not-a-real-status');
    expect(parseTaskFilters(params).status).toBe(ALL);
  });

  it('falls back to ALL for an invalid priority', () => {
    const params = new URLSearchParams('priority=urgent');
    expect(parseTaskFilters(params).priority).toBe(ALL);
  });

  it('treats the unassigned sentinel as a valid assignee value', () => {
    const params = new URLSearchParams(`assignee=${UNASSIGNED}`);
    expect(parseTaskFilters(params).assigneeId).toBe(UNASSIGNED);
  });

  it('rejects a due date that is not a real calendar date', () => {
    // 2026 is not a leap year — Date would silently roll Feb 30 into March.
    const params = new URLSearchParams('due_from=2026-02-30');
    expect(parseTaskFilters(params).dueFrom).toBeNull();
  });

  it('rejects a malformed due date', () => {
    const params = new URLSearchParams('due_from=not-a-date');
    expect(parseTaskFilters(params).dueFrom).toBeNull();
  });

  it('clamps a non-positive page to 1', () => {
    expect(parseTaskFilters(new URLSearchParams('page=0')).page).toBe(1);
    expect(parseTaskFilters(new URLSearchParams('page=-5')).page).toBe(1);
  });

  it('clamps a non-numeric page to 1', () => {
    expect(parseTaskFilters(new URLSearchParams('page=abc')).page).toBe(1);
  });

  it('trims whitespace from the search term', () => {
    const params = new URLSearchParams('q=%20%20navigation%20%20');
    expect(parseTaskFilters(params).search).toBe('navigation');
  });
});

describe('taskFiltersToSearchParams', () => {
  it('produces an empty query string for the default filters', () => {
    expect(taskFiltersToSearchParams(DEFAULT_TASK_FILTERS).toString()).toBe('');
  });

  it('omits page when it is 1', () => {
    const params = taskFiltersToSearchParams({ ...DEFAULT_TASK_FILTERS, page: 1 });
    expect(params.has('page')).toBe(false);
  });

  it('includes only the fields that differ from the default', () => {
    const params = taskFiltersToSearchParams({
      ...DEFAULT_TASK_FILTERS,
      status: 'done',
      page: 2,
    });

    expect(params.get('status')).toBe('done');
    expect(params.get('page')).toBe('2');
    expect(params.has('priority')).toBe(false);
    expect(params.has('q')).toBe(false);
  });

  it('round-trips through parseTaskFilters', () => {
    const original = {
      search: 'checkout',
      status: 'todo' as const,
      priority: 'low' as const,
      assigneeId: 'user-42',
      dueFrom: '2026-03-01',
      dueTo: '2026-03-31',
      page: 4,
    };

    const roundTripped = parseTaskFilters(taskFiltersToSearchParams(original));
    expect(roundTripped).toEqual(original);
  });
});

describe('hasActiveFilters / activeFilterCount', () => {
  it('reports no active filters and a zero count for the defaults', () => {
    expect(hasActiveFilters(DEFAULT_TASK_FILTERS)).toBe(false);
    expect(activeFilterCount(DEFAULT_TASK_FILTERS)).toBe(0);
  });

  it('does not count pagination as an active filter', () => {
    const filters = { ...DEFAULT_TASK_FILTERS, page: 5 };
    expect(hasActiveFilters(filters)).toBe(false);
    expect(activeFilterCount(filters)).toBe(0);
  });

  it('counts a due-date range as a single active filter, not two', () => {
    const filters = {
      ...DEFAULT_TASK_FILTERS,
      dueFrom: '2026-01-01',
      dueTo: '2026-01-31',
    };
    expect(activeFilterCount(filters)).toBe(1);
  });

  it('counts each independent filter dimension', () => {
    const filters = {
      ...DEFAULT_TASK_FILTERS,
      search: 'x',
      status: 'done' as const,
      priority: 'high' as const,
      assigneeId: 'user-1',
    };
    expect(activeFilterCount(filters)).toBe(4);
    expect(hasActiveFilters(filters)).toBe(true);
  });
});

describe('withFilterChange', () => {
  it('resets to page 1 when a filter changes', () => {
    const current = { ...DEFAULT_TASK_FILTERS, page: 4 };
    const next = withFilterChange(current, { status: 'done' });

    expect(next.page).toBe(1);
    expect(next.status).toBe('done');
  });

  it('preserves other filter values untouched', () => {
    const current = { ...DEFAULT_TASK_FILTERS, search: 'nav', page: 3 };
    const next = withFilterChange(current, { priority: 'high' });

    expect(next.search).toBe('nav');
    expect(next.priority).toBe('high');
  });
});
