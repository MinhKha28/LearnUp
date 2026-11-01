/** What the relay that publishes the outbox events of assessment-service reads from the environment. */
export interface RelayConfig {
  /** Off unless OUTBOX_RELAY_ENABLED=true: the relay needs a reachable Kafka, and a local run without one has no use for it. */
  enabled: boolean;
  brokers: string[];
  topic: string;
  replicationFactor: number;
  pollMs: number;
  batchSize: number;
  /** How long Kafka may take to acknowledge a send before it counts as failed. */
  deliveryMs: number;
  /** The claim, the send and the update of one batch run in one transaction, so it must be bounded. */
  transactionMs: number;
  /** How long the check that Kafka is reachable may take (it runs before any row is locked). */
  probeMs: number;
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
    brokers: (get('KAFKA_BROKERS') ?? 'localhost:9092')
      .split(',')
      .map((broker) => broker.trim()),
    topic: get('OUTBOX_TOPIC') ?? 'learnup.assessment.learner-status-changed',
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
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(config.topic) ||
    config.topic.length > 249 ||
    config.brokers.some((broker) => !broker)
  )
    throw new Error('Invalid OUTBOX_TOPIC or KAFKA_BROKERS');
  // A batch that falls back to one send per row can hold the transaction for two deliveries; it must still fit.
  if (
    config.transactionMs <= 2 * config.deliveryMs + 5000 ||
    config.transactionMs > 30000
  )
    throw new Error(
      'OUTBOX_TRANSACTION_TIMEOUT_MS must exceed 2 * OUTBOX_DELIVERY_TIMEOUT_MS + 5000 and be at most 30000',
    );
  if (config.backoffMaxMs < config.backoffMs)
    throw new Error(
      'OUTBOX_BACKOFF_MAX_MS must not be below OUTBOX_BACKOFF_MS',
    );
  if (config.replicationFactor > 32767)
    throw new Error('Invalid OUTBOX_REPLICATION_FACTOR');
  if (config.batchSize > 1000) throw new Error('Invalid OUTBOX_BATCH_SIZE');
  return config;
}

/** Milliseconds to wait after the given number of failed attempts: doubles each time, up to a ceiling. */
export const retryDelay = (attempts: number, config: RelayConfig): number =>
  Math.min(
    config.backoffMaxMs,
    config.backoffMs * 2 ** Math.min(attempts - 1, 30),
  );
