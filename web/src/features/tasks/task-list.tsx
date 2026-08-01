import { format, isPast, isToday } from 'date-fns';
import { ListTodoIcon, MessageSquareIcon, SearchXIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination-controls';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TaskWithRelations } from '@/features/tasks/api';
import { PriorityBadge } from '@/features/tasks/status-priority';
import { TaskStatusSelect } from '@/features/tasks/task-status-select';
import { cn } from '@/lib/utils';

function initialsOf(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '?').slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

function DueDate({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground text-sm">—</span>;

  // Parsed as a plain calendar date, not a UTC instant — matches how due_date
  // is stored (see the tasks migration). Using `new Date(value)` directly
  // would shift the date backwards for any timezone west of UTC.
  const date = new Date(`${value}T00:00:00`);
  const overdue = isPast(date) && !isToday(date);

  return (
    <span
      className={cn('text-sm', overdue ? 'text-destructive font-medium' : 'text-foreground')}
    >
      {format(date, 'MMM d, yyyy')}
    </span>
  );
}

interface TaskListProps {
  projectId: string;
  tasks: TaskWithRelations[];
  isLoading: boolean;
  isFetching: boolean;
  hasActiveFilters: boolean;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
    onPageChange: (page: number) => void;
  };
}

export function TaskList({
  projectId,
  tasks,
  isLoading,
  isFetching,
  hasActiveFilters,
  pagination,
}: TaskListProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return <TaskListSkeleton />;
  }

  if (tasks.length === 0) {
    return hasActiveFilters ? (
      <EmptyState
        icon={SearchXIcon}
        title="No tasks match your filters"
        description="Try a different search term or clear the active filters."
      />
    ) : (
      <EmptyState
        icon={ListTodoIcon}
        title="No tasks yet"
        description="Create the first task to get this project moving."
      />
    );
  }

  function goToTask(taskId: string) {
    void navigate(`/projects/${projectId}/tasks/${taskId}`);
  }

  return (
    <div className="space-y-4">
      {/* Table from md upward; the same data renders as cards below md, where a
          multi-column table would force horizontal scrolling. */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Comments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow
                key={task.id}
                className="cursor-pointer"
                onClick={() => goToTask(task.id)}
              >
                <TableCell className="max-w-xs truncate font-medium">
                  {task.title}
                </TableCell>
                <TableCell>
                  <TaskStatusSelect
                    projectId={projectId}
                    taskId={task.id}
                    status={task.status}
                    onClick={(event) => event.stopPropagation()}
                  />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={task.priority} />
                </TableCell>
                <TableCell>
                  {task.assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[10px]">
                          {initialsOf(task.assignee.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{task.assignee.display_name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  <DueDate value={task.due_date} />
                </TableCell>
                <TableCell className="text-right">
                  {task.commentCount > 0 ? (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
                      <MessageSquareIcon className="size-3.5" aria-hidden />
                      {task.commentCount}
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-2 md:hidden">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => goToTask(task.id)}
              className="bg-card hover:border-ring w-full space-y-2 rounded-lg border p-4 text-left transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{task.title}</span>
                <PriorityBadge priority={task.priority} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <TaskStatusSelect
                  projectId={projectId}
                  taskId={task.id}
                  status={task.status}
                  onClick={(event) => event.stopPropagation()}
                />
                <DueDate value={task.due_date} />
              </div>

              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>{task.assignee?.display_name ?? 'Unassigned'}</span>
                {task.commentCount > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <MessageSquareIcon className="size-3.5" aria-hidden />
                    {task.commentCount}
                  </span>
                ) : null}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <PaginationControls
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        pageCount={pagination.pageCount}
        onPageChange={pagination.onPageChange}
        isLoading={isFetching}
        itemNoun="task"
      />
    </div>
  );
}

function TaskListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}
