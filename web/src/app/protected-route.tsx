import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { AppShell } from '@/app/app-shell';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { useAuth } from '@/features/auth/auth-provider';

/**
 * Gate for everything behind authentication.
 *
 * The `isLoading` branch is the important one. Restoring a session from storage
 * is asynchronous, so on a hard refresh there is a moment where the user is
 * signed in but `session` is still null. Redirecting during that window would
 * throw an authenticated user back to the login page on every refresh — a bug
 * that is invisible in development, where the check usually resolves before
 * first paint.
 *
 * This is a convenience boundary, not a security boundary. Anyone can edit the
 * bundle and render whatever route they like; what stops them seeing data is
 * Row Level Security in the database.
 */
export function ProtectedRoute() {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageSpinner label="Loading your workspace" />;
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        // Remember where they were headed so login can return them there
        // instead of dumping everyone on the projects list.
        state={{ from: location }}
      />
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

/**
 * The inverse: keeps a signed-in user off /login and /register.
 *
 * Without this, following a stale bookmark to /login while authenticated shows
 * a login form that appears broken — submitting it just returns you to where
 * you already were.
 */
export function PublicOnlyRoute() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageSpinner label="Loading" />;
  }

  if (session) {
    return <Navigate to="/projects" replace />;
  }

  return <Outlet />;
}
