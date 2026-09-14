import { ApiResponse } from '@learnup/ts-common';
import { apiClient } from '../services/apiClient.js';
import { AuthTokens, AuthUser, LoginCredentials } from '../types/auth.js';

export const authApi = {
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const response = await apiClient.post<ApiResponse<AuthTokens>>(
      '/api/auth/login',
      credentials
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Login failed');
    }
    return response.data.data;
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
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Registration failed');
    }
    return response.data.data;
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const response = await apiClient.post<ApiResponse<AuthTokens>>(
      '/api/auth/refresh',
      { refreshToken }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Token refresh failed');
    }
    return response.data.data;
  },

  async getMe(): Promise<AuthUser> {
    const response = await apiClient.get<ApiResponse<AuthUser>>('/api/users/me');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to fetch user profile');
    }
    return response.data.data;
  },
};
