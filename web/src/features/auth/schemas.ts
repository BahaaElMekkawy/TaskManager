import { z } from 'zod';

/**
 * Validation for the authentication forms.
 *
 * These schemas are the single source of truth for what the forms accept:
 * react-hook-form validates against them, and the inferred types become the
 * argument types of the api functions. A field cannot be added to a form
 * without the API signature following it.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  // Emails are case-insensitive in practice, and the membership RPC matches on
  // lower(email). Normalising here stops "Alice@..." and "alice@..." behaving
  // like two different accounts.
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  // bcrypt silently truncates beyond 72 bytes, so anything longer gives a false
  // sense of strength. Reject it rather than accept a password that is not
  // fully checked at sign-in.
  .max(72, 'Password must be 72 characters or fewer');

export const loginSchema = z.object({
  email: emailSchema,
  // Deliberately not `passwordSchema`: applying the 8-character rule at login
  // would tell an attacker that short passwords cannot exist, and would lock
  // out any account created before the rule changed.
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(80, 'Name must be 80 characters or fewer'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    // Attach to the confirm field so the message renders under the input the
    // user needs to fix, not at the top of the form.
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
