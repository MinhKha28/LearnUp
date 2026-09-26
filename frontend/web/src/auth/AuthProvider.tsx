import React, { useEffect, useState, useCallback, ReactNode } from 'react';
import { AuthUser, LoginCredentials } from '../types/auth.js';
import { authStorage } from './authStorage.js';
import { authApi } from './authApi.js';
import { AuthContext, AuthContextValue } from './useAuth.js';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    authStorage.clearTokens();
    setCurrentUser(null);
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const user = await authApi.getMe();
      setCurrentUser(user);
    } catch {
      logout();
    }
  }, [logout]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const tokens = await authApi.login(credentials);
      authStorage.setTokens(tokens.accessToken, tokens.refreshToken);
      const user = await authApi.getMe();
      setCurrentUser(user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize Auth on application startup
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const token = authStorage.getAccessToken();
      const refreshToken = authStorage.getRefreshToken();

      if (!token && !refreshToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        if (token) {
          const user = await authApi.getMe();
          if (isMounted) setCurrentUser(user);
        } else if (refreshToken) {
          const newTokens = await authApi.refresh(refreshToken);
          authStorage.setTokens(newTokens.accessToken, newTokens.refreshToken);
          const user = await authApi.getMe();
          if (isMounted) setCurrentUser(user);
        }
      } catch {
        if (isMounted) logout();
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeAuth();

    const handleAuthExpired = () => {
      logout();
    };

    window.addEventListener('learnup:auth-expired', handleAuthExpired);
    return () => {
      isMounted = false;
      window.removeEventListener('learnup:auth-expired', handleAuthExpired);
    };
  }, [logout]);

  const value: AuthContextValue = {
    currentUser,
    isAuthenticated: Boolean(currentUser),
    isLoading,
    login,
    logout,
    loadCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
