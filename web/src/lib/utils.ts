import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind class names, with later classes winning conflicts.
 *
 * clsx resolves conditionals; twMerge then de-duplicates competing utilities so
 * that `cn('px-2', 'px-4')` yields `px-4` rather than both. This is what lets a
 * caller override a component's built-in padding without `!important`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
