export interface RelayConfig {
  enabled: boolean;
  brokers: string[];
  topic: string;
  replicationFactor: number;
  pollMs: number;
  batchSize: number;
  deliveryMs: number;
  transactionMs: number;
  probeMs: number;
  backoffMs: number;
  backoffMaxMs: number;
  alertAttempts: number;
}
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
  const c: RelayConfig = {
    enabled: enabled === 'true',
    brokers: (get('KAFKA_BROKERS') ?? 'localhost:9092')
      .split(',')
      .map((s) => s.trim()),
    topic: get('OUTBOX_TOPIC') ?? 'learnup.learning.enrollment-events',
    replicationFactor: integer('OUTBOX_REPLICATION_FACTOR', 1),
    pollMs: integer('OUTBOX_POLL_INTERVAL_MS', 1000),
    batchSize: integer('OUTBOX_BATCH_SIZE', 20),
    deliveryMs: integer('OUTBOX_DELIVERY_TIMEOUT_MS', 10000),
    transactionMs: integer('OUTBOX_TRANSACTION_TIMEOUT_MS', 30000),
    probeMs: integer('OUTBOX_PROBE_TIMEOUT_MS', 1000),
    backoffMs: integer('OUTBOX_BACKOFF_MS', 1000),
    backoffMaxMs: integer('OUTBOX_BACKOFF_MAX_MS', 300000),
    alertAttempts: integer('OUTBOX_ALERT_ATTEMPTS', 10),
  };
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(c.topic) ||
    c.topic.length > 249 ||
    c.brokers.some((s) => !s)
  )
    throw new Error('Invalid outbox topic or brokers');
  if (c.transactionMs <= 2 * c.deliveryMs + 5000 || c.transactionMs > 30000)
    throw new Error(
      'Outbox transaction timeout must exceed 2 * delivery timeout + 5000ms and be <= 30000ms',
    );
  if (c.backoffMaxMs < c.backoffMs || c.replicationFactor > 32767)
    throw new Error('Invalid outbox backoff or replication factor');
  return c;
}
export const RELAY_CONFIG = Symbol('RELAY_CONFIG');
export const retryDelay = (attempts: number, c: RelayConfig): number =>
  Math.min(c.backoffMaxMs, c.backoffMs * 2 ** Math.min(attempts - 1, 30));
