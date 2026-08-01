import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as commentsApi from '@/features/comments/api';
import { commentKeys, taskKeys } from '@/lib/query-keys';

const COMMENTS_PAGE_SIZE = 20;

export function useComments(taskId: string, page: number) {
  return useQuery({
    queryKey: commentKeys.list(taskId, page),
    queryFn: () =>
      commentsApi.listComments({ taskId, page, pageSize: COMMENTS_PAGE_SIZE }),
  });
}

export function useAddComment(taskId: string, authorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) =>
      commentsApi.addComment(taskId, authorId, message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentKeys.lists(taskId) });
      // commentCount is embedded in the task detail header.
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => commentsApi.deleteComment(commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentKeys.lists(taskId) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}
