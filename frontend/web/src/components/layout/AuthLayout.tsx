import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { PRICING_PATH } from '@/config/routes';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';
import { MAIN_CONTENT_ID, SkipLink } from './SkipLink';
import styles from './AuthLayout.module.css';

export interface AuthLayoutProps {
  /** Big line in the dark panel; defaults to the generic LearnUP pitch. */
  heroTitle?: string;
  heroDescription?: string;
  /** Anything else for the dark panel (steps, highlights…), below the hero. */
  panelContent?: React.ReactNode;
  /** Target of the "back" link above the form. */
  backTo?: string;
  backLabel?: string;
  /** Form content; defaults to the matched child route. */
  children?: React.ReactNode;
}

/**
 * Sign in / auth pages: dark inverse panel on the left (hidden below 768px) and a centred form
 * column on the right, --layout-auth-form-width wide.
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({
  heroTitle,
  heroDescription,
  panelContent,
  backTo = PRICING_PATH,
  backLabel,
  children,
}) => {
  const { t } = useTranslation(['common', 'auth']);

  return (
    <div className={styles.page}>
      <SkipLink />

      <aside className={styles.panel}>
        <Logo variant="inverse" />
        <div className={styles.hero}>
          <p className={styles.heroTitle}>{heroTitle ?? t('auth:layout.heroTitle')}</p>
          <p className={styles.heroDescription}>
            {heroDescription ?? t('auth:layout.heroDescription')}
          </p>
        </div>
        {panelContent && <div className={styles.panelContent}>{panelContent}</div>}
      </aside>

      <div className={styles.formColumn}>
        <div className={styles.topBar}>
          <Link to={backTo} className={styles.backLink}>
            <ArrowLeft className={styles.backIcon} aria-hidden="true" />
            {backLabel ?? t('actions.back')}
          </Link>
          <LanguageSwitcher />
        </div>

        <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.formArea}>
          <div className={styles.form}>
            <Logo className={styles.mobileLogo} />
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
};
