export type ClientMode = 'http' | 'fake';
export interface IssuanceConfig {
  enabled: boolean;
  brokers: string[];
  topic: string;
  groupId: string;
  tenantUrl: string;
  courseUrl: string;
  internalKey: string;
  profileMode: ClientMode;
  courseMode: ClientMode;
  concurrency: number;
  leaseMs: number;
  pollMs: number;
  timeoutMs: number;
  maxLogoBytes: number;
  logoHosts: string[];
}
export const ISSUANCE_CONFIG = Symbol('ISSUANCE_CONFIG');
export function issuanceConfig(
  get: (key: string) => string | undefined,
): IssuanceConfig {
  const number = (key: string, fallback: number, max: number) => {
    const value = Number(get(key) ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > max)
      throw new Error(`Invalid ${key}`);
    return value;
  };
  const mode = (key: string): ClientMode => {
    const value = get(key) ?? 'http';
    if (value !== 'http' && value !== 'fake') throw new Error(`Invalid ${key}`);
    if (
      value === 'fake' &&
      !['development', 'test'].includes(get('NODE_ENV') ?? '')
    )
      throw new Error(`Fake client forbidden outside development/test: ${key}`);
    return value;
  };
  const enabled = get('CERTIFICATE_CONSUMER_ENABLED') ?? 'false';
  if (!['true', 'false'].includes(enabled))
    throw new Error('Invalid CERTIFICATE_CONSUMER_ENABLED');
  return {
    enabled: enabled === 'true',
    brokers: (get('KAFKA_BROKERS') ?? 'localhost:9092')
      .split(',')
      .map((x) => x.trim()),
    topic: 'learnup.learning.enrollment-events',
    groupId: 'achievement-reporting-certificate-v1',
    tenantUrl: get('TENANT_SERVICE_URL') ?? 'http://tenant-service:8084',
    courseUrl: get('COURSE_SERVICE_URL') ?? 'http://course-service:8083',
    internalKey: get('INTERNAL_SERVICE_KEY') ?? '',
    profileMode: mode('CERTIFICATE_PROFILE_CLIENT_MODE'),
    courseMode: mode('CERTIFICATE_COURSE_CLIENT_MODE'),
    concurrency: number('CERTIFICATE_CONCURRENCY', 4, 64),
    leaseMs: number('CERTIFICATE_LEASE_MS', 120000, 3600000),
    pollMs: number('CERTIFICATE_POLL_MS', 1000, 60000),
    timeoutMs: number('CERTIFICATE_HTTP_TIMEOUT_MS', 5000, 60000),
    maxLogoBytes: number('CERTIFICATE_LOGO_MAX_BYTES', 2097152, 10485760),
    logoHosts: (get('CERTIFICATE_LOGO_HOSTS') ?? 'res.cloudinary.com')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  };
}
export class IssuanceError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export function retrySeconds(attempt: number, random = Math.random): number {
  const base = Math.min(60 * 2 ** Math.min(Math.max(0, attempt - 1), 3), 300);
  return Math.min(300, Math.round(base * (0.9 + 0.2 * random())));
}
