import { z } from 'zod';

import { emailSchema } from '@/features/auth/schemas';

/**
 * Project form validation.
 *
 * Limits mirror the CHECK constraints in
 * supabase/migrations/20260801000400_projects.sql. The database is the
 * authority — these exist so the user gets an inline message instead of a
 * round trip ending in a generic constraint violation. When one changes, the
 * other must change with it.
 */

export const projectFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Project name is required')
    .max(120, 'Project name must be 120 characters or fewer'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be 2000 characters or fewer')
    // An empty textarea yields '', which is not the same as "no description".
    // Normalising to null keeps the column clean and makes `description ?? ''`
    // unnecessary everywhere it is read.
    .transform((value) => (value === '' ? null : value))
    .nullable(),
});

export const addMemberSchema = z.object({
  email: emailSchema,
});

export type ProjectFormInput = z.input<typeof projectFormSchema>;
export type ProjectFormValues = z.output<typeof projectFormSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
