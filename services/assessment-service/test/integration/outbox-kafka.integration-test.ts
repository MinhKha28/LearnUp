/**
 * Step 23 of the plan with a real Kafka and a real Postgres: what the relay publishes is the envelope every LearnUP event
 * has, keyed by the Learner; two relays deliver every event once and in order; a Kafka that cannot be reached is noticed
 * before any row is locked; one row that cannot be a message does not hold back the others.
 *
 * It runs only when KAFKA_TEST_BROKERS names a broker (for example `localhost:9092` with the Compose Kafka up): the other
 * integration tests need only Postgres.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { KafkaOutboxGate } from '../../src/modules/outbox/relay.kafka-gate';
import {
  createTestDatabase,
  ORG,
  sleep,
  startService,
  type TestDatabase,
} from './harness';
import { addEvents, aggregate, relayConfig, relayOver } from './outbox-helpers';

const BROKERS = process.env.KAFKA_TEST_BROKERS;

interface Received {
  key: string;
  body: Record<string, any>;
}

/** Reads a topic from the beginning into a list until `stop()` is called. */
async function listen(topic: string) {
  const kafka = new KafkaJS.Kafka({
    kafkaJS: {
      brokers: [BROKERS as string],
      logLevel: KafkaJS.logLevel.NOTHING,
    },
  });
  const consumer = kafka.consumer({
    kafkaJS: { groupId: `test-${randomUUID()}`, fromBeginning: true },
  });
  const received: Received[] = [];
  await consumer.connect();
  await consumer.subscribe({ topic });
  await consumer.run({
    eachMessage: ({ message }) => {
      received.push({
        key: message.key?.toString() ?? '',
        body: JSON.parse(message.value?.toString() ?? '{}') as Record<
          string,
          any
        >,
      });
      return Promise.resolve();
    },
  });
  return {
    received,
    waitFor: async (count: number, ms = 30000) => {
      const end = Date.now() + ms;
      while (received.length < count && Date.now() < end) await sleep(100);
      return received.length;
    },
    stop: () => consumer.disconnect(),
  };
}

/** The first probe of a new topic can fail while the broker is still creating it; the relay simply asks again a second later. */
async function becomesReady(gate: KafkaOutboxGate, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await gate.ready()) return true;
    await sleep(500);
  }
  return false;
}

