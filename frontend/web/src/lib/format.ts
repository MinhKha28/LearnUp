import { i18n, isSupportedLanguage, DEFAULT_LANGUAGE, Language } from '@/i18n';

type DateInput = Date | string | number;

const INTL_LOCALES: Record<Language, string> = {
  vi: 'vi-VN',
  en: 'en-US',
};

const currentLocale = (): string =>
  INTL_LOCALES[isSupportedLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE];

const toDate = (value: DateInput): Date => (value instanceof Date ? value : new Date(value));

/** vi: 26/09/2026 · en: 09/26/2026 */
export const formatDate = (value: DateInput, options?: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat(currentLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  }).format(toDate(value));

/** vi: 14:30 26/09/2026 · en: 09/26/2026, 02:30 PM */
export const formatDateTime = (value: DateInput, options?: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat(currentLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(toDate(value));

/** vi: 1.234.567,89 · en: 1,234,567.89 */
export const formatNumber = (value: number, options?: Intl.NumberFormatOptions): string =>
  new Intl.NumberFormat(currentLocale(), options).format(value);

/** vi: 1.234.567 ₫ · en: ₫1,234,567 */
export const formatCurrency = (amount: number, currency = 'VND'): string =>
  new Intl.NumberFormat(currentLocale(), { style: 'currency', currency }).format(amount);
