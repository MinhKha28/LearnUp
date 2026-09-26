import { http, HttpResponse } from 'msw';
import {
  createErrorResponse,
  createSuccessResponse,
  STANDARD_ERROR_CODES,
  USER_ROLES,
  type ApiResponse,
  type UserRole,
} from '@learnup/ts-common';
import type { AuthTokens, AuthUser, LoginCredentials } from '@/types/auth';

/**
 * identity-service /api/auth/** and /api/users/me — already implemented by the backend, so these
 * handlers are OFF by default. Turn them on with VITE_MOCKS_INCLUDE=auth to work without the
 * backend. Responses and error messages copy AuthController / AuthService.
 *
 * Accounts: admin1, organizer1, instructor1, learner1 (or <name>@learnup.test), password MOCK_PASSWORD.
 */
export const MOCK_PASSWORD = 'Password123!';

const MOCK_USERS: AuthUser[] = USER_ROLES.map((role: UserRole) => {
  const name = role.toLowerCase();
  return {
    id: `mock-${name}`,
    username: `${name}1`,
    email: `${name}1@learnup.test`,
    fullName: `Mock ${role.charAt(0)}${name.slice(1)}`,
    role,
    organizationId: role === 'ADMIN' ? undefined : 'mock-org-1',
    organizationName: role === 'ADMIN' ? undefined : 'Mock Organization',
    enabled: true,
    createdAt: '2026-09-01T00:00:00Z',
  };
});

const tokensFor = (user: AuthUser): AuthTokens => ({
  accessToken: `mock-access.${user.id}`,
  refreshToken: `mock-refresh.${user.id}`,
  tokenType: 'Bearer',
  expiresIn: 3600,
});

const userFromToken = (token: string | undefined, prefix: string) =>
  token?.startsWith(prefix)
    ? MOCK_USERS.find((u) => u.id === token.slice(prefix.length))
    : undefined;

const unauthorized = (message: string) =>
  HttpResponse.json<ApiResponse<never>>(
    createErrorResponse(STANDARD_ERROR_CODES.UNAUTHORIZED, message),
    { status: 401 }
  );

export const authHandlers = [
  http.post('*/api/auth/login', async ({ request }) => {
    const { username = '', password = '' } = ((await request.json()) ??
      {}) as Partial<LoginCredentials>;

    const details = [
      ...(username.trim() ? [] : ['username: Username or email is required']),
      ...(password.trim() ? [] : ['password: Password is required']),
    ];
    if (details.length) {
      return HttpResponse.json<ApiResponse<never>>(
        createErrorResponse(
          STANDARD_ERROR_CODES.VALIDATION_ERROR,
          'Request validation failed',
          details
        ),
        { status: 400 }
      );
    }

    const user = MOCK_USERS.find((u) => u.username === username || u.email === username);
    if (!user || password !== MOCK_PASSWORD) return unauthorized('Invalid username or password');

    return HttpResponse.json<ApiResponse<AuthTokens>>(createSuccessResponse(tokensFor(user)));
  }),

  http.post('*/api/auth/refresh', async ({ request }) => {
    const { refreshToken } = ((await request.json()) ?? {}) as { refreshToken?: string };
    const user = userFromToken(refreshToken, 'mock-refresh.');
    if (!user) return unauthorized('Invalid, expired, or revoked refresh token');
    return HttpResponse.json<ApiResponse<AuthTokens>>(createSuccessResponse(tokensFor(user)));
  }),

  http.get('*/api/users/me', ({ request }) => {
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
    const user = userFromToken(token, 'mock-access.');
    if (!user) return unauthorized('Authentication required');
    return HttpResponse.json<ApiResponse<AuthUser>>(createSuccessResponse(user));
  }),
];
