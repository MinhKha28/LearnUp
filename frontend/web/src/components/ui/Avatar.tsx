import React, { useState } from 'react';
import { cx } from '@/lib/cx';
import styles from './Avatar.module.css';

export interface AvatarProps {
  /** Person's name: used as the accessible name and for the initials fallback. */
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** "Nguyễn Văn An" → "NA"; "learner1" → "L". Locale-aware upper-casing keeps Vietnamese letters (Đ). */
const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toLocaleUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', className }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && src !== failedSrc;

  return showImage ? (
    <img
      src={src!}
      alt={name}
      className={cx(styles.avatar, styles[size], className)}
      onError={() => setFailedSrc(src!)}
    />
  ) : (
    <span role="img" aria-label={name} className={cx(styles.avatar, styles[size], className)}>
      <span aria-hidden="true">{getInitials(name)}</span>
    </span>
  );
};
