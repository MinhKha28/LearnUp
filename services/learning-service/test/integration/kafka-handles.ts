import { KafkaJS } from '@confluentinc/kafka-javascript';
import { readRelayConfig } from '../../src/modules/outbox/relay.config';
import { deadline } from './deadlines';
import { cleanupAll } from './cleanup';

/** Native connection attempts/retries can outlive the test's shutdown budget.
 * Bound that test boundary and dispose the real native handles.
 * No broker response is fabricated, and production methods remain unchanged. */
export function boundKafkaAdminConnections() {
  const prototype = KafkaJS.Kafka.prototype;
  const original = prototype.admin;
  const originalProducer = prototype.producer;
  // Restore the exact factory later; the wrapper invokes it with apply(this).
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalConsumer = prototype.consumer;
  const opened = new Set<{
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
  }>();
  function rememberDependents<
    T extends { dependentAdmin: () => KafkaJS.Admin },
  >(client: T): T {
    const dependentAdmin = client.dependentAdmin.bind(client);
    client.dependentAdmin = () => {
      const admin = dependentAdmin();
      opened.add(admin);
      return admin;
    };
    return client;
  }
  const probeMs = readRelayConfig((key) => process.env[key]).probeMs;
  const nativeProducerConnect =
    process.env.OUTBOX_INTEGRATION === 'true' &&
    process.env.OUTBOX_KAFKA_CHAOS === 'true';
  function bound<
    T extends { connect: () => Promise<void>; disconnect: () => Promise<void> },
  >(client: T, label: string, limitConnect = true): T {
    opened.add(client);
    if (!limitConnect) return client;
    const connect = client.connect.bind(client);
    const disconnect = client.disconnect.bind(client);
    client.connect = async () => {
      try {
        await deadline(connect(), `Kafka ${label} connect`, probeMs);
      } catch (error) {
        await deadline(
          disconnect(),
          `Kafka ${label} disconnect after failed connect`,
        );
        throw error;
      }
    };
    return client;
  }
  prototype.admin = function (...args: Parameters<typeof original>) {
    return bound(original.apply(this, args), 'admin');
  };
  prototype.producer = function (...args: Parameters<typeof originalProducer>) {
    return rememberDependents(
      bound(
        originalProducer.apply(this, args),
        'producer',
        !nativeProducerConnect,
      ),
    );
  };
  prototype.consumer = function (...args: Parameters<typeof originalConsumer>) {
    const consumer = originalConsumer.apply(this, args);
    opened.add(consumer);
    return rememberDependents(consumer);
  };
  return async () => {
    try {
      await cleanupAll(
        [...opened].reverse().map((client, index) => ({
          name: `native Kafka client ${index + 1}`,
          run: () => client.disconnect(),
        })),
      );
    } finally {
      prototype.admin = original;
      prototype.producer = originalProducer;
      prototype.consumer = originalConsumer;
    }
  };
}
