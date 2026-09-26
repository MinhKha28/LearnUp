import type { ParseKeys } from 'i18next';
import type { core } from 'zod';

/** A translation key in the "validation" namespace. */
export type ValidationKey = ParseKeys<'validation'>;

type MessageValues = Record<string, string | number>;

const SEPARATOR = '|';

/**
 * Encodes a validation message for a zod schema: the i18n key plus optional interpolation values.
 * useFieldErrorText decodes and translates it, so schemas never hold user-facing text.
 *
 * @example z.string().min(8, vmsg('tooShort', { min: 8 }))
 */
export const vmsg = (key: ValidationKey, values?: MessageValues): string =>
  values ? `${key}${SEPARATOR}${JSON.stringify(values)}` : key;

export const decodeValidationMessage = (
  message: string
): { key: string; values?: MessageValues } => {
  const at = message.indexOf(SEPARATOR);
  if (at < 0) return { key: message };
  try {
    return {
      key: message.slice(0, at),
      values: JSON.parse(message.slice(at + SEPARATOR.length)) as MessageValues,
    };
  } catch {
    return { key: message.slice(0, at) };
  }
};

/**
 * Default message for zod issues that have no message of their own in the schema.
 * Passed per parse by formResolver, so it never overrides a vmsg() written in a schema.
 */
export const validationErrorMap = (issue: core.$ZodRawIssue): string => {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined || issue.input === null ? vmsg('required') : vmsg('invalid');
    case 'too_small':
      if (issue.origin === 'string') {
        return Number(issue.minimum) <= 1
          ? vmsg('required')
          : vmsg('tooShort', { min: Number(issue.minimum) });
      }
      return vmsg('invalid');
    case 'too_big':
      return issue.origin === 'string'
        ? vmsg('tooLong', { max: Number(issue.maximum) })
        : vmsg('invalid');
    case 'invalid_format':
      return issue.format === 'email' ? vmsg('email') : vmsg('invalid');
    default:
      return vmsg('invalid');
  }
};
