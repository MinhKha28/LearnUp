import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './SkipLink.module.css';

export const MAIN_CONTENT_ID = 'main-content';

/** First focusable element of every layout: jumps past the header and navigation. */
export const SkipLink: React.FC = () => {
  const { t } = useTranslation();
  return (
    <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink}>
      {t('layout.skipToContent')}
    </a>
  );
};
