import viCommon from '@/locales/vi/common.json';
import viAuth from '@/locales/vi/auth.json';
import viErrors from '@/locales/vi/errors.json';
import enCommon from '@/locales/en/common.json';
import enAuth from '@/locales/en/auth.json';
import enErrors from '@/locales/en/errors.json';

export const SUPPORTED_LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'vi';
export const DEFAULT_NAMESPACE = 'common';

const vi = { common: viCommon, auth: viAuth, errors: viErrors };
const en = { common: enCommon, auth: enAuth, errors: enErrors };

/** 'vi' is the reference shape; every other language must provide the same keys. */
export const resources = { vi, en } satisfies Record<Language, typeof vi>;
