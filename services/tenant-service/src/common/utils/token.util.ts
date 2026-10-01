import { createHash, randomBytes } from 'node:crypto';

/**
 * Sinh một liên kết bí mật (thiết kế tenant_db mục 3.3):
 * - rawToken: 32 byte ngẫu nhiên, mã hóa base64url (43 ký tự) -> gửi trong email.
 * - tokenHash: SHA-256 của rawToken (32 byte) -> lưu trong database.
 * Database bị lộ thì kẻ xấu chỉ có mã băm, không dùng được liên kết.
 */
export function generateSecretToken(): {
  rawToken: string;
  tokenHash: Uint8Array<ArrayBuffer>;
} {
  const rawToken = randomBytes(32).toString('base64url');
  return { rawToken, tokenHash: hashToken(rawToken) };
}

// Prisma 7 dùng kiểu Uint8Array cho cột bytea, nên bọc Buffer lại thành Uint8Array.
export function hashToken(rawToken: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(createHash('sha256').update(rawToken).digest());
}
