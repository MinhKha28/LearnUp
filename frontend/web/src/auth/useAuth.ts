import { createContext, useContext } from 'react';
import { AuthUser, LoginCredentials } from '@/types/auth';

export interface AuthContextValue {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Resolves with the signed-in user so the caller can route by role. */
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  logout: () => void;
  loadCurrentUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
