import { HttpException } from '@nestjs/common';
export const CERTIFICATE_READ_CONFIG = Symbol('CERTIFICATE_READ_CONFIG');
export interface CertificateReadConfig {
  queueSize: number;
  queueWaitMs: number;
}
export function certificateReadConfig(
  get: (key: string) => string | undefined,
): CertificateReadConfig {
  const integer = (key: string, fallback: number, max: number) => {
    const value = Number(get(key) ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > max)
      throw new Error('Invalid ' + key);
    return value;
  };
  return {
    queueSize: integer('CERTIFICATE_PDF_QUEUE_SIZE', 16, 100),
    queueWaitMs: integer('CERTIFICATE_PDF_QUEUE_WAIT_MS', 1500, 10000),
  };
}
export function unavailable(): never {
  throw new HttpException({ code: 'SERVICE_UNAVAILABLE' }, 503);
}
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
export function issuedDate(date: Date, timezone: string): string {
  let formatter = dateFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateFormatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return part('year') + '-' + part('month') + '-' + part('day');
}
export const displayDate = (date: string) =>
  date.split('-').reverse().join('/');
export const formattedCode = (code: string) => code.match(/.{1,4}/g)!.join('-');
export function pdfDisposition(code: string): string {
  const name = code.normalize('NFC') + '.pdf';
  const safe = name.replace(/[^A-Za-z0-9._-]/g, '_');
  const encoded = encodeURIComponent(name).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  return 'attachment; filename="' + safe + "\"; filename*=UTF-8''" + encoded;
}
