import { describe, it, expect } from 'vitest';
import { i18n } from '@/i18n';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';

// Intl inserts non-breaking spaces (U+00A0, U+202F); normalize them for readable expectations.
const normalize = (value: string) => value.replace(/\s/g, ' ');

// Local time, so the result does not depend on the machine's time zone.
const SAMPLE_DATE = new Date(2026, 8, 26, 14, 30);

describe('format (vi)', () => {
  it('formatDate', () => {
    expect(formatDate(SAMPLE_DATE)).toBe('26/09/2026');
  });

  it('formatDate accepts ISO strings and timestamps', () => {
    expect(formatDate(SAMPLE_DATE.toISOString())).toBe('26/09/2026');
    expect(formatDate(SAMPLE_DATE.getTime())).toBe('26/09/2026');
  });

  it('formatDateTime', () => {
    expect(normalize(formatDateTime(SAMPLE_DATE))).toBe('14:30 26/09/2026');
  });

  it('formatNumber', () => {
    expect(formatNumber(1234567.89)).toBe('1.234.567,89');
  });

  it('formatCurrency defaults to VND', () => {
    expect(normalize(formatCurrency(1234567))).toBe('1.234.567 ₫');
  });
});

describe('format (en)', () => {
  it('formats using the current language', async () => {
    await i18n.changeLanguage('en');

    expect(formatDate(SAMPLE_DATE)).toBe('09/26/2026');
    expect(normalize(formatDateTime(SAMPLE_DATE))).toBe('09/26/2026, 02:30 PM');
    expect(formatNumber(1234567.89)).toBe('1,234,567.89');
    expect(normalize(formatCurrency(1234567))).toBe('₫1,234,567');
    expect(normalize(formatCurrency(1234.5, 'USD'))).toBe('$1,234.50');
  });
});
