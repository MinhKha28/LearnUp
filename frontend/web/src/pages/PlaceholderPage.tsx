import React from 'react';
import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';
import type { NavLabelKey } from '@/app/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import styles from './PlaceholderPage.module.css';

export interface PlaceholderPageProps {
  /** Page title, as the key of its menu entry in the "nav" namespace. */
  titleKey: NavLabelKey;
}

/** Stand-in for a page that is routed and in the menu but not built yet. */
export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ titleKey }) => {
  const { t } = useTranslation();
  const { t: tNav } = useTranslation('nav');

  return (
    <>
      <h1 className={styles.title}>{tNav(titleKey)}</h1>
      <EmptyState
        icon={<Construction />}
        title={t('placeholder.title')}
        description={t('placeholder.description')}
      />
    </>
  );
};
