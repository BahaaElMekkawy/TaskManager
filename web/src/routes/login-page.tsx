import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon, SquareCheckBigIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import * as authApi from '@/features/auth/api';
import { loginSchema, type LoginInput } from '@/features/auth/schemas';
import { getErrorMessage } from '@/lib/errors';

interface RedirectState {
  from?: { pathname?: string };
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Set by ProtectedRoute when it bounced an unauthenticated visitor, so that
  // signing in continues to where they were actually going.
  const redirectTo =
    (location.state as RedirectState | null)?.from?.pathname ?? '/projects';

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginInput) {
    try {
      await authApi.signIn(values);
      void navigate(redirectTo, { replace: true });
    } catch (error) {
      // Shown above the form rather than as a toast: a credential error belongs
      // next to the fields it refers to, and toasts vanish before a slow reader
      // gets to them.
      form.setError('root', { message: getErrorMessage(error) });
    }
  }

  const rootError = form.formState.errors.root?.message;

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <SquareCheckBigIcon className="size-8" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to continue to TaskManager
          </p>
        </div>

        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {rootError ? (
                <p
                  role="alert"
                  className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
                >
                  {rootError}
                </p>
              ) : null}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" aria-hidden />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Don&rsquo;t have an account?{' '}
          <Link to="/register" className="text-foreground font-medium underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>

        {/* Demo credentials. Only rendered in development builds so a deployed
            instance never advertises working accounts. */}
        {import.meta.env.DEV ? (
          <p className="text-muted-foreground mt-4 rounded-md border border-dashed px-3 py-2 text-center text-xs">
            Demo: <span className="font-mono">alice@example.com</span> /{' '}
            <span className="font-mono">Password123!</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
