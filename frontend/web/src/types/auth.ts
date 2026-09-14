import { UserRole } from '@learnup/ts-common';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  role: UserRole;
  organizationId?: string;
  enabled: boolean;
  createdAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}
