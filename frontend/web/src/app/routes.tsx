import { Navigate, RouteObject } from 'react-router-dom';
import { USER_ROLES } from '@learnup/ts-common';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { RoleRoute } from '@/auth/RoleRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import {
  CHANGE_PASSWORD_PATH,
  LOGIN_PATH,
  PRICING_PATH,
  PROFILE_PATH,
  UNAUTHORIZED_PATH,
} from '@/config/routes';
import { getHomePath, getNavItems, ROLE_BASE_PATHS } from './navigation';
import { HomeRedirect } from './HomeRedirect';

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

/**
 * One group per role (/admin, /organizer, …) guarded by RoleRoute. Only the menu items available
 * in CURRENT_MILESTONE get a route; the others answer 404 until their milestone ships.
 */
const roleRoutes: RouteObject[] = USER_ROLES.map((role) => ({
  path: ROLE_BASE_PATHS[role],
  element: <RoleRoute allowedRoles={[role]} />,
  children: [
    { index: true, element: <Navigate to={getHomePath(role)} replace /> },
    ...getNavItems(role).map((item) => ({
      path: item.path,
      element: <PlaceholderPage titleKey={item.labelKey} />,
    })),
  ],
}));

export const routes: RouteObject[] = [
  // Auth pages render AuthLayout themselves: each one brings its own panel content.
  { path: LOGIN_PATH, element: <LoginPage /> },
  {
    element: <PublicLayout />,
    children: [{ path: PRICING_PATH, element: <PlaceholderPage titleKey="public.pricing" /> }],
  },
  {
    path: UNAUTHORIZED_PATH,
    element: <UnauthorizedPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <HomeRedirect /> },
      {
        element: <AppLayout />,
        children: [
          { path: PROFILE_PATH, element: <PlaceholderPage titleKey="account.profile" /> },
          {
            path: CHANGE_PASSWORD_PATH,
            element: <PlaceholderPage titleKey="account.changePassword" />,
          },
          ...roleRoutes,
        ],
      },
    ],
  },
  ...devRoutes,
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
