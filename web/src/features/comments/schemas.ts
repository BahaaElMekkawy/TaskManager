import { z } from 'zod';

/** Mirrors the CHECK constraint in supabase/migrations/20260801000700_comments.sql. */
export const commentFormSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(4000, 'Comment must be 4000 characters or fewer'),
});

export type CommentFormValues = z.infer<typeof commentFormSchema>;
