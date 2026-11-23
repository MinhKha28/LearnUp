import { createHash, timingSafeEqual } from 'node:crypto';

const SECRET_HASH_ALGORITHM = 'sha256';
const SECRET_ENCODING = 'utf8';

/** Validate the internal credential presented by a service caller. */
export function constantTimeSecretEqual(
  provided: unknown,
  expected: unknown,
): boolean {
  if (typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  if (!provided || !expected.trim()) {
    return false;
  }

  const providedDigest = createHash(SECRET_HASH_ALGORITHM)
    .update(provided, SECRET_ENCODING)
    .digest();
  const expectedDigest = createHash(SECRET_HASH_ALGORITHM)
    .update(expected, SECRET_ENCODING)
    .digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}
