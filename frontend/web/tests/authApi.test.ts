import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authApi } from '@/auth/authApi';
import { apiClient } from '@/services/apiClient';
import { AuthTokens, AuthUser } from '@/types/auth';

vi.mock('@/services/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/apiClient')>()),
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('authApi Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call /api/auth/login and return tokens on success', async () => {
    const mockTokens: AuthTokens = {
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      tokenType: 'Bearer',
      expiresIn: 3600,
    };

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: mockTokens,
        timestamp: '2026-09-14T12:00:00Z',
      },
    });

    const result = await authApi.login({ username: 'learner1', password: 'password123' });
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', {
      username: 'learner1',
      password: 'password123',
    });
    expect(result).toEqual(mockTokens);
  });

  it('should throw error when login response success is false', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
      },
    });

    await expect(
      authApi.login({ username: 'learner1', password: 'wrongpassword' })
    ).rejects.toThrow('Invalid credentials');
  });

  it('should call /api/users/me and return user profile', async () => {
    const mockUser: AuthUser = {
      id: 'usr-111',
      username: 'learner1',
      email: 'learner1@example.com',
      fullName: 'Learner One',
      role: 'LEARNER',
      organizationId: 'org-111',
      enabled: true,
      createdAt: '2026-09-14T12:00:00Z',
    };

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: mockUser,
        timestamp: '2026-09-14T12:00:00Z',
      },
    });

    const result = await authApi.getMe();
    expect(apiClient.get).toHaveBeenCalledWith('/api/users/me');
    expect(result).toEqual(mockUser);
  });

  it('should call /api/auth/refresh and return refreshed tokens', async () => {
    const mockTokens: AuthTokens = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
    };

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: mockTokens,
        timestamp: '2026-09-14T12:00:00Z',
      },
    });

    const result = await authApi.refresh('existing-refresh-token');
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/refresh', {
      refreshToken: 'existing-refresh-token',
    });
    expect(result).toEqual(mockTokens);
  });
});
