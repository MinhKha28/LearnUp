import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/useAuth';

export const PlaceholderPage: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <main>
      <h1>{t('placeholder.title')}</h1>
      <button type="button" onClick={handleLogout}>
        {t('actions.signOut')}
      </button>
    </main>
  );
};
