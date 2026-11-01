/** What the relay that publishes the outbox events of assessment-service reads from the environment. */
export interface RelayConfig {
  /** Off unless OUTBOX_RELAY_ENABLED=true: with the empty gate of step 22 turning it on would mark events as sent that went nowhere. */
  enabled: boolean;
  pollMs: number;
  batchSize: number;
  /** The claim, the send and the update of one batch run in one transaction, so it must be bounded. */
  transactionMs: number;
  backoffMs: number;
  backoffMaxMs: number;
  /** From this many failed attempts on a row, every further failure is logged as an alert. */
  alertAttempts: number;
}

export const RELAY_CONFIG = Symbol('RELAY_CONFIG');

export function readRelayConfig(
  get: (key: string) => string | undefined,
): RelayConfig {
  const integer = (key: string, fallback: number) => {
    const value = get(key) ?? String(fallback);
    if (
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) < 1
    )
      throw new Error(`Invalid ${key}`);
    return Number(value);
  };
  const enabled = get('OUTBOX_RELAY_ENABLED') ?? 'false';
  if (!['true', 'false'].includes(enabled))
    throw new Error('Invalid OUTBOX_RELAY_ENABLED');
  const config: RelayConfig = {
    enabled: enabled === 'true',
    pollMs: integer('OUTBOX_POLL_INTERVAL_MS', 1000),
    batchSize: integer('OUTBOX_BATCH_SIZE', 20),
    transactionMs: integer('OUTBOX_TRANSACTION_TIMEOUT_MS', 30000),
    backoffMs: integer('OUTBOX_BACKOFF_MS', 1000),
    backoffMaxMs: integer('OUTBOX_BACKOFF_MAX_MS', 300000),
    alertAttempts: integer('OUTBOX_ALERT_ATTEMPTS', 10),
  };
  if (config.backoffMaxMs < config.backoffMs)
    throw new Error(
      'OUTBOX_BACKOFF_MAX_MS must not be below OUTBOX_BACKOFF_MS',
    );
  if (config.batchSize > 1000) throw new Error('Invalid OUTBOX_BATCH_SIZE');
  return config;
}

/** Milliseconds to wait after the given number of failed attempts: doubles each time, up to a ceiling. */
export const retryDelay = (attempts: number, config: RelayConfig): number =>
  Math.min(
    config.backoffMaxMs,
    config.backoffMs * 2 ** Math.min(attempts - 1, 30),
  );
