import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { ROLE_LABEL_KEYS } from '@/auth/roleLabels';
import { useHomePath } from '@/app/useHomePath';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState';
import styles from './StatusPage.module.css';

export const UnauthorizedPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const homePath = useHomePath();

  const role = t(currentUser ? ROLE_LABEL_KEYS[currentUser.role] : 'roles.guest');

  return (
    <main className={styles.page}>
      <EmptyState
        headingLevel={1}
        icon={<ShieldAlert />}
        title={t('forbidden.title')}
        description={
          <Trans
            i18nKey="forbidden.description"
            values={{ role }}
            components={{ strong: <strong /> }}
          />
        }
        action={
          <ButtonLink to={homePath}>
            {t(currentUser ? 'actions.backToHome' : 'actions.goToLogin')}
          </ButtonLink>
        }
      />
    </main>
  );
};
