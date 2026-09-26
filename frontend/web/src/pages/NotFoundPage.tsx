import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_AUTHENTICATED_PATH } from '@/config/routes';

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <main>
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.description')}</p>
      <Link to={DEFAULT_AUTHENTICATED_PATH}>{t('actions.backToHome')}</Link>
    </main>
  );
};
