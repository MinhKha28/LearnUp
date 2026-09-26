import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cx } from '@/lib/cx';
import styles from './Alert.module.css';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: AlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** false = text only (auth pages design); the tone still shows through colour and text. */
  showIcon?: boolean;
}

const ICONS: Record<AlertTone, React.ElementType> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

/**
 * danger → role="alert" (announced immediately); other tones → role="status" (polite).
 */
export const Alert: React.FC<AlertProps> = ({
  tone = 'info',
  title,
  children,
  showIcon = true,
  className,
  ...rest
}) => {
  const Icon = ICONS[tone];

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx(styles.alert, styles[tone], className)}
      {...rest}
    >
      {showIcon && <Icon className={styles.icon} aria-hidden="true" />}
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.body}>{children}</div>}
      </div>
    </div>
  );
};
