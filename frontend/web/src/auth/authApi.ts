import { ApiResponse } from '@learnup/ts-common';
import { apiClient, unwrap } from '../services/apiClient.js';
import { AuthTokens, AuthUser, LoginCredentials } from '../types/auth.js';

export const authApi = {
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const response = await apiClient.post<ApiResponse<AuthTokens>>(
      '/api/auth/login',
      credentials
    );
    return unwrap(response, 'Login failed');
  },

  async register(data: {
    username: string;
    email: string;
    password: string;
    fullName?: string;
  }): Promise<AuthTokens> {
    const response = await apiClient.post<ApiResponse<AuthTokens>>(
      '/api/auth/register',
      data
    );
    return unwrap(response, 'Registration failed');
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const response = await apiClient.post<ApiResponse<AuthTokens>>(
      '/api/auth/refresh',
      { refreshToken }
    );
    return unwrap(response, 'Token refresh failed');
  },

  async getMe(): Promise<AuthUser> {
    const response = await apiClient.get<ApiResponse<AuthUser>>('/api/users/me');
    return unwrap(response, 'Failed to fetch user profile');
  },
};
