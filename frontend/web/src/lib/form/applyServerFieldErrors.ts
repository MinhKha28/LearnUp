import axios from 'axios';
import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';
import { STANDARD_ERROR_CODES, type ApiResponse } from '@learnup/ts-common';
import { getApiErrorMessage } from '@/services/apiClient';
import { SERVER_ERROR_TYPE } from './useFieldErrorText';

export interface ApplyServerFieldErrorsOptions<T extends FieldValues> {
  /** Server field name → form field, when they differ (e.g. { username: 'email' }). */
  fieldMap?: Partial<Record<string, FieldPath<T>>>;
  /** Alert text when the server gives none; defaults to errors:generic. */
  fallback?: string;
}

/** Splits a server detail "field: message" (java-common GlobalExceptionHandler format). */
const parseDetail = (detail: string): { field: string; message: string } | null => {
  const at = detail.indexOf(': ');
  if (at <= 0) return null;
  return { field: detail.slice(0, at).trim(), message: detail.slice(at + 2).trim() };
};

/**
 * Puts the field errors of a VALIDATION_ERROR response on the matching form fields and focuses
 * the first one.
 *
 * Returns the message to show in the form's Alert, or null when every error landed on a field:
 * - VALIDATION_ERROR whose details all match a field in `fields` → null;
 * - anything else (other error codes, network errors, details without a known field) →
 *   getApiErrorMessage(err, fallback). Fields that did match are still set.
 */
export const applyServerFieldErrors = <T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fields: readonly FieldPath<T>[],
  options: ApplyServerFieldErrorsOptions<T> = {}
): string | null => {
  const alertMessage = () => getApiErrorMessage(err, options.fallback);

  if (!axios.isAxiosError<ApiResponse<unknown>>(err)) return alertMessage();
  const apiError = err.response?.data?.error;
  if (apiError?.code !== STANDARD_ERROR_CODES.VALIDATION_ERROR || !apiError.details?.length) {
    return alertMessage();
  }

  let hasUnmatched = false;
  let isFirst = true;
  const seen = new Set<string>();

  for (const detail of apiError.details) {
    const parsed = parseDetail(detail);
    const field = parsed && (options.fieldMap?.[parsed.field] ?? parsed.field);

    if (!parsed || !field || !fields.includes(field as FieldPath<T>)) {
      hasUnmatched = true;
      continue;
    }
    // Keep the first message when the server reports several for one field
    if (seen.has(field)) continue;
    seen.add(field);

    setError(
      field as FieldPath<T>,
      { type: SERVER_ERROR_TYPE, message: parsed.message },
      { shouldFocus: isFirst }
    );
    isFirst = false;
  }

  return hasUnmatched ? alertMessage() : null;
};
