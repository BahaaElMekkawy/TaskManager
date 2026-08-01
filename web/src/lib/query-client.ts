import { QueryClient } from '@tanstack/react-query';

import { isAuthenticationError } from '@/lib/errors';

/**
 * TanStack Query configuration.
 *
 * The defaults worth explaining:
 *
 * - `staleTime: 30s` — task lists do not change under you every second, and a
 *   zero stale time makes every window focus refetch the whole page. Thirty
 *   seconds keeps navigation instant without serving obviously stale data.
 *
 * - retries skip 4xx — a 403 from RLS or a 404 will fail identically three
 *   times over. Retrying only server/network faults means a permission error
 *   surfaces immediately instead of after three round trips.
 *
 * - mutations do not retry at all — replaying a create after an ambiguous
 *   failure risks a duplicate row, which is worse than showing the error.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isAuthenticationError(error)) return false;
          if (isClientError(error)) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** True for 4xx-equivalent failures, which will not succeed on a retry. */
function isClientError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  if ('status' in error && typeof error.status === 'number') {
    return error.status >= 400 && error.status < 500;
  }

  // PostgREST reports its own errors with a code rather than an HTTP status.
  if ('code' in error && typeof error.code === 'string') {
    return error.code.startsWith('PGRST') || /^[0-9A-Z]{5}$/.test(error.code);
  }

  return false;
}
