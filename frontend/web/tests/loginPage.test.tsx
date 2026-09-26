import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { LoginPage } from '../src/pages/LoginPage.js';
import * as AuthContextModule from '../src/auth/AuthContext.js';

const mockLoginRejection = (error: unknown) => {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    currentUser: null,
    accessToken: null,
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
