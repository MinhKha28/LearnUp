import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldError } from 'react-hook-form';
import { decodeValidationMessage } from './validationMessage';

/** FieldError.type of errors set by applyServerFieldErrors: their message is shown as is. */
export const SERVER_ERROR_TYPE = 'server';

/**
 * Returns a function that turns a react-hook-form FieldError into the text for TextField's
 * `error` prop (or Select / Checkbox), translated in the current language.
 *
 * @example
 * const errorText = useFieldErrorText();
 * <TextField {...register('email')} error={errorText(errors.email)} />
 */
export const useFieldErrorText = () => {
  const { t, i18n } = useTranslation('validation');

  return useCallback(
    (error: FieldError | undefined): string | undefined => {
      if (!error?.message) return undefined;
      if (error.type === SERVER_ERROR_TYPE) return error.message;

      const { key, values } = decodeValidationMessage(error.message);
      return i18n.exists(key, { ns: 'validation' }) ? t(key as 'invalid', values) : t('invalid');
    },
    [t, i18n]
  );
};
