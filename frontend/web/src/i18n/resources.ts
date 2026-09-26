import viCommon from '@/locales/vi/common.json';
import viAuth from '@/locales/vi/auth.json';
import viErrors from '@/locales/vi/errors.json';
import viNav from '@/locales/vi/nav.json';
import viValidation from '@/locales/vi/validation.json';
import enCommon from '@/locales/en/common.json';
import enAuth from '@/locales/en/auth.json';
import enErrors from '@/locales/en/errors.json';
import enNav from '@/locales/en/nav.json';
import enValidation from '@/locales/en/validation.json';

export const SUPPORTED_LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'vi';
export const DEFAULT_NAMESPACE = 'common';

/** Each language names itself, so the switcher reads the same whatever the current UI language. */
export const LANGUAGE_NAMES: Record<Language, { short: string; native: string }> = {
  vi: { short: 'VI', native: 'Tiếng Việt' },
  en: { short: 'EN', native: 'English' },
};

const vi = {
  common: viCommon,
  auth: viAuth,
  errors: viErrors,
  nav: viNav,
  validation: viValidation,
};
const en = {
  common: enCommon,
  auth: enAuth,
  errors: enErrors,
  nav: enNav,
  validation: enValidation,
};

/** 'vi' is the reference shape; every other language must provide the same keys. */
export const resources = { vi, en } satisfies Record<Language, typeof vi>;
