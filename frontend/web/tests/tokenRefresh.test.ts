import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { apiClient } from '../src/services/apiClient.js';
import { authStorage } from '../src/auth/authStorage.js';

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
    const responseInterceptor = (apiClient.interceptors.response as any).handlers[0];

    const error401 = {
      response: { status: 401 },
      config: { url: '/api/auth/login', headers: {} },
    };

    await expect(responseInterceptor.rejected(error401)).rejects.toEqual(error401);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('should clear tokens and reject if 401 occurs but no refresh token is stored', async () => {
    authStorage.setAccessToken('expired-access-token');
    const responseInterceptor = (apiClient.interceptors.response as any).handlers[0];

    const error401 = {
      response: { status: 401 },
      config: { url: '/api/users/me', headers: {} },
    };

    await expect(responseInterceptor.rejected(error401)).rejects.toEqual(error401);
    expect(authStorage.getAccessToken()).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('should attempt refresh and update storage when refresh token is present', async () => {
    authStorage.setTokens('expired-access', 'valid-refresh');

    (axios.post as any).mockResolvedValueOnce({
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

    // Mock apiClient to resolve retry
    const responseInterceptor = (apiClient.interceptors.response as any).handlers[0];

    const originalRequest = {
      url: '/api/users/me',
      headers: {} as Record<string, string>,
    };

    const error401 = {
      response: { status: 401 },
      config: originalRequest,
    };

    // Spy on axios call
    try {
      await responseInterceptor.rejected(error401);
    } catch {
      // apiClient invocation will fail in unit test without network, but refresh was called
    }

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

    (axios.post as any).mockRejectedValueOnce(new Error('Refresh token invalid'));

    const eventListener = vi.fn();
    window.addEventListener('learnup:auth-expired', eventListener);

    const responseInterceptor = (apiClient.interceptors.response as any).handlers[0];

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
