import React, { forwardRef } from 'react';
import { cx } from '@/lib/cx';
import { useFieldA11y } from './useFieldA11y';
import fieldStyles from './Field.module.css';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  label: React.ReactNode;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, helperText, error, id, className, 'aria-describedby': describedBy, ...rest }, ref) => {
    const { controlId, helperId, errorId, controlProps } = useFieldA11y({
      id,
      helperText,
      error,
      describedBy,
    });

    return (
      <div className={cx(styles.checkboxField, className)}>
        <div className={styles.row}>
          <input ref={ref} type="checkbox" className={styles.input} {...controlProps} {...rest} />
          <label
            htmlFor={controlId}
            className={cx(styles.label, rest.required && fieldStyles.required)}
          >
            {label}
          </label>
        </div>

        {helperText && (
          <p id={helperId} className={cx(fieldStyles.helper, styles.message)}>
            {helperText}
          </p>
        )}
        {error && (
          <p id={errorId} className={cx(fieldStyles.error, styles.message)}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
