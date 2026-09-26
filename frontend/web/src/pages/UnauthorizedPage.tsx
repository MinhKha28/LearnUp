import React from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { UserRole } from '@learnup/ts-common';
import { useAuth } from '@/auth/useAuth';
import { DEFAULT_AUTHENTICATED_PATH } from '@/config/routes';

const ROLE_KEYS = {
  ADMIN: 'roles.admin',
  ORGANIZER: 'roles.organizer',
  INSTRUCTOR: 'roles.instructor',
  LEARNER: 'roles.learner',
} as const satisfies Record<UserRole, string>;

export const UnauthorizedPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { t } = useTranslation();

  const role = t(currentUser ? ROLE_KEYS[currentUser.role] : 'roles.guest');

  return (
    <main>
      <h1>{t('forbidden.title')}</h1>
      <p>
        <Trans
          i18nKey="forbidden.description"
          values={{ role }}
          components={{ strong: <strong /> }}
        />
      </p>
      <Link to={DEFAULT_AUTHENTICATED_PATH}>{t('actions.backToHome')}</Link>
    </main>
  );
};
