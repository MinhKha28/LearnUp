import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS } from '../routerFuture';
import { AxiosError, AxiosHeaders } from 'axios';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import * as UseAuthModule from '@/auth/useAuth';
import { getHomePath } from '@/app/navigation';
import { makeUser, mockAuth } from '../authMock';

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

  fireEvent.change(screen.getByLabelText('Email'), {
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
  fireEvent.change(screen.getByLabelText('Email'), {
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

const axiosError = (status: number, data: unknown) => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    config,
    null,
    {
      status,
      statusText: '',
      headers: {},
      config,
      data,
    }
  );
};

const renderLoginPage = () =>
  render(
    <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>
  );

describe('LoginPage content (UC05)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the heading, the panel highlights, the fields and the pricing link', () => {
    mockAuth(null);
    renderLoginPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Đăng nhập vào LearnUP' })).toBeDefined();

    const panel = screen.getByRole('complementary');
    expect(within(panel).getByText('Cách quản lý học tập bài bản hơn.')).toBeDefined();
    const highlights = within(panel).getByRole('list', { name: 'Không gian đào tạo' });
    const items = within(highlights).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('Khóa học')).toBeDefined();
    expect(within(items[1]).getByText('Phân công')).toBeDefined();
    expect(within(items[2]).getByText('Theo dõi tiến độ và mức độ hoàn thành')).toBeDefined();

    const email = screen.getByLabelText('Email');
    expect(email.getAttribute('type')).toBe('text');
    expect(email.getAttribute('inputmode')).toBe('email');
    expect(email.getAttribute('autocomplete')).toBe('username');
    expect(screen.getByLabelText('Mật khẩu').getAttribute('autocomplete')).toBe('current-password');

    expect(screen.getByRole('link', { name: 'Xem gói dịch vụ' }).getAttribute('href')).toBe(
      '/pricing'
    );
    expect(screen.getByRole('link', { name: 'Về trang chủ' }).getAttribute('href')).toBe(
      '/pricing'
    );
    // Later milestones are shown as in the design: Google sign-in (UC05.1), forgot password (UC07)
    expect(screen.getByRole('button', { name: 'Tiếp tục với Google' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Quên mật khẩu?' })).toBeDefined();
  });

  it.each(['Quên mật khẩu?', 'Tiếp tục với Google'])(
    '"%s" is not built yet: shows the coming-soon notice instead',
    async (name) => {
      const auth = mockAuth(null);
      renderLoginPage();

      await userEvent.click(screen.getByRole('button', { name }));

      expect(
        within(screen.getByRole('status')).getByText('Tính năng đang được phát triển.')
      ).toBeDefined();
      expect(auth.login).not.toHaveBeenCalled();
      expect(window.location.pathname).not.toBe('/forgot-password');
    }
  );

  it('the coming-soon notice gives way to the next sign-in attempt', async () => {
    mockAuth(null, {
      login: vi.fn().mockRejectedValue(
        axiosError(401, {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid username or password' },
        })
      ),
    });
    renderLoginPage();

    await userEvent.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }));
    await userEvent.type(screen.getByLabelText('Email'), 'learner1');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.queryByText('Tính năng đang được phát triển.')).toBeNull();
  });
});

describe('LoginPage validation and errors', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows a required error under each empty field and does not call login', async () => {
    const auth = mockAuth(null);
    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Mật khẩu'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findAllByText('Vui lòng nhập thông tin này.')).toHaveLength(2);
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Mật khẩu').getAttribute('aria-invalid')).toBe('true');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('accepts a username, trims it and sends the password as typed', async () => {
    const auth = mockAuth(null, { login: vi.fn().mockResolvedValue(makeUser('LEARNER')) });
    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email'), '  learner1 ');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), ' secret ');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(auth.login).toHaveBeenCalledWith({ username: 'learner1', password: ' secret ' });
  });

  it('401: shows the titled alert and marks both fields invalid until either is edited', async () => {
    mockAuth(null, {
      login: vi.fn().mockRejectedValue(
        axiosError(401, {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid username or password' },
        })
      ),
    });
    renderLoginPage();

    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Mật khẩu');
    await userEvent.type(email, 'alex.morgan@acme.example');
    await userEvent.type(password, 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Đăng nhập không thành công')).toBeDefined();
    expect(within(alert).getByText('Invalid username or password')).toBeDefined();
    for (const field of [email, password]) {
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(field.getAttribute('aria-describedby')).toContain(alert.id);
    }

    await userEvent.type(password, 'x');

    expect(email.getAttribute('aria-invalid')).toBeNull();
    expect(password.getAttribute('aria-invalid')).toBeNull();
  });

  it('VALIDATION_ERROR: puts the server message under its field without a credentials error', async () => {
    mockAuth(null, {
      login: vi.fn().mockRejectedValue(
        axiosError(400, {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: ['username: Username or email is required'],
          },
        })
      ),
    });
    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email'), 'learner1');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Username or email is required')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Mật khẩu').getAttribute('aria-invalid')).toBeNull();
  });
});
