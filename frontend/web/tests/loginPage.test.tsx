import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS } from './routerFuture';
import { AxiosError, AxiosHeaders } from 'axios';
import { LoginPage } from '@/pages/LoginPage';
import * as UseAuthModule from '@/auth/useAuth';
import { getHomePath } from '@/app/navigation';
import { makeUser, mockAuth } from './authMock';

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
    <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>
  );

  fireEvent.change(screen.getByLabelText('Tên đăng nhập hoặc email'), {
    target: { value: 'learner1' },
  });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'wrong-password' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Đăng nhập' }).closest('form')!);
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
    <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
};

const learner = makeUser('LEARNER');

/** Signed out, with login resolving to a learner; or already signed in as that learner. */
const mockLoginAuth = (signedIn: boolean) =>
  mockAuth(signedIn ? learner : null, { login: vi.fn().mockResolvedValue(learner) });

const submitCredentials = () => {
  fireEvent.change(screen.getByLabelText('Tên đăng nhập hoặc email'), {
    target: { value: 'learner1' },
  });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Đăng nhập' }).closest('form')!);
};

describe('LoginPage redirect', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should redirect to location.state.from after successful submit', async () => {
    mockLoginAuth(false);
    renderLoginRoutes({ from: { pathname: '/learner/catalog' } });

    submitCredentials();

    expect(await screen.findByText('At /learner/catalog via REPLACE')).toBeDefined();
  });

  it('should redirect to the role home (getHomePath) after successful submit without from', async () => {
    mockLoginAuth(false);
    renderLoginRoutes();

    submitCredentials();

    expect(await screen.findByText(`At ${getHomePath('LEARNER')} via REPLACE`)).toBeDefined();
  });

  it("should ignore a from path in another role's area and go to the role home", async () => {
    mockLoginAuth(false);
    renderLoginRoutes({ from: { pathname: '/admin/plans' } });

    submitCredentials();

    expect(await screen.findByText('At /learner/courses via REPLACE')).toBeDefined();
  });

  it('should redirect an already authenticated user to location.state.from', async () => {
    mockLoginAuth(true);
    renderLoginRoutes({ from: { pathname: '/account/profile' } });

    expect(await screen.findByText('At /account/profile via REPLACE')).toBeDefined();
  });

  it('should redirect an already authenticated user to the role home without from', async () => {
    mockLoginAuth(true);
    renderLoginRoutes();

    expect(await screen.findByText('At /learner/courses via REPLACE')).toBeDefined();
  });
});
