import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS } from './routerFuture';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import * as UseAuthModule from '@/auth/useAuth';
import { DEFAULT_AUTHENTICATED_PATH } from '@/config/routes';

describe('PlaceholderPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should call logout and navigate to /login when clicking Đăng xuất', () => {
    const logout = vi.fn();
    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      currentUser: null,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout,
      loadCurrentUser: vi.fn(),
    });

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={[DEFAULT_AUTHENTICATED_PATH]}>
        <Routes>
          <Route path={DEFAULT_AUTHENTICATED_PATH} element={<PlaceholderPage />} />
          <Route path="/login" element={<div>Login Page Mock</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Trang đang được xây dựng' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Login Page Mock')).toBeDefined();
  });
});
