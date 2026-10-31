import type { RelayConfig } from './interfaces/relay-config.interface';

export const RELAY_CONFIG = Symbol('RELAY_CONFIG');

export function readRelayConfig(
  get: (key: string) => string | undefined,
): RelayConfig {
  const integer = (key: string, fallback: number): number => {
    const raw = get(key) ?? String(fallback);
    const value = Number(raw);

    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1) {
      throw new Error(`Invalid ${key}`);
    }

    return value;
  };

  const enabled = get('OUTBOX_RELAY_ENABLED') ?? 'false';

  if (enabled !== 'true' && enabled !== 'false') {
    throw new Error('Invalid OUTBOX_RELAY_ENABLED');
  }

  const config: RelayConfig = {
    enabled: enabled === 'true',
    brokers: (get('KAFKA_BROKERS') ?? 'localhost:9092')
      .split(',')
      .map((item) => item.trim()),
    topic: get('OUTBOX_TOPIC') ?? 'learnup.course.course-component-events',
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
  ) {
    throw new Error('Invalid Kafka topic or brokers');
  }

  if (
    config.transactionMs <= 2 * config.deliveryMs + 5000 ||
    config.transactionMs > 30000
  ) {
    throw new Error('Invalid outbox transaction timeout');
  }

  if (
    config.backoffMaxMs < config.backoffMs ||
    config.replicationFactor > 32767
  ) {
    throw new Error('Invalid outbox retry configuration');
  }

  return config;
}

export function retryDelay(attempts: number, config: RelayConfig): number {
  return Math.min(
    config.backoffMaxMs,
    config.backoffMs * 2 ** Math.min(Math.max(0, attempts - 1), 30),
  );
}
