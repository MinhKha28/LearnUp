import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { ApiResponse } from '@learnup/ts-common';
import { apiClient, getApiErrorMessage, unwrap } from '@/services/apiClient';
import { authStorage } from '@/auth/authStorage';
import { API_BASE_URL } from '@/config/env';
import { i18n } from '@/i18n';

type TestRequestConfig = { headers: Record<string, unknown> };
type RequestInterceptorHandlers = {
  handlers: Array<{
    fulfilled: (config: TestRequestConfig) => TestRequestConfig | Promise<TestRequestConfig>;
  }>;
};

const asApiResponse = <T>(data: unknown) => ({ data }) as AxiosResponse<ApiResponse<T>>;

describe('API base URL configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should use VITE_API_BASE_URL when it is set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://gateway.example.test');
    vi.resetModules();
    const env = await import('@/config/env');
    expect(env.API_BASE_URL).toBe('https://gateway.example.test');
  });

  it('should fall back to DEFAULT_API_BASE_URL when VITE_API_BASE_URL is empty', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.resetModules();
    const env = await import('@/config/env');
    expect(env.API_BASE_URL).toBe(env.DEFAULT_API_BASE_URL);
  });
});

describe('apiClient Configuration & Interceptors', () => {
  beforeEach(() => {
    authStorage.clearTokens();
  });

  it('should use Gateway base URL', () => {
    expect(apiClient.defaults.baseURL).toBe(API_BASE_URL);
  });

  it('should attach Bearer token when access token exists', async () => {
    authStorage.setAccessToken('mocked-access-jwt-token');

    // Simulate request interceptor execution
    const interceptor = (apiClient.interceptors.request as unknown as RequestInterceptorHandlers)
      .handlers[0];

    const config = {
      headers: {},
    };

    const updatedConfig = await interceptor.fulfilled(config);
    expect(updatedConfig.headers.Authorization).toBe('Bearer mocked-access-jwt-token');
  });

  it('should NOT attach Authorization header when access token is absent', async () => {
    const interceptor = (apiClient.interceptors.request as unknown as RequestInterceptorHandlers)
      .handlers[0];

    const config = {
      headers: {},
    };

    const updatedConfig = await interceptor.fulfilled(config);
    expect(updatedConfig.headers.Authorization).toBeUndefined();
  });

  it('should NEVER construct or attach trusted identity headers (X-User-ID, X-Organization-ID, X-User-Role)', async () => {
    authStorage.setAccessToken('mocked-jwt');

    const interceptor = (apiClient.interceptors.request as unknown as RequestInterceptorHandlers)
      .handlers[0];

    const config = {
      headers: {},
    };

    const updatedConfig = await interceptor.fulfilled(config);
    expect(updatedConfig.headers['X-User-ID']).toBeUndefined();
    expect(updatedConfig.headers['X-Organization-ID']).toBeUndefined();
    expect(updatedConfig.headers['X-User-Role']).toBeUndefined();
    expect(updatedConfig.headers['X-Tenant-ID']).toBeUndefined();
  });
});

describe('getApiErrorMessage', () => {
  const buildAxiosError = (data: unknown) => {
    const config = { headers: new AxiosHeaders() };
    return new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, null, {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
      data,
    });
  };

  it('should return error.message from the ApiResponse body', () => {
    const err = buildAxiosError({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid username or password' },
    });
    expect(getApiErrorMessage(err, 'fallback')).toBe('Invalid username or password');
  });

  it('should return fallback when the response body has no error message', () => {
    expect(getApiErrorMessage(buildAxiosError(''), 'fallback')).toBe('fallback');
  });

  it('should return fallback when there is no response (network error)', () => {
    expect(getApiErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'), 'fallback')).toBe(
      'fallback'
    );
  });

  it('should return fallback for non-Axios errors', () => {
    expect(getApiErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
    expect(getApiErrorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('should prefer the errors:<code> translation over the server message', () => {
    const err = buildAxiosError({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'NullPointerException at UserService.java:42' },
    });
    expect(getApiErrorMessage(err, 'fallback')).toBe(
      'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.'
    );
  });

  it('should translate the error code in the current language', async () => {
    await i18n.changeLanguage('en');
    const err = buildAxiosError({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Connection refused' },
    });
    expect(getApiErrorMessage(err)).toBe(
      'The service is temporarily unavailable. Please try again later.'
    );
  });

  it('should use the server message when the code has no translation', () => {
    const err = buildAxiosError({
      success: false,
      error: { code: 'SOME_NEW_CODE', message: 'Specific server message' },
    });
    expect(getApiErrorMessage(err, 'fallback')).toBe('Specific server message');
  });

  it('should not treat non error-code keys (e.g. "generic") as a code', () => {
    const err = buildAxiosError({
      success: false,
      error: { code: 'generic', message: 'Server message' },
    });
    expect(getApiErrorMessage(err, 'fallback')).toBe('Server message');
  });

  it('should use errors:generic when there is no code, message or fallback', () => {
    expect(getApiErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(
      'Đã có lỗi xảy ra. Vui lòng thử lại.'
    );
    expect(getApiErrorMessage(new Error('boom'))).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.');
  });

  it('should translate the code of an error thrown by unwrap', () => {
    let thrown: unknown;
    try {
      unwrap(asApiResponse({ success: false, error: { code: 'INTERNAL_ERROR', message: 'boom' } }));
    } catch (err) {
      thrown = err;
    }
    expect(getApiErrorMessage(thrown)).toBe('Hệ thống đang gặp sự cố. Vui lòng thử lại sau.');
  });
});

describe('unwrap', () => {
  it('should return data when the ApiResponse is successful', () => {
    const response = asApiResponse<{ id: string }>({ success: true, data: { id: 'usr-1' } });
    expect(unwrap(response)).toEqual({ id: 'usr-1' });
  });

  it('should throw with the ApiResponse error.message when success is false', () => {
    const response = asApiResponse({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
    });
    expect(() => unwrap(response, 'Login failed')).toThrow('Invalid credentials');
  });

  it('should throw with the fallback message when there is no error message', () => {
    const response = asApiResponse({ success: true });
    expect(() => unwrap(response, 'Login failed')).toThrow('Login failed');
  });

  it('should throw an error whose message getApiErrorMessage can read', () => {
    const response = asApiResponse({
      success: false,
      error: { code: 'CONFLICT', message: 'Username already exists' },
    });

    let thrown: unknown;
    try {
      unwrap(response);
    } catch (err) {
      thrown = err;
    }

    expect(getApiErrorMessage(thrown, 'fallback')).toBe('Username already exists');
  });
});
