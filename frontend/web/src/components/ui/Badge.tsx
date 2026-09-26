import React from 'react';
import { cx } from '@/lib/cx';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Status label. Color is never the only signal: the text itself carries the meaning. */
export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', className, ...rest }) => (
  <span className={cx(styles.badge, styles[tone], className)} {...rest} />
);
