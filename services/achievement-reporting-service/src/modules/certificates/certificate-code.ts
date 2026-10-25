import { randomBytes } from 'node:crypto';
const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function certificateCode(): string {
  return [...randomBytes(12)].map((byte) => alphabet[byte & 31]).join('');
}
export function normalizeCertificateCode(input: string): string {
  if (input.length > 14) throw new Error('INVALID_CERTIFICATE_CODE');
  const code = input
    .replaceAll('-', '')
    .toUpperCase()
    .replace(/[IL]/g, '1')
    .replaceAll('O', '0');
  if (!/^[0-9A-HJKMNP-TV-Z]{12}$/.test(code))
    throw new Error('INVALID_CERTIFICATE_CODE');
  return code;
}
