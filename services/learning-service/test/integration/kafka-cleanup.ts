import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { readRelayConfig } from '../../src/modules/outbox/relay.config';
import {
  deadline,
  IO_TIMEOUT_MS,
  KAFKA_RECOVERY_TIMEOUT_MS,
  KAFKA_READY_POLL_MS,
} from './deadlines';

async function probeBroker(admin: KafkaJS.Admin): Promise<void> {
  const probeMs = readRelayConfig((key) => process.env[key]).probeMs;
  const end = Date.now() + KAFKA_RECOVERY_TIMEOUT_MS;
  while (Date.now() < end) {
    try {
      await admin.listTopics({ timeout: probeMs });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, KAFKA_READY_POLL_MS));
    }
  }
  throw new Error('Kafka broker did not recover before topic cleanup');
}

export function waitForBroker(admin: KafkaJS.Admin): Promise<void> {
  return deadline(
    probeBroker(admin),
    'Kafka broker readiness',
    KAFKA_RECOVERY_TIMEOUT_MS,
  );
}

export async function deleteTestTopic(
  admin: KafkaJS.Admin | undefined,
  topic: string,
): Promise<void> {
  if (!admin) return;
  await waitForBroker(admin);
  await deadline(
    admin.deleteTopics({ topics: [topic], timeout: IO_TIMEOUT_MS }),
    'Kafka deleteTopics',
  );
}
