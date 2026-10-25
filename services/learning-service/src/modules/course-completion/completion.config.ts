import { completionTimeout } from '../../infrastructure/clients/assessment/assessment-completion.client';
export const COMPLETION_CONFIG = Symbol('COMPLETION_CONFIG');
export interface CompletionConfig {
  enabled: boolean;
  leaseMs: number;
  pollMs: number;
  batchSize: number;
  concurrency: number;
  transactionMs: number;
  backoffMs: number;
  backoffMaxMs: number;
}
export function readCompletionConfig(
  get: (key: string) => string | undefined,
): CompletionConfig {
  const integer = (key: string, fallback: number) => {
    const value = Number(get(key) ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error(`Invalid ${key}`);
    return value;
  };
  const enabled = get('COMPLETION_WORKER_ENABLED') ?? 'true';
  if (!['true', 'false'].includes(enabled))
    throw new Error('Invalid COMPLETION_WORKER_ENABLED');
  const c = {
    enabled: enabled === 'true',
    leaseMs: integer('COMPLETION_LEASE_MS', 30000),
    pollMs: integer('COMPLETION_POLL_MS', 1000),
    batchSize: integer('COMPLETION_BATCH_SIZE', 5),
    concurrency: integer('COMPLETION_CONCURRENCY', 5),
    transactionMs: integer('COMPLETION_TRANSACTION_MS', 5000),
    backoffMs: integer('COMPLETION_BACKOFF_MS', 1000),
    backoffMaxMs: integer('COMPLETION_BACKOFF_MAX_MS', 300000),
  };
  if (c.leaseMs <= completionTimeout(get) + c.transactionMs + 1000)
    throw new Error(
      'COMPLETION_LEASE_MS must exceed assessment timeout + completion transaction timeout + 1000ms safety margin',
    );
  if (c.backoffMaxMs < c.backoffMs)
    throw new Error('Completion maximum backoff must be >= initial backoff');
  return c;
}
