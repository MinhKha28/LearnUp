import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  changeLanguage,
  getInitialLanguage,
  i18n,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from '@/i18n';

type Messages = { [key: string]: string | Messages };

const localeModules = import.meta.glob<Messages>('../src/locales/*/*.json', {
  eager: true,
  import: 'default',
});

/** { vi: { common: {...}, auth: {...} }, en: {...} } built from the files on disk. */
const localesByLanguage = Object.entries(localeModules).reduce<
  Record<string, Record<string, Messages>>
>((acc, [path, messages]) => {
  const [, lang, ns] = path.match(/locales\/([^/]+)\/([^/]+)\.json$/)!;
  acc[lang] = { ...acc[lang], [ns]: messages };
  return acc;
}, {});

const flattenKeys = (messages: Messages, prefix = ''): string[] =>
  Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : flattenKeys(value, path);
  });

describe('locale files', () => {
  const reference = localesByLanguage.vi;
  const namespaces = Object.keys(reference).sort();

  it('should provide every namespace for every supported language', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(Object.keys(localesByLanguage[lang] ?? {}).sort(), `namespaces of "${lang}"`).toEqual(
        namespaces
      );
    }
  });

  it.each(SUPPORTED_LANGUAGES.filter((lang) => lang !== 'vi'))(
    'should have exactly the same keys in "%s" as in "vi"',
    (lang) => {
      const problems: string[] = [];

      for (const ns of namespaces) {
        const viKeys = new Set(flattenKeys(reference[ns]));
        const otherKeys = new Set(flattenKeys(localesByLanguage[lang]?.[ns] ?? {}));

        for (const key of viKeys) {
          if (!otherKeys.has(key)) problems.push(`missing in ${lang}: ${ns}:${key}`);
        }
        for (const key of otherKeys) {
          if (!viKeys.has(key)) problems.push(`missing in vi: ${ns}:${key}`);
        }
      }

      expect(problems, problems.join('\n')).toEqual([]);
    }
  );

  it('should not contain empty translations', () => {
    const empty = Object.entries(localesByLanguage).flatMap(([lang, nsMap]) =>
      Object.entries(nsMap).flatMap(([ns, messages]) =>
        flattenKeys(messages)
          .filter((key) => {
            const value = key.split('.').reduce<string | Messages>((node, part) => {
              return (node as Messages)[part];
            }, messages);
            return typeof value === 'string' && value.trim() === '';
          })
          .map((key) => `${lang}/${ns}:${key}`)
      )
    );

    expect(empty, empty.join('\n')).toEqual([]);
  });
});

describe('language selection', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should default to "vi" when nothing is stored', () => {
    expect(getInitialLanguage()).toBe('vi');
  });

  it('should use a valid stored language', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    expect(getInitialLanguage()).toBe('en');
  });

  it('should ignore an unsupported stored language', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    expect(getInitialLanguage()).toBe('vi');
  });

  it('should fall back to "vi" when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(getInitialLanguage()).toBe('vi');
  });

  it('should not detect the browser language', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    expect(getInitialLanguage()).toBe('vi');
  });

  it('should start in "vi" with <html lang="vi">', () => {
    expect(i18n.language).toBe('vi');
    expect(document.documentElement.lang).toBe('vi');
  });

  it('changeLanguage should switch language, persist it and update <html lang>', async () => {
    await changeLanguage('en');

    expect(i18n.language).toBe('en');
    expect(i18n.t('auth:login.submit')).toBe('Sign in');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    await changeLanguage('vi');
    expect(document.documentElement.lang).toBe('vi');
  });
});
