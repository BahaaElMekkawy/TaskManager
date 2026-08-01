import { describe, expect, it } from 'vitest';

import { NO_ASSIGNEE, taskFormSchema } from '@/features/tasks/schemas';

describe('taskFormSchema', () => {
  const valid = {
    title: 'Rebuild the primary navigation',
    description: 'Responsive drawer under 768px.',
    status: 'todo' as const,
    priority: 'medium' as const,
    dueDate: '2026-03-01',
    assigneeId: 'user-123',
  };

  it('accepts a fully populated task', () => {
    expect(taskFormSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(taskFormSchema.safeParse({ ...valid, title: '   ' }).success).toBe(false);
  });

  it('rejects a title over 200 characters, matching the database constraint', () => {
    const result = taskFormSchema.safeParse({ ...valid, title: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('converts an empty description to null rather than an empty string', () => {
    const result = taskFormSchema.parse({ ...valid, description: '' });
    expect(result.description).toBeNull();
  });

  it('converts the NO_ASSIGNEE sentinel to null', () => {
    const result = taskFormSchema.parse({ ...valid, assigneeId: NO_ASSIGNEE });
    expect(result.assigneeId).toBeNull();
  });

  it('preserves a real assignee id unchanged', () => {
    const result = taskFormSchema.parse({ ...valid, assigneeId: 'user-456' });
    expect(result.assigneeId).toBe('user-456');
  });

  it('accepts a null due date (no deadline set)', () => {
    const result = taskFormSchema.safeParse({ ...valid, dueDate: null });
    expect(result.success).toBe(true);
  });

  it('rejects a status outside the three supported values', () => {
    const result = taskFormSchema.safeParse({ ...valid, status: 'archived' });
    expect(result.success).toBe(false);
  });

  it('rejects a priority outside the three supported values', () => {
    const result = taskFormSchema.safeParse({ ...valid, priority: 'urgent' });
    expect(result.success).toBe(false);
  });
});
