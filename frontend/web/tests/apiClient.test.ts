import { describe, it, expect, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { apiClient, getApiErrorMessage, unwrap } from '../src/services/apiClient.js';
import { authStorage } from '../src/auth/authStorage.js';
import { API_BASE_URL } from '../src/config/env.js';

describe('apiClient Configuration & Interceptors', () => {
  beforeEach(() => {
    authStorage.clearTokens();
  });

  it('should use Gateway base URL', () => {
    expect(apiClient.defaults.baseURL).toBe(API_BASE_URL);
    expect(API_BASE_URL).toMatch(/localhost:8080/);
  });

  it('should attach Bearer token when access token exists', async () => {
    authStorage.setAccessToken('mocked-access-jwt-token');

    // Simulate request interceptor execution
    const interceptor = (
      apiClient.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (config: any) => any }>;
      }
    ).handlers[0];

    const config = {
      headers: {},
    };

    const updatedConfig = await interceptor.fulfilled(config);
    expect(updatedConfig.headers.Authorization).toBe('Bearer mocked-access-jwt-token');
  });

  it('should NOT attach Authorization header when access token is absent', async () => {
    const interceptor = (
      apiClient.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (config: any) => any }>;
      }
    ).handlers[0];

    const config = {
      headers: {},
    };

    const updatedConfig = await interceptor.fulfilled(config);
    expect(updatedConfig.headers.Authorization).toBeUndefined();
  });

  it('should NEVER construct or attach trusted identity headers (X-User-ID, X-Organization-ID, X-User-Role)', async () => {
    authStorage.setAccessToken('mocked-jwt');

    const interceptor = (
      apiClient.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (config: any) => any }>;
      }
    ).handlers[0];

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
});

describe('unwrap', () => {
  it('should return data when the ApiResponse is successful', () => {
    const response = { data: { success: true, data: { id: 'usr-1' } } } as any;
    expect(unwrap(response)).toEqual({ id: 'usr-1' });
  });

  it('should throw with the ApiResponse error.message when success is false', () => {
    const response = {
      data: { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
    } as any;
    expect(() => unwrap(response, 'Login failed')).toThrow('Invalid credentials');
  });

  it('should throw with the fallback message when there is no error message', () => {
    const response = { data: { success: true } } as any;
    expect(() => unwrap(response, 'Login failed')).toThrow('Login failed');
  });

  it('should throw an error whose message getApiErrorMessage can read', () => {
    const response = {
      data: { success: false, error: { code: 'CONFLICT', message: 'Username already exists' } },
    } as any;

    let thrown: unknown;
    try {
      unwrap(response);
    } catch (err) {
      thrown = err;
    }

    expect(getApiErrorMessage(thrown, 'fallback')).toBe('Username already exists');
  });
});
