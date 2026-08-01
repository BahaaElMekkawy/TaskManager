import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_TASK_FILTERS } from '@/features/tasks/filters';
import { TaskFiltersBar } from '@/features/tasks/task-filters-bar';

const members = [
  { id: 'user-1', display_name: 'Alice Johnson', email: 'alice@example.com' },
  { id: 'user-2', display_name: 'Bob Martinez', email: 'bob@example.com' },
];

describe('TaskFiltersBar', () => {
  it('debounces the search box and reports the trimmed value once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();

    render(
      <TaskFiltersBar filters={DEFAULT_TASK_FILTERS} members={members} onChange={onChange} />,
    );

    await user.type(screen.getByLabelText(/search tasks by title/i), 'checkout');
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({ search: 'checkout' });
    });

    vi.useRealTimers();
  });

  it('reports a status filter change immediately, without debouncing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TaskFiltersBar filters={DEFAULT_TASK_FILTERS} members={members} onChange={onChange} />,
    );

    await user.click(screen.getByLabelText(/filter by status/i));
    await user.click(await screen.findByRole('option', { name: 'In progress' }));

    expect(onChange).toHaveBeenCalledWith({ status: 'in_progress' });
  });

  it('lists each project member as an assignee option', async () => {
    const user = userEvent.setup();
    render(
      <TaskFiltersBar filters={DEFAULT_TASK_FILTERS} members={members} onChange={vi.fn()} />,
    );

    await user.click(screen.getByLabelText(/filter by assignee/i));

    expect(await screen.findByRole('option', { name: 'Alice Johnson' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bob Martinez' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Unassigned' })).toBeInTheDocument();
  });

  it('does not show a "Clear filters" button when nothing is active', () => {
    render(
      <TaskFiltersBar filters={DEFAULT_TASK_FILTERS} members={members} onChange={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it('clearing filters resets every field in one call', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TaskFiltersBar
        filters={{ ...DEFAULT_TASK_FILTERS, status: 'done', search: 'nav' }}
        members={members}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(onChange).toHaveBeenCalledWith({
      search: '',
      status: 'all',
      priority: 'all',
      assigneeId: 'all',
      dueFrom: null,
      dueTo: null,
    });
  });
});
