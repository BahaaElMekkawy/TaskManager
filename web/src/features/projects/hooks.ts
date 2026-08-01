import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import * as projectsApi from '@/features/projects/api';
import type { ProjectFormValues } from '@/features/projects/schemas';
import { projectKeys } from '@/lib/query-keys';
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination';

/**
 * React Query bindings for projects.
 *
 * Components use these rather than calling the api module directly, so caching,
 * invalidation and loading state are decided once here instead of being
 * reinvented (differently) in each screen.
 */

export function useProjects(page: number, search: string, pageSize = DEFAULT_PAGE_SIZE) {
  return useQuery({
    queryKey: projectKeys.list(page, pageSize, search),
    queryFn: () => projectsApi.listProjects({ page, pageSize, search }),
    // Without this the table unmounts to a spinner on every page change, so the
    // layout jumps and the scroll position is lost. keepPreviousData holds the
    // old rows until the new ones arrive.
    placeholderData: keepPreviousData,
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectsApi.getProject(projectId),
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: projectKeys.members(projectId),
    queryFn: () => projectsApi.listProjectMembers(projectId),
  });
}

export function useCreateProject(ownerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ProjectFormValues) =>
      projectsApi.createProject(values, ownerId),
    onSuccess: () => {
      // Invalidate the whole list branch, not one page: a new project can shift
      // every subsequent page, and the total count on all of them is now wrong.
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ProjectFormValues) =>
      projectsApi.updateProject(projectId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => projectsApi.deleteProject(projectId),
    onSuccess: (_data, projectId) => {
      // Drop the detail cache outright: navigating back to a deleted project
      // should refetch and 404, not render a stale copy from cache.
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: string) =>
      projectsApi.addProjectMemberByEmail(projectId, email),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.members(projectId) });
      // memberCount is embedded in the project row, so that is stale too.
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      projectsApi.removeProjectMember(projectId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.members(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}
