import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserRole } from '@learnup/ts-common';
import { useAuth } from './useAuth';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { LOGIN_PATH, UNAUTHORIZED_PATH } from '@/config/routes';

interface RoleRouteProps {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles, children }) => {
  const { currentUser, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (isLoading) {
    return <LoadingScreen message={t('loading.verifyingAccess')} />;
  }

  if (!isAuthenticated) {
    return <Navigate to={LOGIN_PATH} state={{ from: location }} replace />;
  }

  if (!currentUser || !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={UNAUTHORIZED_PATH} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
