export const INTERNAL_SERVICE_KEY_DENYLIST = [
  'learnup-internal-secret',
] as const;

/** Enforce deployment credentials unless development/test is explicitly selected. */
export function validateInternalServiceKey(
  key: unknown,
  nodeEnv: unknown,
): void {
  if (nodeEnv === 'development' || nodeEnv === 'test') return;

  if (
    typeof key !== 'string' ||
    !key.trim() ||
    new TextEncoder().encode(key).byteLength < 32 ||
    INTERNAL_SERVICE_KEY_DENYLIST.some((value) => key.trim() === value)
  ) {
    throw new Error(
      'INTERNAL_SERVICE_KEY must be explicitly configured, non-default and at least 32 UTF-8 bytes outside development/test',
    );
  }
}
