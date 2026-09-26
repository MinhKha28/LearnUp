import React from 'react';
import { useTranslation } from 'react-i18next';
import { SearchX } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { useHomePath } from '@/app/useHomePath';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState';
import styles from './StatusPage.module.css';

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const homePath = useHomePath();

  return (
    <main className={styles.page}>
      <EmptyState
        headingLevel={1}
        icon={<SearchX />}
        title={t('notFound.title')}
        description={t('notFound.description')}
        action={
          <ButtonLink to={homePath}>
            {t(currentUser ? 'actions.backToHome' : 'actions.goToLogin')}
          </ButtonLink>
        }
      />
    </main>
  );
};
