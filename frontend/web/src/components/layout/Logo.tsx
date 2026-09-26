import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GraduationCap } from 'lucide-react';
import { cx } from '@/lib/cx';
import styles from './Logo.module.css';

export interface LogoProps {
  /** Renders the logo as a link. */
  to?: string;
  /** inverse = white wordmark for the dark auth panel. */
  variant?: 'default' | 'inverse';
  /** Mark only (collapsed sidebar); the app name stays as the accessible name. */
  compact?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  to,
  variant = 'default',
  compact = false,
  className,
}) => {
  const { t } = useTranslation();
  const classes = cx(styles.logo, variant === 'inverse' && styles.inverse, className);
  const content = (
    <>
      <span className={styles.mark} aria-hidden="true">
        <GraduationCap />
      </span>
      {!compact && <span>{t('appName')}</span>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={compact ? t('appName') : undefined}>
        {content}
      </Link>
    );
  }

  return compact ? (
    <span role="img" aria-label={t('appName')} className={classes}>
      {content}
    </span>
  ) : (
    <span className={classes}>{content}</span>
  );
};
