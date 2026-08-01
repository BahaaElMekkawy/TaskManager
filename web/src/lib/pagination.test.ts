import { describe, expect, it } from 'vitest';

import { buildPage, clampPage, toRange } from '@/lib/pagination';

describe('toRange', () => {
  it('computes the inclusive range for the first page', () => {
    expect(toRange({ page: 1, pageSize: 10 })).toEqual([0, 9]);
  });

  it('computes the inclusive range for a later page', () => {
    expect(toRange({ page: 3, pageSize: 10 })).toEqual([20, 29]);
  });

  it('handles a page size of 1', () => {
    expect(toRange({ page: 5, pageSize: 1 })).toEqual([4, 4]);
  });

  it('clamps a non-positive page to page 1', () => {
    expect(toRange({ page: 0, pageSize: 10 })).toEqual([0, 9]);
    expect(toRange({ page: -3, pageSize: 10 })).toEqual([0, 9]);
  });

  it('clamps a non-positive page size to 1', () => {
    expect(toRange({ page: 1, pageSize: 0 })).toEqual([0, 0]);
  });
});

describe('buildPage', () => {
  it('reports hasNextPage/hasPreviousPage in the middle of a result set', () => {
    const page = buildPage(['a', 'b'], 25, { page: 2, pageSize: 10 });

    expect(page.pageCount).toBe(3);
    expect(page.hasPreviousPage).toBe(true);
    expect(page.hasNextPage).toBe(true);
  });

  it('reports no previous page on page 1', () => {
    const page = buildPage(['a'], 25, { page: 1, pageSize: 10 });
    expect(page.hasPreviousPage).toBe(false);
    expect(page.hasNextPage).toBe(true);
  });

  it('reports no next page on the last page', () => {
    const page = buildPage(['a'], 25, { page: 3, pageSize: 10 });
    expect(page.hasNextPage).toBe(false);
  });

  it('reports exactly one page for an empty result set', () => {
    const page = buildPage([], 0, { page: 1, pageSize: 10 });
    expect(page.pageCount).toBe(1);
    expect(page.hasPreviousPage).toBe(false);
    expect(page.hasNextPage).toBe(false);
  });

  it('reports one page when the total divides evenly by page size', () => {
    const page = buildPage(Array(10).fill('x'), 10, { page: 1, pageSize: 10 });
    expect(page.pageCount).toBe(1);
  });
});

describe('clampPage', () => {
  it('leaves an in-range page untouched', () => {
    expect(clampPage(3, 5)).toBe(3);
  });

  it('clamps a page past the end down to the last page', () => {
    expect(clampPage(9, 3)).toBe(3);
  });

  it('clamps a non-positive page up to 1', () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-2, 5)).toBe(1);
  });

  it('clamps a non-finite page to 1', () => {
    expect(clampPage(NaN, 5)).toBe(1);
  });

  it('never returns less than 1, even when pageCount is 0', () => {
    expect(clampPage(1, 0)).toBe(1);
  });
});
