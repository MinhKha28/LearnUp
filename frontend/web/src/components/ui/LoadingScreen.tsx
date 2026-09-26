import React from 'react';
import { Spinner } from './Spinner';
import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  message: string;
}

/** Full-viewport loading state; the message is the accessible status text. */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => (
  <div role="status" className={styles.screen}>
    <Spinner size="lg" decorative className={styles.spinner} />
    <p className={styles.message}>{message}</p>
  </div>
);
