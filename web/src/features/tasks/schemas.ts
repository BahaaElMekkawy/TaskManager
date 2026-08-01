import { z } from 'zod';

/**
 * Task form validation. Limits mirror the CHECK constraints in
 * supabase/migrations/20260801000600_tasks.sql.
 */

const NO_ASSIGNEE = 'none' as const;

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done']);
export const taskPrioritySchema = z.enum(['low', 'medium', 'high']);

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or fewer'),
  description: z
    .string()
    .trim()
    .max(5000, 'Description must be 5000 characters or fewer')
    .transform((value) => (value === '' ? null : value))
    .nullable(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  // Select components cannot represent `null` as a selectable option value, so
  // the form works with the string sentinel 'none' and this schema converts it
  // to null at the boundary — the only place that translation should happen.
  dueDate: z.string().nullable(),
  assigneeId: z
    .string()
    .transform((value) => (value === NO_ASSIGNEE ? null : value))
    .nullable(),
});

export type TaskFormInput = z.input<typeof taskFormSchema>;
export type TaskFormValues = z.output<typeof taskFormSchema>;

export { NO_ASSIGNEE };
