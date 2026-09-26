import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LOGIN_PATH, PRICING_PATH } from '@/config/routes';
import { cx } from '@/lib/cx';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';
import { MAIN_CONTENT_ID, SkipLink } from './SkipLink';
import styles from './PublicLayout.module.css';

/** Pages open to guests (pricing, sign-up): header, centred content container, one-line footer. */
export const PublicLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation(['common', 'nav']);

  return (
    <div className={styles.page}>
      <SkipLink />

      <header className={styles.header}>
        <div className={cx(styles.container, styles.headerInner)}>
          <Logo to={PRICING_PATH} />
          <nav aria-label={t('layout.publicNavigation')} className={styles.nav}>
            <NavLink
              to={PRICING_PATH}
              className={({ isActive }) => cx(styles.navLink, isActive && styles.navLinkActive)}
            >
              {t('nav:public.pricing')}
            </NavLink>
          </nav>
          <div className={styles.actions}>
            <LanguageSwitcher />
            <ButtonLink to={LOGIN_PATH} variant="secondary">
              {t('actions.signIn')}
            </ButtonLink>
          </div>
        </div>
      </header>

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={cx(styles.container, styles.content)}>
        {children ?? <Outlet />}
      </main>

      <footer className={styles.footer}>
        <p className={styles.container}>{t('layout.footer', { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
};
