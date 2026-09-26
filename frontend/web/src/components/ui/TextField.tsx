import React, { forwardRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { cx } from '@/lib/cx';
import { IconButton } from './IconButton';
import { useFieldA11y } from './useFieldA11y';
import fieldStyles from './Field.module.css';
import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  helperText?: React.ReactNode;
  /** Error message; also sets aria-invalid. */
  error?: React.ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      helperText,
      error,
      required,
      type = 'text',
      id,
      className,
      'aria-describedby': describedBy,
      ...rest
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const { controlId, helperId, errorId, controlProps } = useFieldA11y({
      id,
      helperText,
      error,
      describedBy,
    });

    const isPassword = type === 'password';
    const inputType = isPassword && isPasswordVisible ? 'text' : type;

    return (
      <div className={cx(fieldStyles.field, className)}>
        <label
          htmlFor={controlId}
          className={cx(fieldStyles.label, required && fieldStyles.required)}
        >
          {label}
        </label>

        <div className={styles.inputWrapper}>
          <input
            ref={ref}
            type={inputType}
            required={required}
            className={cx(fieldStyles.control, isPassword && styles.withToggle)}
            {...controlProps}
            {...rest}
          />
          {isPassword && (
            <IconButton
              className={styles.toggle}
              aria-label={isPasswordVisible ? t('password.hide') : t('password.show')}
              aria-controls={controlId}
              icon={isPasswordVisible ? <EyeOff /> : <Eye />}
              onClick={() => setIsPasswordVisible((visible) => !visible)}
              disabled={rest.disabled}
            />
          )}
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

TextField.displayName = 'TextField';
