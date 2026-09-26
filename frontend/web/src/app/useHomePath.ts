import { useAuth } from '@/auth/useAuth';
import { LOGIN_PATH } from '@/config/routes';
import { getHomePath } from './navigation';

/** The signed-in user's home page, or the sign-in page for a guest. */
export const useHomePath = (): string => {
  const { currentUser } = useAuth();
  return currentUser ? getHomePath(currentUser.role) : LOGIN_PATH;
};
