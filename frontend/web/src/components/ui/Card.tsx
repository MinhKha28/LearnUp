import React from 'react';
import { cx } from '@/lib/cx';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** Use 'section' / 'article' when the card is a landmark or standalone content. */
  as?: 'div' | 'section' | 'article';
  padding?: 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  as: Component = 'div',
  padding = 'md',
  className,
  ...rest
}) => <Component className={cx(styles.card, styles[padding], className)} {...rest} />;
