import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_NAMESPACE,
  Language,
  SUPPORTED_LANGUAGES,
  resources,
} from './resources';

export { DEFAULT_LANGUAGE, LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from './resources';
export type { Language } from './resources';

export const LANGUAGE_STORAGE_KEY = 'learnup.language';

export const isSupportedLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);

/** Stored preference if valid, otherwise 'vi'. The browser language is intentionally ignored. */
export const getInitialLanguage = (): Language => {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

const setDocumentLanguage = (lang: Language) => {
  document.documentElement.lang = lang;
};

/**
 * Initializes i18next synchronously with statically bundled resources.
 * Must run before the first render.
 */
export const initI18n = (): typeof i18n => {
  if (i18n.isInitialized) {
    return i18n;
  }

  const lng = getInitialLanguage();

  void i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    ns: Object.keys(resources[DEFAULT_LANGUAGE]),
    defaultNS: DEFAULT_NAMESPACE,
    initAsync: false,
    interpolation: {
      escapeValue: false, // React already escapes rendered values
    },
    returnNull: false,
  });

  setDocumentLanguage(lng);
  return i18n;
};

/** Switches the UI language, persists the choice and updates <html lang>. */
export const changeLanguage = async (lang: Language): Promise<void> => {
  if (!isSupportedLanguage(lang)) {
    return;
  }

  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Storage unavailable: the choice still applies for this session
  }

  await i18n.changeLanguage(lang);
  setDocumentLanguage(lang);
};

export { i18n };
