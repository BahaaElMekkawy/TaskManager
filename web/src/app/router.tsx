import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute, PublicOnlyRoute } from '@/app/protected-route';
import { NotFoundPage, RouteError } from '@/app/route-error';
import { LoginPage } from '@/routes/login-page';
import { ProjectDetailPage } from '@/routes/project-detail-page';
import { ProjectsPage } from '@/routes/projects-page';
import { RegisterPage } from '@/routes/register-page';
import { TaskDetailPage } from '@/routes/task-detail-page';

/**
 * Application routes.
 *
 * Two layout routes do the access control: PublicOnlyRoute keeps signed-in
 * users away from the auth screens, ProtectedRoute keeps signed-out users away
 * from everything else and supplies the app shell. Expressing it as nesting
 * rather than a check inside each page means a new route cannot accidentally
 * ship unprotected — it has to be placed under one branch or the other.
 *
 * Task detail is nested under its project so the URL carries both ids. That
 * keeps breadcrumbs and the "back to project" action honest without extra
 * lookups, and makes every view linkable.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <Navigate to="/projects" replace /> },
          { path: 'projects', element: <ProjectsPage /> },
          { path: 'projects/:projectId', element: <ProjectDetailPage /> },
          {
            path: 'projects/:projectId/tasks/:taskId',
            element: <TaskDetailPage />,
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
