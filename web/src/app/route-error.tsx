import { AlertTriangleIcon } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';

/**
 * Last-resort boundary for anything a route throws during render.
 *
 * Without an errorElement, React Router replaces the entire page with a blank
 * screen and a console message — the worst possible failure mode, because it
 * looks identical to the app not loading at all.
 */
export function RouteError() {
  const error = useRouteError();

  const { title, detail } = isRouteErrorResponse(error)
    ? {
        title: error.status === 404 ? 'Page not found' : `Error ${error.status}`,
        detail: error.statusText || 'Something went wrong.',
      }
    : { title: 'Something went wrong', detail: getErrorMessage(error) };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <AlertTriangleIcon className="size-6" aria-hidden />
      </div>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground max-w-md text-sm">{detail}</p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button asChild>
          <Link to="/projects">Back to projects</Link>
        </Button>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-muted-foreground text-6xl font-semibold tracking-tight">404</p>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground text-sm">
          That page does not exist, or you no longer have access to it.
        </p>
      </div>
      <Button asChild>
        <Link to="/projects">Back to projects</Link>
      </Button>
    </div>
  );
}
