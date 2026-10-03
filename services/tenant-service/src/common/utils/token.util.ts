import { createHash, randomBytes } from 'node:crypto';

export function generateSecretToken(): {
  rawToken: string;
  tokenHash: Uint8Array<ArrayBuffer>;
} {
  const rawToken = randomBytes(32).toString('base64url');
  return { rawToken, tokenHash: hashToken(rawToken) };
}

export function hashToken(rawToken: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(createHash('sha256').update(rawToken).digest());
}
