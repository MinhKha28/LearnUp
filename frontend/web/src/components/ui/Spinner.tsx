import React from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '@/lib/cx';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label; defaults to common:loading.default. */
  label?: string;
  /** Hide from assistive tech when the surrounding element already reports loading (e.g. a busy button). */
  decorative?: boolean;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  label,
  decorative = false,
  className,
}) => {
  const { t } = useTranslation();

  if (decorative) {
    return <span className={cx(styles.spinner, styles[size], className)} aria-hidden="true" />;
  }

  return (
    <span role="status" className={cx(styles.wrapper, className)}>
      <span className={cx(styles.spinner, styles[size])} aria-hidden="true" />
      <span className={styles.srOnly}>{label ?? t('loading.default')}</span>
    </span>
  );
};
