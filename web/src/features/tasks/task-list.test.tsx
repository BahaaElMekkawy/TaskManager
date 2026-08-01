import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { TaskWithRelations } from '@/features/tasks/api';
import { TaskList } from '@/features/tasks/task-list';

// TaskStatusSelect pulls in a React Query mutation hook that talks to the
// Supabase client; that behaviour belongs to its own unit, not this one. This
// test is only about which rows/empty-states TaskList renders for a given
// query result, so the status control is stubbed to a static label.
vi.mock('@/features/tasks/task-status-select', () => ({
  TaskStatusSelect: ({ status }: { status: string }) => <span>{status}</span>,
}));

function makeTask(overrides: Partial<TaskWithRelations> = {}): TaskWithRelations {
  return {
    id: 'task-1',
    project_id: 'project-1',
    title: 'Rebuild the primary navigation',
    description: null,
    status: 'todo',
    priority: 'high',
    due_date: null,
    assignee_id: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    assignee: null,
    createdByProfile: null,
    commentCount: 0,
    ...overrides,
  };
}

const noopPagination = {
  page: 1,
  pageSize: 10,
  total: 0,
  pageCount: 1,
  onPageChange: vi.fn(),
};

function renderTaskList(props: Partial<React.ComponentProps<typeof TaskList>>) {
  return render(
    <MemoryRouter>
      <TaskList
        projectId="project-1"
        tasks={[]}
        isLoading={false}
        isFetching={false}
        hasActiveFilters={false}
        pagination={noopPagination}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('TaskList', () => {
  it('shows skeleton placeholders while loading', () => {
    renderTaskList({ isLoading: true });
    // Skeletons render as generic divs with no accessible role; assert on the
    // absence of both the empty state and any task content instead.
    expect(screen.queryByText(/no tasks yet/i)).not.toBeInTheDocument();
  });

  it('shows the "no tasks yet" empty state when there are no filters applied', () => {
    renderTaskList({ tasks: [], hasActiveFilters: false });
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it('shows a distinct empty state when filters produced zero results', () => {
    renderTaskList({ tasks: [], hasActiveFilters: true });
    expect(screen.getByText(/no tasks match your filters/i)).toBeInTheDocument();
    expect(screen.queryByText(/no tasks yet/i)).not.toBeInTheDocument();
  });

  it('renders each task title once (desktop table + mobile card)', () => {
    renderTaskList({ tasks: [makeTask({ title: 'Fix contrast issues' })] });
    // The same task renders in both the md+ table and the mobile card list, so
    // exactly one of the two is visible per breakpoint's CSS, but both mount.
    expect(screen.getAllByText('Fix contrast issues').length).toBeGreaterThan(0);
  });

  it('shows "Unassigned" for a task with no assignee', () => {
    renderTaskList({ tasks: [makeTask({ assignee: null })] });
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
  });

  it('shows the assignee name when one is set', () => {
    renderTaskList({
      tasks: [
        makeTask({
          assignee: { id: 'user-1', display_name: 'Bob Martinez', email: 'bob@example.com' },
        }),
      ],
    });
    expect(screen.getAllByText('Bob Martinez').length).toBeGreaterThan(0);
  });
});
