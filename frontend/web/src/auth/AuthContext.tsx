import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { AuthUser, LoginCredentials } from '../types/auth.js';
import { authStorage } from './authStorage.js';
import { authApi } from './authApi.js';

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  loadCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  const value = {
    currentUser,
    isAuthenticated: Boolean(currentUser),
    isLoading,
    login,
    logout,
    loadCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
