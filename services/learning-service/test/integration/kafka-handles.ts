import { KafkaJS } from '@confluentinc/kafka-javascript';
import { readRelayConfig } from '../../src/modules/outbox/relay.config';
import { closeAll, deadline } from './deadlines';

/** Native connection attempts/retries can outlive the test's shutdown budget.
 * Bound that test boundary and dispose the real native handles.
 * No broker response is fabricated, and production methods remain unchanged. */
export function boundKafkaAdminConnections() {
  const prototype = KafkaJS.Kafka.prototype;
  const original = prototype.admin;
  const originalProducer = prototype.producer;
  const opened = new Set<{
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
  }>();
  const probeMs = readRelayConfig((key) => process.env[key]).probeMs;
  function bound<
    T extends { connect: () => Promise<void>; disconnect: () => Promise<void> },
  >(client: T, label: string): T {
    opened.add(client);
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
    return bound(originalProducer.apply(this, args), 'producer');
  };
  return async () => {
    try {
      await closeAll(...[...opened].map((admin) => () => admin.disconnect()));
    } finally {
      prototype.admin = original;
      prototype.producer = originalProducer;
    }
  };
}