describe(
  'the relay with Kafka',
  { skip: BROKERS ? false : 'KAFKA_TEST_BROKERS is not set' },
  () => {
    let db: TestDatabase;
    const prismas: PrismaService[] = [];
    const gates: KafkaOutboxGate[] = [];
    const topic = () => `learnup.test.assessment.${randomUUID()}`;
    const settings = (name: string, over: Record<string, string> = {}) => ({
      KAFKA_BROKERS: BROKERS as string,
      OUTBOX_TOPIC: name,
      ...over,
    });
    const gateFor = (name: string, over: Record<string, string> = {}) => {
      const gate = new KafkaOutboxGate(relayConfig(settings(name, over)));
      gates.push(gate);
      return gate;
    };
    const row = async (id: string) =>
      (
        await db.query(
          'SELECT published_at, attempts, last_error FROM outbox_events WHERE id = $1',
          [id],
        )
      )[0];

    before(async () => {
      db = await createTestDatabase();
    });
    // every test starts with an empty outbox: what an earlier test left unsent would be sent into the topic of this one
    beforeEach(() => db.query('DELETE FROM outbox_events'));
    after(async () => {
      await Promise.all(gates.map((gate) => gate.close()));
      await Promise.all(prismas.map((prisma) => prisma.$disconnect()));
      await db?.drop();
    });

    test('an event reaches the topic as the envelope, keyed by the Learner', async () => {
      const name = topic();
      const gate = gateFor(name);
      assert.equal(await becomesReady(gate), true, 'the topic is created');
      const listener = await listen(name);
      try {
        const [id] = await addEvents(db, aggregate(1), undefined, 1, {
          learnerId: aggregate(1),
          reason: 'PEER_REVIEW_WAIVED',
          status: 'PeerReviewWaived',
        });
        await relayOver(db, prismas, gate, settings(name)).tick();
        assert.equal(await listener.waitFor(1), 1);
        const [message] = listener.received;
        assert.equal(message.key, aggregate(1), 'the key is the Learner');
        assert.equal(message.body.eventId, id);
        assert.equal(message.body.eventType, 'LearnerAssessmentStatusChanged');
        assert.equal(message.body.version, 1);
        assert.equal(message.body.producer, 'assessment-service');
        assert.equal(message.body.organizationId, ORG);
        assert.ok(Number.isFinite(Date.parse(message.body.occurredAt)));
        assert.equal(message.body.data.reason, 'PEER_REVIEW_WAIVED');
        assert.equal(message.body.data.learnerId, aggregate(1));
        assert.ok((await row(id)).published_at, 'and the row is marked sent');
      } finally {
        await listener.stop();
      }
    });

    test('two relays deliver every event once, and the events of a Learner in the order they were written', async () => {
      const name = topic();
      const first = gateFor(name);
      const second = gateFor(name);
      assert.equal(await becomesReady(first), true);
      const listener = await listen(name);
      try {
        const ids = new Map<number, string[]>();
        for (let i = 0; i < 20; i += 1)
          ids.set(i, await addEvents(db, aggregate(100 + i), undefined, 3));
        const relayA = relayOver(
          db,
          prismas,
          first,
          settings(name, { OUTBOX_BATCH_SIZE: '8' }),
        );
        const relayB = relayOver(
          db,
          prismas,
          second,
          settings(name, { OUTBOX_BATCH_SIZE: '8' }),
        );
        for (let round = 0; round < 12; round += 1)
          await Promise.all([relayA.tick(), relayB.tick()]);
        assert.equal(await listener.waitFor(60), 60, 'all 60 arrived');
        const eventIds = listener.received.map((m) => m.body.eventId);
        assert.equal(new Set(eventIds).size, 60, 'each once');
        for (const [i, written] of ids) {
          const order = listener.received
            .filter((m) => m.key === aggregate(100 + i))
            .map((m) => m.body.eventId);
          assert.deepEqual(order, written, `Learner ${i} in order`);
        }
      } finally {
        await listener.stop();
      }
    });

    test('a Kafka that cannot be reached is noticed before any row is locked', async () => {
      const gate = new KafkaOutboxGate(
        relayConfig({
          KAFKA_BROKERS: '127.0.0.1:9',
          OUTBOX_TOPIC: topic(),
        }),
      );
      gates.push(gate);
      const [id] = await addEvents(db, aggregate(200));
      const started = Date.now();
      await relayOver(db, prismas, gate).tick();
      assert.ok(Date.now() - started < 13000, 'the probe is bounded');
      const state = await row(id);
      assert.equal(state.published_at, null);
      assert.equal(
        state.attempts,
        0,
        'no row was claimed, so no attempt was spent',
      );
    });

    test('a row that cannot be a message fails alone, with its code, and the others go out', async () => {
      const name = topic();
      const gate = gateFor(name);
      assert.equal(await becomesReady(gate), true);
      const listener = await listen(name);
      try {
        // no learnerId: it has no key and cannot be sent, whatever the broker does
        const [bad] = await addEvents(db, aggregate(300), undefined, 1, {
          kind: 'ASSIGNMENT',
        });
        await db.query(
          'UPDATE outbox_events SET payload = \'{"kind": "ASSIGNMENT"}\'::jsonb WHERE id = $1',
          [bad],
        );
        const [good] = await addEvents(db, aggregate(301));
        await relayOver(db, prismas, gate, settings(name)).tick();
        assert.equal(await listener.waitFor(1), 1);
        assert.equal(listener.received[0].body.eventId, good);
        assert.ok((await row(good)).published_at);
        const failed = await row(bad);
        assert.equal(failed.published_at, null);
        assert.equal(failed.attempts, 1);
        assert.equal(failed.last_error, 'OUTBOX_SERIALIZATION');
      } finally {
        await listener.stop();
      }
    });

    test('the running service with the relay on sends an event written to its outbox, by itself', async () => {
      const name = topic();
      const listener = await (async () => {
        // the topic must exist before it is read; the gate of a helper creates it
        const gate = gateFor(name);
        assert.equal(await becomesReady(gate), true);
        return listen(name);
      })();
      const service = await startService(db.url, {
        OUTBOX_RELAY_ENABLED: 'true',
        OUTBOX_POLL_INTERVAL_MS: '200',
        KAFKA_BROKERS: BROKERS as string,
        OUTBOX_TOPIC: name,
      });
      try {
        const [id] = await addEvents(db, aggregate(400));
        assert.equal(await listener.waitFor(1), 1, 'the service published it');
        assert.equal(listener.received[0].body.eventId, id);
        for (let i = 0; i < 40 && !(await row(id)).published_at; i += 1)
          await sleep(100);
        assert.ok((await row(id)).published_at);
      } finally {
        await service.stop();
        await listener.stop();
      }
    });
  },
);
