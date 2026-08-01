import { CircleCheckIcon, CircleDotIcon, CircleIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { TaskPriority, TaskStatus } from '@/types/database';

/**
 * Presentation metadata for the status/priority enums, kept in one place so a
 * status never has different labels or colours in two parts of the UI.
 */

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export const STATUS_OPTIONS: readonly TaskStatus[] = ['todo', 'in_progress', 'done'];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const PRIORITY_OPTIONS: readonly TaskPriority[] = ['low', 'medium', 'high'];

const STATUS_ICONS: Record<TaskStatus, typeof CircleIcon> = {
  todo: CircleIcon,
  in_progress: CircleDotIcon,
  done: CircleCheckIcon,
};

const STATUS_CLASSES: Record<TaskStatus, string> = {
  todo: 'bg-status-todo-bg text-status-todo',
  in_progress: 'bg-status-progress-bg text-status-progress',
  done: 'bg-status-done-bg text-status-done',
};

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  low: 'bg-priority-low-bg text-priority-low',
  medium: 'bg-priority-medium-bg text-priority-medium',
  high: 'bg-priority-high-bg text-priority-high',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_CLASSES[status],
      )}
    >
      <Icon className="size-3" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        PRIORITY_CLASSES[priority],
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
