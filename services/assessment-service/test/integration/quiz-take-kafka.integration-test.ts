/**
 * UC29.1 end to end through a real Kafka: the events of a Quiz (QUIZ_STARTED, QUIZ_SUBMITTED, also the one of an attempt
 * the job submits because the time ran out) are written with the change, published by the relay to the topic, keyed by
 * the Learner and in the order they happened.
 *
 * It runs only when KAFKA_TEST_BROKERS names a broker (for example `localhost:9092` with the Compose Kafka up).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  LEARNER,
  ORG,
  sleep,
  startCourseStub,
  startLearningStub,
  startService,
  type CourseStub,
  type LearningStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const BROKERS = process.env.KAFKA_TEST_BROKERS;
const as = identity({ user: LEARNER, role: 'LEARNER' });

interface Received {
  key: string;
  body: Record<string, any>;
}

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
    waitFor: async (count: number, ms = 60000) => {
      const end = Date.now() + ms;
      while (received.length < count && Date.now() < end) await sleep(100);
      return received.length;
    },
    stop: () => consumer.disconnect(),
  };
}

describe(
  'UC29.1 events through Kafka',
  { skip: BROKERS ? false : 'KAFKA_TEST_BROKERS is not set' },
  () => {
    let db: TestDatabase;
    let course: CourseStub;
    let learning: LearningStub;
    let service: RunningService;
    const topic = `learnup.test.quiz.${randomUUID()}`;

    before(async () => {
      db = await createTestDatabase();
      course = await startCourseStub();
      learning = await startLearningStub();
      service = await startService(db.url, {
        COURSE_SERVICE_URL: course.url,
        ENROLLMENT_CLIENT_MODE: 'http',
        LEARNING_SERVICE_URL: learning.url,
        PEER_REVIEW_TICK_MS: '3600000',
        QUIZ_SETTLE_TICK_MS: '300',
        OUTBOX_RELAY_ENABLED: 'true',
        KAFKA_BROKERS: BROKERS as string,
        OUTBOX_TOPIC: topic,
        OUTBOX_POLL_INTERVAL_MS: '300',
      });
    });
    after(async () => {
      await service?.stop();
      await course?.stop();
      await learning?.stop();
      await db?.drop();
    });

    test('start, submit, a second attempt that times out: four events, in order, keyed by the Learner, each once', async () => {
      const api = apiFor(service.baseUrl);
      const created = await api('POST', '/quizzes', {
        courseId: COURSE,
        title: 'Kafka quiz',
        timeLimitMinutes: 10,
        passingScore: 50,
        isRequired: true,
        maxConsecutiveAttempts: 3,
        lockoutHours: 1,
      });
      assert.equal(created.status, 201, JSON.stringify(created.json));
      const quizId = created.data.id as string;
      const questionId = '00000000-0000-4000-8000-000000009001';
      const rightOption = '00000000-0000-4000-8000-000000009002';
      await db.query(
        `INSERT INTO quiz_questions (id, organization_id, assessment_id, question_type, content, position, updated_at)
         VALUES ($1, $2, $3, 'SingleChoice', 'Q?', 1, now())`,
        [questionId, ORG, quizId],
      );
      for (const [i, id] of [
        rightOption,
        '00000000-0000-4000-8000-000000009003',
      ].entries()) {
        await db.query(
          `INSERT INTO quiz_question_options (id, organization_id, question_id, content, is_correct, position, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())`,
          [id, ORG, questionId, `Option ${i}`, i === 0, i + 1],
        );
      }
      let listener!: Awaited<ReturnType<typeof listen>>;
      try {
        const first = await api(
          'POST',
          `/learner/quizzes/${quizId}/attempts`,
          undefined,
          as,
        );
        assert.equal(first.status, 201, JSON.stringify(first.json));
        const saved = await api(
          'PUT',
          `/learner/quizzes/attempts/${first.data.attemptId}/answers/${questionId}`,
          { optionIds: [rightOption] },
          as,
        );
        assert.equal(saved.status, 200);
        const done = await api(
          'POST',
          `/learner/quizzes/attempts/${first.data.attemptId}/submit`,
          undefined,
          as,
        );
        assert.equal(done.data.score, 100);

        const second = await api(
          'POST',
          `/learner/quizzes/${quizId}/attempts`,
          undefined,
          as,
        );
        assert.equal(second.status, 201);
        // the time runs out; nobody reads the attempt again, the job submits it
        await db.query(
          `UPDATE quiz_attempts SET started_at = started_at - interval '11 minutes', deadline_at = deadline_at - interval '11 minutes' WHERE id = $1`,
          [second.data.attemptId],
        );

        // the relay creates the topic; the topic is read from its beginning once the rows are published
        const end = Date.now() + 60000;
        while (Date.now() < end) {
          const [{ count }] = await db.query(
            'SELECT count(*) AS count FROM outbox_events WHERE published_at IS NOT NULL',
          );
          if (Number(count) >= 4) break;
          await sleep(200);
        }
        listener = await listen(topic);
        assert.equal(
          await listener.waitFor(4),
          4,
          JSON.stringify(listener.received),
        );
        await sleep(1500);
        assert.equal(listener.received.length, 4, 'each event once');

        const payloads = listener.received.map((r) => r.body.data);
        assert.deepEqual(
          payloads.map((p) => [p.reason, p.status, p.attemptId]),
          [
            ['QUIZ_STARTED', 'Started', first.data.attemptId],
            ['QUIZ_SUBMITTED', 'Submitted', first.data.attemptId],
            ['QUIZ_STARTED', 'Started', second.data.attemptId],
            ['QUIZ_SUBMITTED', 'Submitted', second.data.attemptId],
          ],
        );
        assert.ok(
          listener.received.every((r) => r.key === LEARNER),
          'keyed by the Learner',
        );
        assert.deepEqual(
          payloads.map((p) => [p.score ?? null, p.submissionKind ?? null]),
          [
            [null, null],
            [100, 'Manual'],
            [null, null],
            [0, 'TimedOut'],
          ],
        );
        for (const p of payloads) {
          assert.equal(p.kind, 'QUIZ');
          assert.equal(p.assessmentId, quizId);
          assert.equal(p.learnerId, LEARNER);
          assert.equal(p.courseId, COURSE);
          assert.equal(p.organizationId, ORG);
          assert.match(String(p.revision), /\S/);
          assert.ok(
            p.firstActivityAt,
            'the first activity is the start of the first attempt',
          );
        }
        assert.equal(new Set(payloads.map((p) => p.firstActivityAt)).size, 1);
        const envelope = listener.received[0].body;
        assert.ok(
          envelope.occurredAt,
          'the envelope has occurredAt at its root',
        );
        assert.equal(
          (
            await db.query(
              `SELECT count(*) AS count FROM outbox_events WHERE published_at IS NULL`,
            )
          )[0].count,
          '0',
          'everything written was published',
        );
      } finally {
        await listener?.stop();
      }
    });
  },
);
