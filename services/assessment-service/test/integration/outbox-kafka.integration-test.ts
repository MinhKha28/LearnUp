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
import { testTopics } from './test-topics';

const { createTestTopics, describeTestTopics, shape } = testTopics;

const BROKERS = process.env.KAFKA_TEST_BROKERS;
const RELAY_PUBLICATION_TIMEOUT_MS = 30000;
const RELAY_POLL_INTERVAL_MS = 200;

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

/** Poll relay readiness after the test harness has provisioned its topics. */
async function becomesReady(gate: KafkaOutboxGate, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if ((await gate.ready()).status === 'ready') return true;
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
      OUTBOX_PEER_REVIEW_TOPIC: `${name}.peer-review`,
      OUTBOX_SUBMISSION_FINALIZED_TOPIC: `${name}.finalized`,
      ...over,
    });
    const gateFor = async (name: string, over: Record<string, string> = {}) => {
      const config = relayConfig(settings(name, over));
      const kafka = new KafkaJS.Kafka({
        kafkaJS: { brokers: [BROKERS as string] },
      });
      const admin = kafka.admin();
      await admin.connect();
      try {
        await createTestTopics(admin, {
          'assessment-status': config.topic,
          'peer-review-assigned': config.peerReviewTopic,
          'submission-finalized': config.submissionFinalizedTopic,
        });
      } finally {
        await admin.disconnect();
      }
      const gate = new KafkaOutboxGate(config);
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

    /** Drive normal relay polls; a temporary readiness failure does not claim a row. */
    const publishRows = async (
      relays: ReturnType<typeof relayOver>[],
      ids: string[],
    ) => {
      const deadline = Date.now() + RELAY_PUBLICATION_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await Promise.all(relays.map((relay) => relay.tick()));
        const states = await Promise.all(ids.map(row));
        if (states.every((state) => state.published_at)) return;
        await sleep(RELAY_POLL_INTERVAL_MS);
      }
      assert.fail(
        'The real relay did not publish the expected rows within the deadline',
      );
    };

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
      const gate = await gateFor(name);
      assert.equal(await becomesReady(gate), true, 'the topic is created');
      const listener = await listen(name);
      try {
        const [id] = await addEvents(db, aggregate(1), undefined, 1, {
          learnerId: aggregate(1),
          reason: 'PEER_REVIEW_WAIVED',
          status: 'PeerReviewWaived',
        });
        await publishRows([relayOver(db, prismas, gate, settings(name))], [id]);
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

    test('SubmissionFinalized is provisioned with three partitions and published with the learner key', async () => {
      const name = topic();
      const gate = await gateFor(name);
      assert.equal(await becomesReady(gate), true);
      const listener = await listen(`${name}.finalized`);
      try {
        const id = randomUUID();
        const learnerId = aggregate(1);
        const payload = {
          learnerId,
          submissionId: aggregate(2),
          assessmentId: aggregate(3),
          assessmentTitle: 'Assignment',
          finalScore: '80.00',
          maxScore: '100.00',
          courseId: aggregate(4),
          finalizedAt: new Date().toISOString(),
        };
        await db.query(
          "INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, organization_id, payload, occurred_at, updated_at) VALUES ($1, 'Submission', $2, 'SubmissionFinalized', $3, $4::jsonb, now(), now())",
          [id, payload.submissionId, ORG, JSON.stringify(payload)],
        );
        await publishRows([relayOver(db, prismas, gate, settings(name))], [id]);
        assert.equal(await listener.waitFor(1), 1);
        assert.equal(listener.received[0].key, learnerId);
        assert.equal(listener.received[0].body.eventId, id);
        assert.deepEqual(listener.received[0].body.data, payload);
        assert.equal(
          listener.received[0].body.eventType,
          'SubmissionFinalized',
        );
        assert.ok((await row(id)).published_at);
        const kafka = new KafkaJS.Kafka({
          kafkaJS: { brokers: [BROKERS as string] },
        });
        const admin = kafka.admin();
        await admin.connect();
        try {
          const metadata = await describeTestTopics(admin, [
            `${name}.finalized`,
          ]);
          assert.equal(
            metadata[0].partitions.length,
            shape('submission-finalized').partitions,
          );
        } finally {
          await admin.disconnect();
        }
      } finally {
        await listener.stop();
      }
    });

    test('PeerReviewAssigned goes to its own topic, keyed by the reviewer, and never to the topic of the status events (BR-232)', async () => {
      const name = topic();
      const gate = await gateFor(name);
      assert.equal(
        await becomesReady(gate),
        true,
        'all relay topics are provisioned',
      );
      const statuses = await listen(name);
      const assigned = await listen(`${name}.peer-review`);
      try {
        const cycle = aggregate(7);
        const [status] = await addEvents(db, aggregate(1), undefined, 1, {
          learnerId: aggregate(1),
          status: 'Submitted',
        });
        const ids = [
          await addEvents(db, cycle, 'PeerReviewAssigned', 1, {
            learnerId: aggregate(2),
            cycleId: cycle,
            reviewCount: 2,
          }),
          await addEvents(db, cycle, 'PeerReviewAssigned', 1, {
            learnerId: aggregate(3),
            cycleId: cycle,
            reviewCount: 1,
          }),
        ].flat();
        // one batch holds all three events: each goes to the topic of its kind
        await publishRows(
          [relayOver(db, prismas, gate, settings(name))],
          [status, ...ids],
        );
        assert.equal(await assigned.waitFor(2), 2);
        assert.equal(await statuses.waitFor(1), 1);
        await sleep(500);
        assert.equal(assigned.received.length, 2, 'two notices, nothing else');
        assert.equal(statuses.received.length, 1, 'the status event alone');
        assert.equal(statuses.received[0].body.eventId, status);
        assert.deepEqual(
          assigned.received.map((m) => m.key).sort(),
          [aggregate(2), aggregate(3)].sort(),
          'the key is the reviewer',
        );
        for (const message of assigned.received) {
          assert.equal(message.body.eventType, 'PeerReviewAssigned');
          assert.equal(message.body.version, 1);
          assert.equal(message.body.producer, 'assessment-service');
          assert.equal(message.body.organizationId, ORG);
          assert.equal(message.body.data.cycleId, cycle);
          assert.equal(message.body.data.learnerId, message.key);
        }
        assert.deepEqual(
          assigned.received.map((m) => m.body.eventId).sort(),
          [...ids].sort(),
        );
        for (const id of [status, ...ids])
          assert.ok(
            (await row(id)).published_at,
            'and every row is marked sent',
          );
      } finally {
        await Promise.all([statuses.stop(), assigned.stop()]);
      }
    });

    test('two relays deliver every event once, and the events of a Learner in the order they were written', async () => {
      const name = topic();
      const first = await gateFor(name);
      const second = await gateFor(name);
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
        await publishRows([relayA, relayB], [...ids.values()].flat());
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
      const gate = await gateFor(name);
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
        await publishRows(
          [relayOver(db, prismas, gate, settings(name))],
          [good],
        );
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
        // The harness provisions every configured topic before the consumer or relay starts.
        const gate = await gateFor(name);
        assert.equal(await becomesReady(gate), true);
        return listen(name);
      })();
      const service = await startService(db.url, {
        ...settings(name),
        OUTBOX_RELAY_ENABLED: 'true',
        OUTBOX_POLL_INTERVAL_MS: '200',
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
