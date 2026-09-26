import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { LoginPage } from '@/pages/LoginPage';
import * as UseAuthModule from '@/auth/useAuth';
import { DEFAULT_AUTHENTICATED_PATH } from '@/config/routes';

const mockLoginRejection = (error: unknown) => {
  vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
    currentUser: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn().mockRejectedValue(error),
    logout: vi.fn(),
    loadCurrentUser: vi.fn(),
  });
};

const submitLoginForm = () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>
  );

  fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'learner1' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong-password' } });
  fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);
};

describe('LoginPage error handling', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should display the server error message when login fails with 401', async () => {
    const config = { headers: new AxiosHeaders() };
    mockLoginRejection(
      new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, null, {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
        data: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid username or password' },
        },
      })
    );

    submitLoginForm();

    expect(await screen.findByText('Invalid username or password')).toBeDefined();
    expect(screen.queryByText(/request failed with status code/i)).toBeNull();
  });

  it('should display the Vietnamese fallback message when the error has no server message', async () => {
    mockLoginRejection(new AxiosError('Network Error', 'ERR_NETWORK'));

    submitLoginForm();

    expect(await screen.findByText('Đăng nhập thất bại. Vui lòng thử lại.')).toBeDefined();
    expect(screen.queryByText('Network Error')).toBeNull();
  });
});

const LocationProbe: React.FC = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  return <div>{`At ${location.pathname} via ${navigationType}`}</div>;
};

const renderLoginRoutes = (state?: { from: { pathname: string } }) => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
};

const mockAuth = (isAuthenticated: boolean) => {
  vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
    currentUser: null,
    isAuthenticated,
    isLoading: false,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    loadCurrentUser: vi.fn(),
  });
};

const submitCredentials = () => {
  fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'learner1' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);
};

describe('LoginPage redirect', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should redirect to location.state.from after successful submit', async () => {
    mockAuth(false);
    renderLoginRoutes({ from: { pathname: '/courses/42' } });

    submitCredentials();

    expect(await screen.findByText('At /courses/42 via REPLACE')).toBeDefined();
  });

  it('should redirect to DEFAULT_AUTHENTICATED_PATH after successful submit without from', async () => {
    mockAuth(false);
    renderLoginRoutes();

    submitCredentials();

    expect(await screen.findByText(`At ${DEFAULT_AUTHENTICATED_PATH} via REPLACE`)).toBeDefined();
  });

  it('should redirect an already authenticated user to location.state.from', async () => {
    mockAuth(true);
    renderLoginRoutes({ from: { pathname: '/courses/42' } });

    expect(await screen.findByText('At /courses/42 via REPLACE')).toBeDefined();
  });

  it('should redirect an already authenticated user to DEFAULT_AUTHENTICATED_PATH without from', async () => {
    mockAuth(true);
    renderLoginRoutes();

    expect(await screen.findByText(`At ${DEFAULT_AUTHENTICATED_PATH} via REPLACE`)).toBeDefined();
  });
});
