import { format } from 'date-fns';
import { CalendarIcon, ChevronRightIcon, PencilIcon, Trash2Icon, UserIcon } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { ErrorState } from '@/components/error-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/auth-provider';
import { CommentThread } from '@/features/comments/comment-thread';
import { useProject, useProjectMembers } from '@/features/projects/hooks';
import { PriorityBadge } from '@/features/tasks/status-priority';
import { TaskFormDialog } from '@/features/tasks/task-form-dialog';
import { TaskStatusSelect } from '@/features/tasks/task-status-select';
import { useDeleteTask, useTask } from '@/features/tasks/hooks';

export function TaskDetailPage() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  if (!projectId || !taskId) {
    throw new Error('TaskDetailPage rendered without projectId/taskId params');
  }

  const user = useCurrentUser();
  const navigate = useNavigate();

  const projectQuery = useProject(projectId);
  const membersQuery = useProjectMembers(projectId);
  const taskQuery = useTask(taskId);
  const deleteTask = useDeleteTask(projectId);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  if (taskQuery.isError) {
    return (
      <ErrorState
        error={taskQuery.error}
        onRetry={() => void taskQuery.refetch()}
        title="Could not load this task"
      />
    );
  }

  if (taskQuery.isPending || projectQuery.isPending) {
    return <TaskDetailSkeleton />;
  }

  const task = taskQuery.data;
  const project = projectQuery.data;
  const members = (membersQuery.data ?? []).map((member) => member.profile);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumb={
          <nav className="text-muted-foreground flex min-w-0 items-center gap-1 text-sm">
            <Link to="/projects" className="hover:text-foreground shrink-0">
              Projects
            </Link>
            <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
            <Link
              to={`/projects/${projectId}`}
              className="hover:text-foreground truncate"
            >
              {project?.name}
            </Link>
            <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="text-foreground truncate">{task.title}</span>
          </nav>
        }
        title={task.title}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
              <PencilIcon className="size-4" aria-hidden />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2Icon className="size-4" aria-hidden />
              Delete
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <Card>
          <CardContent className="space-y-4 pt-6">
            {task.description ? (
              <p className="text-sm whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="text-muted-foreground text-sm">No description.</p>
            )}
          </CardContent>
        </Card>

        <Card className="w-full sm:w-64">
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">Status</span>
              <div>
                <TaskStatusSelect projectId={projectId} taskId={taskId} status={task.status} />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">Priority</span>
              <div>
                <PriorityBadge priority={task.priority} />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                <UserIcon className="size-3.5" aria-hidden />
                Assignee
              </span>
              <p className="text-sm">{task.assignee?.display_name ?? 'Unassigned'}</p>
            </div>

            <div className="space-y-1.5">
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                <CalendarIcon className="size-3.5" aria-hidden />
                Due date
              </span>
              <p className="text-sm">
                {task.due_date
                  ? format(new Date(`${task.due_date}T00:00:00`), 'MMM d, yyyy')
                  : 'No due date'}
              </p>
            </div>

            <Separator />

            <div className="text-muted-foreground space-y-1 text-xs">
              <p>Created {format(new Date(task.created_at), 'MMM d, yyyy')}</p>
              <p>Updated {format(new Date(task.updated_at), 'MMM d, yyyy')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <CommentThread taskId={taskId} currentUserId={user.id} />
        </CardContent>
      </Card>

      <TaskFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        projectId={projectId}
        members={members}
        task={task}
      />

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete task?"
        description={`This permanently deletes "${task.title}" and its comments. This cannot be undone.`}
        onConfirm={async () => {
          await deleteTask.mutateAsync(taskId);
          toast.success('Task deleted');
          void navigate(`/projects/${projectId}`, { replace: true });
        }}
      />
    </div>
  );
}

function TaskDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full sm:w-64" />
      </div>
    </div>
  );
}
