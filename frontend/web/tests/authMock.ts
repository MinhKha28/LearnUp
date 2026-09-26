import { vi } from 'vitest';
import type { UserRole } from '@learnup/ts-common';
import * as UseAuthModule from '@/auth/useAuth';
import type { AuthContextValue } from '@/auth/useAuth';
import type { AuthUser } from '@/types/auth';

export const makeUser = (role: UserRole, overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: `usr-${role.toLowerCase()}`,
  username: `${role.toLowerCase()}1`,
  email: `${role.toLowerCase()}1@test.com`,
  fullName: 'Nguyễn Văn An',
  role,
  organizationId: role === 'ADMIN' ? undefined : 'org-1',
  enabled: true,
  createdAt: '2026-09-14T00:00:00Z',
  ...overrides,
});

/** Replaces useAuth with a fixed value; returns the mocked context so tests can inspect calls. */
export const mockAuth = (
  currentUser: AuthUser | null,
  overrides: Partial<AuthContextValue> = {}
): AuthContextValue => {
  const value: AuthContextValue = {
    currentUser,
    isAuthenticated: Boolean(currentUser),
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    loadCurrentUser: vi.fn(),
    ...overrides,
  };
  vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue(value);
  return value;
};
