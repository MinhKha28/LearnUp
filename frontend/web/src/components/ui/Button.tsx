import React, { forwardRef } from 'react';
import { cx } from '@/lib/cx';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** md = 44px (in-app), lg = 48px (auth / public pages). */
  size?: ButtonSize;
  /** Disables the button and marks it aria-busy while an action runs. */
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      type = 'button',
      disabled,
      className,
      children,
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
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className
      )}
      {...rest}
    >
      {isLoading ? (
        <Spinner size="sm" decorative />
      ) : (
        leftIcon && (
          <span className={styles.icon} aria-hidden="true">
            {leftIcon}
          </span>
        )
      )}
      {children}
      {rightIcon && !isLoading && (
        <span className={styles.icon} aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </button>
  )
);

Button.displayName = 'Button';
