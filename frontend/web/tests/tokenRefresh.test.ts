import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../src/services/apiClient.js';
import { authStorage } from '../src/auth/authStorage.js';

type ResponseInterceptorHandlers = {
  handlers: Array<{ rejected: (error: unknown) => Promise<AxiosResponse> }>;
};

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: {
      ...actual.default,
      create: actual.default.create,
      post: vi.fn(),
    },
  };
});

describe('Token Refresh Interceptor Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStorage.clearTokens();
  });

  it('should not attempt refresh if request URL is an auth endpoint', async () => {
    const responseInterceptor = (
      apiClient.interceptors.response as unknown as ResponseInterceptorHandlers
    ).handlers[0];

    const error401 = {
      response: { status: 401 },
      config: { url: '/api/auth/login', headers: {} },
    };

    await expect(responseInterceptor.rejected(error401)).rejects.toEqual(error401);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('should clear tokens and reject if 401 occurs but no refresh token is stored', async () => {
    authStorage.setAccessToken('expired-access-token');
    const responseInterceptor = (
      apiClient.interceptors.response as unknown as ResponseInterceptorHandlers
    ).handlers[0];

    const error401 = {
      response: { status: 401 },
      config: { url: '/api/users/me', headers: {} },
    };

    await expect(responseInterceptor.rejected(error401)).rejects.toEqual(error401);
    expect(authStorage.getAccessToken()).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('should dispatch auth-expired if 401 occurs but no refresh token is stored', async () => {
    authStorage.setAccessToken('expired-access-token');

    const eventListener = vi.fn();
    window.addEventListener('learnup:auth-expired', eventListener);

    const responseInterceptor = (
      apiClient.interceptors.response as unknown as ResponseInterceptorHandlers
    ).handlers[0];

    const error401 = {
      response: { status: 401 },
      config: { url: '/api/users/me', headers: {} },
    };

    await expect(responseInterceptor.rejected(error401)).rejects.toEqual(error401);
    expect(eventListener).toHaveBeenCalledTimes(1);

    window.removeEventListener('learnup:auth-expired', eventListener);
  });

  it('should attempt refresh and update storage when refresh token is present', async () => {
    authStorage.setTokens('expired-access', 'valid-refresh');

    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          accessToken: 'fresh-access-token',
          refreshToken: 'fresh-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
        },
      },
    });

    // Mock the transport of the retried request so the test never hits the network
    const retryAdapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data: { success: true, data: 'retried' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));

    const responseInterceptor = (
      apiClient.interceptors.response as unknown as ResponseInterceptorHandlers
    ).handlers[0];

    const originalRequest = {
      url: '/api/users/me',
      headers: {} as Record<string, string>,
      adapter: retryAdapter,
    };

    const error401 = {
      response: { status: 401 },
      config: originalRequest,
    };

    const retried = await responseInterceptor.rejected(error401);

    expect(retryAdapter).toHaveBeenCalledTimes(1);
    expect(retryAdapter.mock.calls[0][0].headers.Authorization).toBe('Bearer fresh-access-token');
    expect(retried.data).toEqual({ success: true, data: 'retried' });
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/refresh'),
      { refreshToken: 'valid-refresh' },
      expect.anything()
    );
    expect(authStorage.getAccessToken()).toBe('fresh-access-token');
    expect(authStorage.getRefreshToken()).toBe('fresh-refresh-token');
  });

  it('should clear tokens and dispatch auth-expired when refresh fails', async () => {
    authStorage.setTokens('expired-access', 'invalid-refresh');

    vi.mocked(axios.post).mockRejectedValueOnce(new Error('Refresh token invalid'));

    const eventListener = vi.fn();
    window.addEventListener('learnup:auth-expired', eventListener);

    const responseInterceptor = (
      apiClient.interceptors.response as unknown as ResponseInterceptorHandlers
    ).handlers[0];

    const error401 = {
      response: { status: 401 },
      config: { url: '/api/users/me', headers: {} },
    };

    await expect(responseInterceptor.rejected(error401)).rejects.toThrow('Refresh token invalid');
    expect(authStorage.getAccessToken()).toBeNull();
    expect(authStorage.getRefreshToken()).toBeNull();
    expect(eventListener).toHaveBeenCalled();

    window.removeEventListener('learnup:auth-expired', eventListener);
  });
});
