import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as authApi from '@/features/auth/api';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /**
   * True until the initial session lookup finishes. Routing must wait for this:
   * redirecting while it is true would bounce a signed-in user to /login on
   * every refresh, because the session is restored from storage asynchronously.
   */
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    // Two things are needed, and the order matters. getSession() resolves the
    // session already in storage; onAuthStateChange keeps it current afterwards
    // (token refresh, sign-out, sign-out triggered in another tab). Subscribing
    // first means no event can slip through between the two calls.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      setSession(nextSession);
      setIsLoading(false);

      // Cached data belongs to the user who fetched it. Without this, signing
      // in as someone else on the same browser would briefly render the
      // previous user's projects from cache before the refetch lands.
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        queryClient.clear();
      }
    });

    void authApi
      .getSession()
      .then((existing) => {
        if (!active) return;
        setSession(existing);
      })
      .catch(() => {
        // A corrupt or expired token in storage is not an app error — treat it
        // as "signed out" and let the user log in again.
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await authApi.signOut();
    // Not setting session to null here: onAuthStateChange fires SIGNED_OUT and
    // owns that transition. Doing it in both places invites them to disagree.
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signOut,
    }),
    [session, isLoading, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}

/**
 * The signed-in user, asserted non-null.
 *
 * For use only inside protected routes, where the router has already
 * guaranteed a session. Saves every component below that boundary from
 * null-checking a value that cannot be null.
 */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) {
    throw new Error(
      'useCurrentUser was called outside a protected route — there is no signed-in user.',
    );
  }
  return user;
}
