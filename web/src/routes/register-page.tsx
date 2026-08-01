import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon, SquareCheckBigIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import * as authApi from '@/features/auth/api';
import { registerSchema, type RegisterInput } from '@/features/auth/schemas';
import { getErrorMessage } from '@/lib/errors';

export function RegisterPage() {
  const navigate = useNavigate();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: RegisterInput) {
    try {
      const { session } = await authApi.signUp(values);

      if (session) {
        // Auto-confirm is on locally, so the user is already signed in.
        toast.success('Account created. Welcome!');
        void navigate('/projects', { replace: true });
        return;
      }

      // Only reachable if email confirmation is switched on in .env.
      toast.success('Account created. Check your email to confirm it.');
      void navigate('/login', { replace: true });
    } catch (error) {
      form.setError('root', { message: getErrorMessage(error) });
    }
  }

  const rootError = form.formState.errors.root?.message;

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <SquareCheckBigIcon className="size-8" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
          <p className="text-muted-foreground text-sm">
            Start planning projects in a couple of clicks
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
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" placeholder="Alice Johnson" {...field} />
                    </FormControl>
                    <FormDescription>
                      Shown to collaborators on tasks and comments.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormDescription>At least 8 characters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
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
                    Creating account…
                  </>
                ) : (
                  'Create account'
                )}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-foreground font-medium underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
