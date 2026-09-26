import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';
import * as UseAuthModule from '@/auth/useAuth';
import { DEFAULT_AUTHENTICATED_PATH } from '@/config/routes';
import { AuthUser } from '@/types/auth';

const mockCurrentUser = (currentUser: AuthUser | null) => {
  vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
    currentUser,
    isAuthenticated: Boolean(currentUser),
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    loadCurrentUser: vi.fn(),
  });
};

describe('status pages', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('NotFoundPage shows a translated heading and a link home', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '404 — Không tìm thấy trang' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Về trang chủ' }).getAttribute('href')).toBe(
      DEFAULT_AUTHENTICATED_PATH
    );
  });

  it('UnauthorizedPage shows the translated role of the current user in bold', () => {
    mockCurrentUser({
      id: 'usr-1',
      username: 'learner1',
      email: 'learner1@test.com',
      role: 'LEARNER',
      enabled: true,
      createdAt: '2026-09-14T00:00:00Z',
    });

    render(
      <MemoryRouter>
        <UnauthorizedPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '403 — Không có quyền truy cập' })).toBeDefined();
    const role = screen.getByText('Học viên');
    expect(role.tagName).toBe('STRONG');
  });

  it('UnauthorizedPage falls back to the guest label without a user', () => {
    mockCurrentUser(null);

    render(
      <MemoryRouter>
        <UnauthorizedPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Khách').tagName).toBe('STRONG');
  });
});
