import { describe, expect, it } from 'vitest';

import { loginSchema, registerSchema } from '@/features/auth/schemas';

describe('loginSchema', () => {
  it('accepts a well-formed login', () => {
    const result = loginSchema.safeParse({
      email: 'alice@example.com',
      password: 'anything',
    });
    expect(result.success).toBe(true);
  });

  it('lower-cases the email so case does not create a duplicate identity', () => {
    const result = loginSchema.parse({ email: 'Alice@Example.com', password: 'x' });
    expect(result.email).toBe('alice@example.com');
  });

  it('rejects a malformed email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(
      false,
    );
  });

  it('does not enforce a minimum length on the login password', () => {
    // Deliberately not the 8-char register rule: enforcing it at login would
    // reveal that short passwords cannot exist and would lock out accounts
    // created before the rule was introduced.
    const result = loginSchema.safeParse({ email: 'alice@example.com', password: 'x' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'alice@example.com', password: '' }).success).toBe(
      false,
    );
  });
});

describe('registerSchema', () => {
  const valid = {
    displayName: 'Alice Johnson',
    email: 'alice@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  };

  it('accepts matching passwords', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects mismatched passwords and attaches the error to confirmPassword', () => {
    const result = registerSchema.safeParse({
      ...valid,
      confirmPassword: 'different123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
    }
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a password longer than 72 characters (bcrypt truncation boundary)', () => {
    const tooLong = 'a'.repeat(73);
    const result = registerSchema.safeParse({
      ...valid,
      password: tooLong,
      confirmPassword: tooLong,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a blank display name', () => {
    const result = registerSchema.safeParse({ ...valid, displayName: '   ' });
    expect(result.success).toBe(false);
  });
});
