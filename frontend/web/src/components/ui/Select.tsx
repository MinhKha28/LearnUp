import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '@/lib/cx';
import { useFieldA11y } from './useFieldA11y';
import fieldStyles from './Field.module.css';
import styles from './Select.module.css';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  /** Renders an empty, non-selectable first option. */
  placeholder?: string;
}

/** Native <select>: keyboard, mobile pickers and screen readers work out of the box. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      placeholder,
      required,
      id,
      className,
      children,
      'aria-describedby': describedBy,
      ...rest
    },
    ref
  ) => {
    const { controlId, helperId, errorId, controlProps } = useFieldA11y({
      id,
      helperText,
      error,
      describedBy,
    });

    return (
      <div className={cx(fieldStyles.field, className)}>
        <label
          htmlFor={controlId}
          className={cx(fieldStyles.label, required && fieldStyles.required)}
        >
          {label}
        </label>

        <div className={styles.selectWrapper}>
          <select
            ref={ref}
            required={required}
            className={cx(fieldStyles.control, styles.select)}
            {...controlProps}
            {...rest}
          >
            {placeholder !== undefined && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {children}
          </select>
          <ChevronDown className={styles.chevron} aria-hidden="true" />
        </div>

        {helperText && (
          <p id={helperId} className={fieldStyles.helper}>
            {helperText}
          </p>
        )}
        {error && (
          <p id={errorId} className={fieldStyles.error}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
