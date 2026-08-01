import { zodResolver } from '@hookform/resolvers/zod';
import { formatDistanceToNow } from 'date-fns';
import { Loader2Icon, SendIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { ErrorState } from '@/components/error-state';
import { PaginationControls } from '@/components/pagination-controls';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAddComment, useComments, useDeleteComment } from '@/features/comments/hooks';
import { commentFormSchema, type CommentFormValues } from '@/features/comments/schemas';
import { getErrorMessage } from '@/lib/errors';

function initialsOf(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '?').slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

export function CommentThread({
  taskId,
  currentUserId,
}: {
  taskId: string;
  currentUserId: string;
}) {
  const [page, setPage] = useState(1);
  const commentsQuery = useComments(taskId, page);
  const addComment = useAddComment(taskId, currentUserId);
  const deleteComment = useDeleteComment(taskId);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  const form = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: { message: '' },
  });

  async function onSubmit(values: CommentFormValues) {
    try {
      const pageSize = commentsQuery.data?.pageSize ?? 20;
      // A new comment always lands on the last page. Computed from total + 1
      // rather than the pre-mutation pageCount, so a comment that fills the
      // current page and starts a new one still lands the user on it.
      const newTotal = (commentsQuery.data?.total ?? 0) + 1;
      const newLastPage = Math.max(1, Math.ceil(newTotal / pageSize));

      await addComment.mutateAsync(values.message);
      form.reset();
      setPage(newLastPage);
    } catch (error) {
      form.setError('root', { message: getErrorMessage(error) });
    }
  }

  const rootError = form.formState.errors.root?.message;

  return (
    <div className="space-y-4">
      {commentsQuery.isError ? (
        <ErrorState error={commentsQuery.error} onRetry={() => void commentsQuery.refetch()} />
      ) : commentsQuery.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : commentsQuery.data.items.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No comments yet. Start the conversation below.
        </p>
      ) : (
        <ul className="space-y-4">
          {commentsQuery.data.items.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar className="mt-0.5 size-8 shrink-0">
                <AvatarFallback className="text-xs">
                  {initialsOf(comment.author?.display_name ?? '?')}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">
                      {comment.author?.display_name ?? 'Unknown'}
                    </span>
                    <time
                      dateTime={comment.created_at}
                      className="text-muted-foreground text-xs"
                    >
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                      })}
                    </time>
                  </div>

                  {comment.author_id === currentUserId ? (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Delete comment"
                      onClick={() => setCommentToDelete(comment.id)}
                    >
                      <Trash2Icon className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>

                <p className="text-sm whitespace-pre-wrap">{comment.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {commentsQuery.data && commentsQuery.data.total > commentsQuery.data.pageSize ? (
        <PaginationControls
          page={page}
          pageSize={commentsQuery.data.pageSize}
          total={commentsQuery.data.total}
          pageCount={commentsQuery.data.pageCount}
          onPageChange={setPage}
          isLoading={commentsQuery.isFetching}
          itemNoun="comment"
        />
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 border-t pt-4" noValidate>
          {rootError ? (
            <p role="alert" className="text-destructive text-xs">
              {rootError}
            </p>
          ) : null}

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Write a comment…"
                    aria-label="Write a comment"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              ) : (
                <SendIcon className="size-4" aria-hidden />
              )}
              Comment
            </Button>
          </div>
        </form>
      </Form>

      <ConfirmDialog
        open={commentToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setCommentToDelete(null);
        }}
        title="Delete comment?"
        description="This cannot be undone."
        onConfirm={async () => {
          if (!commentToDelete) return;
          await deleteComment.mutateAsync(commentToDelete);
          toast.success('Comment deleted');
        }}
      />
    </div>
  );
}
