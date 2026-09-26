import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './LoginPanel.module.css';

const HIGHLIGHTS = ['courses', 'assignments', 'results'] as const;

/** Dark-panel content of the sign-in page: what a LearnUP workspace covers. */
export const LoginPanel: React.FC = () => {
  const { t } = useTranslation('auth');
  const eyebrowId = useId();

  return (
    <div className={styles.card}>
      <p id={eyebrowId} className={styles.eyebrow}>
        {t('login.panel.eyebrow')}
      </p>
      <ol aria-labelledby={eyebrowId} className={styles.list}>
        {HIGHLIGHTS.map((key, index) => (
          <li key={key} className={styles.item}>
            <span className={styles.number} aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className={styles.text}>
              <p className={styles.itemTitle}>{t(`login.panel.${key}.title`)}</p>
              <p className={styles.itemDescription}>{t(`login.panel.${key}.description`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
