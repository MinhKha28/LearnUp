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
  /** Pinned to the bottom of the form column, above the small app name (e.g. a sign-up link). */
  footer?: React.ReactNode;
  /** Form content; defaults to the matched child route. */
  children?: React.ReactNode;
}

/**
 * Sign in / auth pages, laid out as the UC05 design (1440×1024):
 * - dark panel on the left (hidden below 768px), --layout-auth-panel-ratio of the width and at most
 *   --layout-auth-panel-max-width: logo, hero + panel content in a centred column, tagline at the
 *   bottom;
 * - form column on the right: back link, the page content from the top, and a footer pinned to the
 *   bottom, all --layout-auth-form-width wide and centred. The language switcher sits in the top
 *   right corner, out of the flow.
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({
  heroTitle,
  heroDescription,
  panelContent,
  backTo = PRICING_PATH,
  backLabel,
  footer,
  children,
}) => {
  const { t } = useTranslation(['common', 'auth']);

  return (
    <div className={styles.page}>
      <SkipLink />

      <aside className={styles.panel}>
        <Logo variant="inverse" wordmark />
        <div className={styles.panelBody}>
          <div className={styles.hero}>
            <p className={styles.heroTitle}>{heroTitle ?? t('auth:layout.heroTitle')}</p>
            <p className={styles.heroDescription}>
              {heroDescription ?? t('auth:layout.heroDescription')}
            </p>
          </div>
          {panelContent}
        </div>
        <p className={styles.tagline}>{t('auth:layout.tagline')}</p>
      </aside>

      <div className={styles.formColumn}>
        <LanguageSwitcher className={styles.language} />

        <div className={styles.topBar}>
          <Link to={backTo} className={styles.backLink}>
            <ArrowLeft className={styles.backIcon} aria-hidden="true" />
            {backLabel ?? t('auth:layout.backToHome')}
          </Link>
        </div>

        <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.formArea}>
          <Logo className={styles.mobileLogo} wordmark />
          {children ?? <Outlet />}
        </main>

        <footer className={styles.footer}>
          {footer}
          <p className={styles.footerBrand}>{t('appName')}</p>
        </footer>
      </div>
    </div>
  );
};
