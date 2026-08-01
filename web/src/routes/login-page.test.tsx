import { AuthError } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as authApi from '@/features/auth/api';
import { LoginPage } from '@/routes/login-page';

vi.mock('@/features/auth/api');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a validation error and does not call the API for an invalid email', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'whatever');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(authApi.signIn).not.toHaveBeenCalled();
  });

  it('shows a validation error for an empty password', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(authApi.signIn).not.toHaveBeenCalled();
  });

  it('submits valid credentials and navigates to /projects on success', async () => {
    vi.mocked(authApi.signIn).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(authApi.signIn).toHaveBeenCalledWith({
        email: 'alice@example.com',
        password: 'Password123!',
      });
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/projects', { replace: true });
    });
  });

  it('shows a rewritten, vague message on bad credentials without redirecting', async () => {
    // A real AuthError instance, matching what supabase-js actually throws —
    // getErrorMessage rewrites this one specifically so it never confirms
    // whether the email or the password was wrong.
    vi.mocked(authApi.signIn).mockRejectedValue(
      new AuthError('Invalid login credentials', 400),
    );
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Incorrect email or password.',
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
