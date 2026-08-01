import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProtectedRoute, PublicOnlyRoute } from '@/app/protected-route';
import * as authProvider from '@/features/auth/auth-provider';

vi.mock('@/features/auth/auth-provider', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth/auth-provider')>(
    '@/features/auth/auth-provider',
  );
  return { ...actual, useAuth: vi.fn() };
});

// AppShell renders the authenticated nav (theme toggle, account menu), which
// pulls in more providers than this route-guard test needs. Stubbing it keeps
// the test focused on redirect behaviour rather than shell chrome.
vi.mock('@/app/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function mockAuth(overrides: Partial<ReturnType<typeof authProvider.useAuth>>) {
  vi.mocked(authProvider.useAuth).mockReturnValue({
    session: null,
    user: null,
    isLoading: false,
    signOut: vi.fn(),
    ...overrides,
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<div>Login page</div>} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/projects" element={<div>Projects page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('shows a loading state instead of redirecting while the session is restoring', () => {
    mockAuth({ isLoading: true, session: null });
    renderAt('/projects');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Projects page')).not.toBeInTheDocument();
  });

  it('redirects to /login when there is no session', () => {
    mockAuth({ isLoading: false, session: null });
    renderAt('/projects');

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders the protected content when a session is present', () => {
    mockAuth({ isLoading: false, session: {} as never });
    renderAt('/projects');

    expect(screen.getByText('Projects page')).toBeInTheDocument();
  });
});

describe('PublicOnlyRoute', () => {
  it('renders the login page when signed out', () => {
    mockAuth({ isLoading: false, session: null });
    renderAt('/login');

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('redirects a signed-in user away from /login', () => {
    mockAuth({ isLoading: false, session: {} as never });
    renderAt('/login');

    expect(screen.getByText('Projects page')).toBeInTheDocument();
  });
});
