import { describe, expect, it } from 'vitest';

import { mapProjectRow } from '@/features/projects/api';

describe('mapProjectRow', () => {
  const baseRow = {
    id: 'project-1',
    owner_id: 'user-1',
    name: 'Website Redesign',
    description: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    owner: { id: 'user-1', display_name: 'Alice', email: 'alice@example.com' },
  };

  it('unwraps the array-wrapped aggregate counts PostgREST returns', () => {
    const mapped = mapProjectRow({
      ...baseRow,
      tasks: [{ count: 12 }],
      project_members: [{ count: 3 }],
    });

    expect(mapped.taskCount).toBe(12);
    expect(mapped.memberCount).toBe(3);
  });

  it('defaults counts to 0 when PostgREST omits the aggregate entirely', () => {
    // Can happen for a project with zero related rows, depending on how the
    // embed resolves — must not crash reading [0].count off an empty array.
    const mapped = mapProjectRow({ ...baseRow, tasks: [], project_members: [] });

    expect(mapped.taskCount).toBe(0);
    expect(mapped.memberCount).toBe(0);
  });

  it('keeps the owner and project fields alongside the derived counts', () => {
    const mapped = mapProjectRow({ ...baseRow, tasks: [{ count: 1 }], project_members: [{ count: 1 }] });

    expect(mapped.id).toBe('project-1');
    expect(mapped.name).toBe('Website Redesign');
    expect(mapped.owner?.display_name).toBe('Alice');
  });
});
