import { describe, it, expect, beforeEach } from 'vitest';
import { authStorage } from '../src/auth/authStorage.js';

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should store and retrieve access token', () => {
    expect(authStorage.getAccessToken()).toBeNull();
    authStorage.setAccessToken('sample-access-token');
    expect(authStorage.getAccessToken()).toBe('sample-access-token');
  });

  it('should store and retrieve refresh token', () => {
    expect(authStorage.getRefreshToken()).toBeNull();
    authStorage.setRefreshToken('sample-refresh-token');
    expect(authStorage.getRefreshToken()).toBe('sample-refresh-token');
  });

  it('should store both tokens simultaneously with setTokens', () => {
    authStorage.setTokens('access-123', 'refresh-456');
    expect(authStorage.getAccessToken()).toBe('access-123');
    expect(authStorage.getRefreshToken()).toBe('refresh-456');
  });

  it('should clear both tokens with clearTokens', () => {
    authStorage.setTokens('access-123', 'refresh-456');
    authStorage.clearTokens();
    expect(authStorage.getAccessToken()).toBeNull();
    expect(authStorage.getRefreshToken()).toBeNull();
  });
});
