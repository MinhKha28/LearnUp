import React, { forwardRef } from 'react';
import { cx } from '@/lib/cx';
import { Spinner } from './Spinner';
import buttonStyles from './Button.module.css';
import styles from './IconButton.module.css';
import type { ButtonSize, ButtonVariant } from './Button';

export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> {
  /** Required: an icon-only button has no visible text to name it. */
  'aria-label': string;
  icon: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      type = 'button',
      disabled,
      className,
      ...rest
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cx(
        buttonStyles.button,
        buttonStyles[variant],
        styles.iconButton,
        styles[size],
        className
      )}
      {...rest}
    >
      {isLoading ? (
        <Spinner size="sm" decorative />
      ) : (
        <span className={buttonStyles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
    </button>
  )
);

IconButton.displayName = 'IconButton';
