import React from 'react';
import { cx } from '@/lib/cx';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  /** Decorative icon (hidden from assistive tech). */
  icon?: React.ReactNode;
  /** Usually a Button. */
  action?: React.ReactNode;
  /** Heading level that fits the page outline; defaults to h2. Use 1 when the state is the whole page. */
  headingLevel?: 1 | 2 | 3 | 4;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  headingLevel = 2,
  className,
}) => {
  const Heading = `h${headingLevel}` as const;

  return (
    <div className={cx(styles.emptyState, className)}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <Heading className={styles.title}>{title}</Heading>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
};
