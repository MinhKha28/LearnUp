import assert from 'node:assert/strict';
import { writeSync } from 'node:fs';
import { createServer } from 'node:net';
import { mock } from 'node:test';
import { KafkaJS, Producer } from '@confluentinc/kafka-javascript';
import { NestFactory } from '@nestjs/core';
import type { Prisma } from '../../../generated/prisma/client';
import { readRelayConfig } from '../../../src/modules/outbox/relay.config';
import { RelayProducer } from '../../../src/modules/outbox/relay.producer';
import type {
  OutboxRow,
  RelayRepository,
} from '../../../src/modules/outbox/relay.repository';
import { RelayService } from '../../../src/modules/outbox/relay.service';

async function main(): Promise<void> {
  const scenario = process.argv[2];
  assert.ok(scenario === 'startup' || scenario === 'drain');
  const events: string[] = [];
  const config = { ...readRelayConfig(() => undefined), enabled: true };
  const signal = () => process.kill(process.pid, 'SIGTERM');
  const disconnect = () => events.push('producer disconnected');
  let releaseSend: (() => void) | undefined;
  let stopBroker: (() => void) | undefined;
  if (scenario === 'startup') {
    const broker = createServer((socket) => socket.destroy());
    await new Promise<void>((resolve, reject) => {
      broker.once('error', reject);
      broker.listen(0, '127.0.0.1', resolve);
    });
    const address = broker.address();
    assert.ok(address && typeof address !== 'string');
    config.brokers = [`127.0.0.1:${address.port}`];
    stopBroker = () => broker.close();
    let attempts = 0;
    const nativeConnect = Producer.prototype.connect;
    mock.method(
      Producer.prototype,
      'connect',
      function (this: Producer, ...args: Parameters<typeof nativeConnect>) {
        events.push(`connect attempt ${++attempts}`);
        const result = nativeConnect.apply(this, args);
        if (attempts === 2) signal();
        return result;
      },
    );
    const makeProducer = KafkaJS.Kafka.prototype.producer;
    mock.method(
      KafkaJS.Kafka.prototype,
      'producer',
      function (this: KafkaJS.Kafka, ...args: Parameters<typeof makeProducer>) {
        const producer = makeProducer.apply(this, args);
        const close = producer.disconnect.bind(producer);
        mock.method(producer, 'disconnect', async () => {
          await close();
          disconnect();
        });
        mock.method(producer, 'dependentAdmin', () => {
          events.push('unexpected admin');
          throw new Error('unexpected admin');
        });
        return producer;
      },
    );
  } else {
    mock.method(KafkaJS.Kafka.prototype, 'producer', () => ({
      connect: async () => {},
      dependentAdmin: () => ({
        connect: async () => {},
        listTopics: async () => [],
        createTopics: async () => true,
      }),
      send: async () => {
        events.push('send pending');
        await new Promise<void>((resolve) => {
          releaseSend = resolve;
          signal();
        });
        events.push('send acknowledged');
      },
      disconnect: async () => {
        disconnect();
      },
    }));
  }
  const row: OutboxRow = {
    id: 'envelope',
    aggregate_id: 'enrollment',
    organization_id: 'organization',
    event_type: 'EnrollmentAssigned',
    payload: { enrollmentId: 'enrollment' },
    occurred_at: new Date(0),
    attempts: 0,
  };
  const repository = {
    transaction: async (
      work: (tx: Prisma.TransactionClient, rows: OutboxRow[]) => Promise<void>,
    ) => {
      events.push('transaction started');
      await work({} as Prisma.TransactionClient, [row]);
      events.push('transaction committed');
    },
    published: async () => {
      events.push('row published');
    },
    failed: async () => {
      events.push('unexpected publication failure');
    },
  };
  const relay = new RelayService(
    repository as unknown as RelayRepository,
    new RelayProducer(config),
    config,
  );
  const shutdown = relay.beforeApplicationShutdown.bind(relay);
  mock.method(relay, 'beforeApplicationShutdown', async () => {
    events.push('shutdown started');
    const closing = shutdown();
    setImmediate(() => releaseSend?.());
    await closing;
  });
  const app = await NestFactory.createApplicationContext(
    {
      module: class ShutdownFixture {},
      providers: [
        { provide: RelayService, useValue: relay },
        {
          provide: 'SHUTDOWN_RESULT',
          useValue: {
            onApplicationShutdown(signal: string) {
              stopBroker?.();
              events.push(`shutdown finished ${signal}`);
              writeSync(1, JSON.stringify(events));
            },
          },
        },
      ],
    },
    { logger: false },
  );
  app.enableShutdownHooks(['SIGTERM']);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
