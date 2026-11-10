import type { IssuanceConfig } from './issuance.config';
export interface SignerConfig {
  accessMode: 'fake' | 'http';
  cleanupEnabled: boolean;
  cleanupDelayMs: number;
  cleanupPollMs: number;
  cleanupLeaseMs: number;
  cleanupWarnSeconds: number;
}
export const SIGNER_CONFIG = Symbol('SIGNER_CONFIG');
export function signerConfig(
  get: (key: string) => string | undefined,
  issuance: IssuanceConfig,
): SignerConfig {
  const number = (key: string, fallback: number, max = 86400000) => {
    const n = Number(get(key) ?? fallback);
    if (!Number.isSafeInteger(n) || n < 1 || n > max)
      throw new Error(`Invalid ${key}`);
    return n;
  };
  const accessMode = get('CERTIFICATE_SIGNER_ACCESS_CLIENT_MODE') ?? 'http';
  if (accessMode !== 'http' && accessMode !== 'fake')
    throw new Error('Invalid CERTIFICATE_SIGNER_ACCESS_CLIENT_MODE');
  if (
    accessMode === 'fake' &&
    !['development', 'test'].includes(get('NODE_ENV') ?? '')
  )
    throw new Error('Fake signer access forbidden outside development/test');
  const enabled = get('CERTIFICATE_CLEANUP_ENABLED') ?? 'true';
  if (!['true', 'false'].includes(enabled))
    throw new Error('Invalid CERTIFICATE_CLEANUP_ENABLED');
  const cleanupDelayMs = number('CERTIFICATE_CLEANUP_DELAY_MS', 600000);
  if (cleanupDelayMs <= issuance.leaseMs + issuance.timeoutMs)
    throw new Error(
      'Cleanup delay must exceed issuance lease plus read timeout',
    );
  const cleanupLeaseMs = number('CERTIFICATE_CLEANUP_LEASE_MS', 120000);
  if (cleanupLeaseMs <= issuance.timeoutMs)
    throw new Error('Cleanup lease must exceed storage timeout');
  return {
    accessMode,
    cleanupEnabled: enabled === 'true',
    cleanupDelayMs,
    cleanupPollMs: number('CERTIFICATE_CLEANUP_POLL_MS', 1000, 60000),
    cleanupLeaseMs,
    cleanupWarnSeconds: number(
      'CERTIFICATE_CLEANUP_WARN_SECONDS',
      3600,
      604800,
    ),
  };
}
