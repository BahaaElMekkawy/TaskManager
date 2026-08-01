import type { TaskFilters } from '@/features/tasks/filters';

/**
 * Every React Query cache key in the application, in one place.
 *
 * Query keys are a public API between the code that reads data and the code
 * that invalidates it. Spelling them inline means a mutation invalidates
 * `['tasks', projectId]` while the query registered `['tasks', { projectId }]`,
 * the arrays never match, and the list silently fails to refresh — a bug with
 * no error message anywhere.
 *
 * The hierarchy is deliberate: keys nest from general to specific, so
 * invalidating `taskKeys.lists(projectId)` clears every filter/page combination
 * for that project in one call, without touching other projects' caches.
 */

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (page: number, pageSize: number, search: string) =>
    [...projectKeys.lists(), { page, pageSize, search }] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (projectId: string) => [...projectKeys.details(), projectId] as const,
  members: (projectId: string) =>
    [...projectKeys.detail(projectId), 'members'] as const,
};

export const taskKeys = {
  all: ['tasks'] as const,
  lists: (projectId: string) => [...taskKeys.all, 'list', projectId] as const,
  list: (projectId: string, filters: TaskFilters) =>
    [...taskKeys.lists(projectId), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (taskId: string) => [...taskKeys.details(), taskId] as const,
};

export const commentKeys = {
  all: ['comments'] as const,
  lists: (taskId: string) => [...commentKeys.all, 'list', taskId] as const,
  list: (taskId: string, page: number) =>
    [...commentKeys.lists(taskId), { page }] as const,
};
