import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  changeLanguage,
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  type Language,
} from '@/i18n';
import { cx } from '@/lib/cx';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/DropdownMenu';
import styles from './LanguageSwitcher.module.css';

export interface LanguageSwitcherProps {
  /**
   * buttons = segmented VI | EN toggle for headers;
   * menu = radio items, to place inside a DropdownMenuContent.
   */
  variant?: 'buttons' | 'menu';
  className?: string;
}

/** Switches the UI language through changeLanguage (persisted, updates <html lang>). */
export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'buttons',
  className,
}) => {
  const { t, i18n } = useTranslation();
  const current: Language = isSupportedLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;

  if (variant === 'menu') {
    return (
      <>
        <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => {
            if (isSupportedLanguage(value)) void changeLanguage(value);
          }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <DropdownMenuRadioItem key={lang} value={lang} lang={lang}>
              {LANGUAGE_NAMES[lang].native}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </>
    );
  }

  return (
    <div role="group" aria-label={t('language.label')} className={cx(styles.switcher, className)}>
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          aria-label={LANGUAGE_NAMES[lang].native}
          aria-pressed={lang === current}
          className={styles.option}
          onClick={() => void changeLanguage(lang)}
        >
          {LANGUAGE_NAMES[lang].short}
        </button>
      ))}
    </div>
  );
};
