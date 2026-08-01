import { toast } from 'sonner';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateTaskStatus } from '@/features/tasks/hooks';
import { STATUS_LABELS, STATUS_OPTIONS } from '@/features/tasks/status-priority';
import { getErrorMessage } from '@/lib/errors';
import type { TaskStatus } from '@/types/database';

/**
 * Inline status changer, used on the task list and detail views.
 *
 * Wraps useUpdateTaskStatus, which applies the change optimistically — the
 * select value flips immediately and rolls back only if the request fails, so
 * this is the one control in the app that doesn't show a loading state for its
 * own mutation.
 */
export function TaskStatusSelect({
  projectId,
  taskId,
  status,
  onClick,
}: {
  projectId: string;
  taskId: string;
  status: TaskStatus;
  /** Stops the click from bubbling to a parent row/card Link. */
  onClick?: (event: React.MouseEvent) => void;
}) {
  const updateStatus = useUpdateTaskStatus(projectId, taskId);

  return (
    <Select
      value={status}
      onValueChange={(value) => {
        updateStatus.mutate(value as TaskStatus, {
          onError: (error) => toast.error(getErrorMessage(error)),
        });
      }}
    >
      <SelectTrigger
        size="sm"
        className="w-36"
        aria-label="Change status"
        onClick={onClick}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent onClick={onClick}>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option} value={option}>
            {STATUS_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
