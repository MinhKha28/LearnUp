import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from '../src/services/apiClient.js';
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
    const interceptor = (apiClient.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: any) => any }>;
    }).handlers[0];

    const config = {
      headers: {},
    };

    const updatedConfig = await interceptor.fulfilled(config);
    expect(updatedConfig.headers.Authorization).toBe('Bearer mocked-access-jwt-token');
  });

  it('should NOT attach Authorization header when access token is absent', async () => {
    const interceptor = (apiClient.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: any) => any }>;
    }).handlers[0];

    const config = {
      headers: {},
    };

    const updatedConfig = await interceptor.fulfilled(config);
    expect(updatedConfig.headers.Authorization).toBeUndefined();
  });

  it('should NEVER construct or attach trusted identity headers (X-User-ID, X-Organization-ID, X-User-Role)', async () => {
    authStorage.setAccessToken('mocked-jwt');

    const interceptor = (apiClient.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: any) => any }>;
    }).handlers[0];

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
