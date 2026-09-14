import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../src/auth/ProtectedRoute.js';
import { RoleRoute } from '../src/auth/RoleRoute.js';
import * as AuthContextModule from '../src/auth/AuthContext.js';

describe('Route Protection and Role Guards', () => {
  it('should show loading indicator when authentication state is loading', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      currentUser: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
      loadCurrentUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Secret Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/authenticating session/i)).toBeDefined();
    expect(screen.queryByText('Secret Content')).toBeNull();
  });

  it('should redirect unauthenticated user to /login from ProtectedRoute', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      currentUser: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      loadCurrentUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Secret Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page Mock</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page Mock')).toBeDefined();
    expect(screen.queryByText('Secret Content')).toBeNull();
  });

  it('should render protected content when user is authenticated', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      currentUser: {
        id: 'usr-1',
        username: 'learner1',
        email: 'learner1@test.com',
        role: 'LEARNER',
        organizationId: 'org-1',
        enabled: true,
        createdAt: '2026-09-14T00:00:00Z',
      },
      accessToken: 'valid-jwt',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      loadCurrentUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Dashboard Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard Content')).toBeDefined();
  });

  it('should allow authorized role in RoleRoute', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      currentUser: {
        id: 'usr-admin',
        username: 'admin1',
        email: 'admin@test.com',
        role: 'ADMIN',
        enabled: true,
        createdAt: '2026-09-14T00:00:00Z',
      },
      accessToken: 'valid-jwt',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      loadCurrentUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin-portal']}>
        <Routes>
          <Route
            path="/admin-portal"
            element={
              <RoleRoute allowedRoles={['ADMIN']}>
                <div>Admin Portal View</div>
              </RoleRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Portal View')).toBeDefined();
  });

  it('should redirect unauthorized role to /unauthorized in RoleRoute', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      currentUser: {
        id: 'usr-learner',
        username: 'learner1',
        email: 'learner1@test.com',
        role: 'LEARNER',
        enabled: true,
        createdAt: '2026-09-14T00:00:00Z',
      },
      accessToken: 'valid-jwt',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      loadCurrentUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin-portal']}>
        <Routes>
          <Route
            path="/admin-portal"
            element={
              <RoleRoute allowedRoles={['ADMIN', 'ORGANIZER']}>
                <div>Admin Portal View</div>
              </RoleRoute>
            }
          />
          <Route path="/unauthorized" element={<div>Access Restricted 403</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Access Restricted 403')).toBeDefined();
    expect(screen.queryByText('Admin Portal View')).toBeNull();
  });
});
