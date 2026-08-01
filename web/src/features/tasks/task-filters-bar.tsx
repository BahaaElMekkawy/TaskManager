import { FilterXIcon, SearchIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProfileRef } from '@/features/projects/api';
import {
  ALL,
  UNASSIGNED,
  hasActiveFilters,
  type TaskFilters,
} from '@/features/tasks/filters';
import { PRIORITY_LABELS, PRIORITY_OPTIONS, STATUS_LABELS, STATUS_OPTIONS } from '@/features/tasks/status-priority';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';

/**
 * Search + status/priority/assignee/due-date filters for the task list.
 *
 * Every control here is uncontrolled-by-value and controlled-by-callback: the
 * bar receives the current TaskFilters and an onChange, and never owns state
 * itself. The URL (via the parent's useSearchParams) is the single source of
 * truth — see features/tasks/filters.ts for why.
 */
export function TaskFiltersBar({
  filters,
  members,
  onChange,
}: {
  filters: TaskFilters;
  members: ProfileRef[];
  onChange: (change: Partial<TaskFilters>) => void;
}) {
  // Controlled, but the last change WE made is tracked so an external update
  // to filters.search (browser back/forward, "Clear filters") is reflected in
  // the box, while our own debounce round trip doesn't fight what the user is
  // still typing.
  const [searchText, setSearchText] = useState(filters.search);
  const lastEmittedSearch = useRef(filters.search);

  useEffect(() => {
    if (filters.search !== lastEmittedSearch.current) {
      lastEmittedSearch.current = filters.search;
      setSearchText(filters.search);
    }
  }, [filters.search]);

  const debouncedSearchChange = useDebouncedCallback((value: string) => {
    lastEmittedSearch.current = value;
    onChange({ search: value });
  }, 300);

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="relative max-w-sm flex-1">
        <SearchIcon
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search by title…"
          value={searchText}
          className="pl-9"
          aria-label="Search tasks by title"
          onChange={(event) => {
            setSearchText(event.target.value);
            debouncedSearchChange(event.target.value);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.status}
          onValueChange={(value) => onChange({ status: value as TaskFilters['status'] })}
        >
          <SelectTrigger className="w-36" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.priority}
          onValueChange={(value) =>
            onChange({ priority: value as TaskFilters['priority'] })
          }
        >
          <SelectTrigger className="w-36" aria-label="Filter by priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All priorities</SelectItem>
            {PRIORITY_OPTIONS.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.assigneeId}
          onValueChange={(value) => onChange({ assigneeId: value })}
        >
          <SelectTrigger className="w-44" aria-label="Filter by assignee">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Anyone</SelectItem>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label="Due from"
            value={filters.dueFrom ?? ''}
            onChange={(event) => onChange({ dueFrom: event.target.value || null })}
            className="w-[9.5rem]"
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="date"
            aria-label="Due to"
            value={filters.dueTo ?? ''}
            onChange={(event) => onChange({ dueTo: event.target.value || null })}
            className="w-[9.5rem]"
          />
        </div>

        {hasActiveFilters(filters) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                search: '',
                status: ALL,
                priority: ALL,
                assigneeId: ALL,
                dueFrom: null,
                dueTo: null,
              })
            }
          >
            <FilterXIcon className="size-4" aria-hidden />
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
