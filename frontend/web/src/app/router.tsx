import { createBrowserRouter, Navigate, RouteObject } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { DEFAULT_AUTHENTICATED_PATH } from '@/config/routes';

// Development-only tooling. import.meta.env.DEV is statically false in production builds, so
// this branch and the lazy import below are removed and never emitted as a chunk.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/ui',
        lazy: async () => {
          const { UiShowcasePage } = await import('@/dev/UiShowcasePage');
          return { Component: UiShowcasePage };
        },
      },
    ]
  : [];

const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        index: true,
        element: <Navigate to={DEFAULT_AUTHENTICATED_PATH} replace />,
      },
      {
        path: DEFAULT_AUTHENTICATED_PATH,
        element: <PlaceholderPage />,
      },
    ],
  },
  ...devRoutes,
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export const router = createBrowserRouter(routes, {
  future: { v7_relativeSplatPath: true },
});
