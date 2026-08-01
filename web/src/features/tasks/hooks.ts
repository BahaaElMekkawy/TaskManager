import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { TaskFilters } from '@/features/tasks/filters';
import * as tasksApi from '@/features/tasks/api';
import type { TaskFormValues } from '@/features/tasks/schemas';
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination';
import { projectKeys, taskKeys } from '@/lib/query-keys';
import type { TaskStatus } from '@/types/database';

export function useTasks(
  projectId: string,
  filters: TaskFilters,
  pageSize = DEFAULT_PAGE_SIZE,
) {
  return useQuery({
    queryKey: taskKeys.list(projectId, filters),
    queryFn: () =>
      tasksApi.listTasks({ projectId, filters, page: filters.page, pageSize }),
    placeholderData: keepPreviousData,
  });
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => tasksApi.getTask(taskId),
  });
}

export function useCreateTask(projectId: string, createdBy: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: TaskFormValues) =>
      tasksApi.createTask(projectId, values, createdBy),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists(projectId) });
      // taskCount is embedded on the project row shown in the list/detail header.
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useUpdateTask(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: TaskFormValues) => tasksApi.updateTask(taskId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists(projectId) });
    },
  });
}

/**
 * Status changes optimistically update the cache before the request resolves,
 * so dragging/clicking a status pill feels instant. On failure the previous
 * value is restored and the error surfaces via the caller's onError.
 */
export function useUpdateTaskStatus(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: TaskStatus) => tasksApi.updateTaskStatus(taskId, status),
    onMutate: async (status) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(taskId) });

      const previous = queryClient.getQueryData(taskKeys.detail(taskId));

      queryClient.setQueryData(
        taskKeys.detail(taskId),
        (current: tasksApi.TaskWithRelations | undefined) =>
          current ? { ...current, status } : current,
      );

      return { previous };
    },
    onError: (_error, _status, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.detail(taskId), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists(projectId) });
    },
  });
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => tasksApi.deleteTask(taskId),
    onSuccess: (_data, taskId) => {
      queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}
