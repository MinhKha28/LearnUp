import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AssessmentStatusRepository } from '../../src/modules/assessment-status/assessment-status.repository';
import { AssessmentStatusConsumer } from '../../src/modules/assessment-status/assessment-status.consumer';
import { readAssessmentStatusConfig } from '../../src/modules/assessment-status/assessment-status.config';
import {
  decodeAssessment,
  type AssessmentDelivery,
} from '../../src/modules/assessment-status/assessment-status.event';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

function event(status = 'Submitted') {
  const organizationId = randomUUID();
  return {
    eventId: randomUUID(),
    eventType: 'LearnerAssessmentStatusChanged',
    version: 1,
    occurredAt: '2026-10-30T09:00:00.000Z',
    organizationId,
    producer: 'assessment-service',
    data: {
      organizationId,
      assessmentId: randomUUID(),
      learnerId: randomUUID(),
      courseId: randomUUID(),
      kind: 'ASSIGNMENT',
      status,
      revision: 'unordered-hash',
      firstActivityAt: '2026-10-29T08:00:00.000Z' as string | null | undefined,
    },
  };
}
function delivery(value: unknown): AssessmentDelivery {
  return {
    topic: 'assessment-test',
    partition: 1,
    offset: '9007199254740993',
    value: Buffer.from(JSON.stringify(value)),
  };
}
function harness(found = true) {
  const trace: string[] = [],
    activity: Date[] = [];
  let fail = false;
  const tx = {
    $queryRaw: async () => {
      trace.push('lookup');
      return found ? [{ id: randomUUID() }] : [];
    },
    $executeRaw: async (
      sql: { sql?: string; values?: unknown[] } | TemplateStringsArray,
    ) => {
      if ('sql' in sql && sql.sql?.includes('UPDATE enrollments')) {
        trace.push('activate');
        activity.push(sql.values!.find((v) => v instanceof Date) as Date);
      } else
        trace.push(
          String(sql).includes('INSERT INTO assessment_event_quarantine')
            ? 'quarantine'
            : 'queue',
        );
      if (fail) throw new Error('synthetic database failure');
      return 1;
    },
  };
  const db = {
    $transaction: async (work: (t: typeof tx) => Promise<unknown>) => {
      trace.push('begin');
      const result = await work(tx);
      trace.push('db-commit');
      return result;
    },
  } as unknown as PrismaService;
  const repository = new AssessmentStatusRepository(db);
  const consumer = new AssessmentStatusConsumer(
    repository,
    readAssessmentStatusConfig(() => undefined),
  );
  const commit = async (offsets: { offset: string }[]) => {
    assert.equal(trace.at(-1), 'db-commit');
    assert.equal(offsets[0].offset, '9007199254740994');
    trace.push('offset-commit');
  };
  return {
    trace,
    activity,
    consumer,
    commit,
    fail: () => {
      fail = true;
    },
  };
}
for (const status of [
  'Submitted',
  'Resubmitted',
  'PeerReviewWaived',
  'PeerReviewCompleted',
])
  test(`assessment ${status}: activation policy, one queue write, DB before offset`, async () => {
    const h = harness();
    await h.consumer.handle(delivery(event(status)), h.commit);
    assert.equal(
      h.trace.filter((s) => s === 'activate').length,
      ['Submitted', 'Resubmitted'].includes(status) ? 1 : 0,
    );
    assert.equal(h.trace.filter((s) => s === 'queue').length, 1);
    if (h.activity.length)
      assert.equal(h.activity[0].toISOString(), '2026-10-29T08:00:00.000Z');
  });
for (const value of [undefined, null])
  test(`assessment absent/null activity (${value}) falls back to envelope`, async () => {
    const h = harness(),
      e = event();
    e.data.firstActivityAt = value;
    await h.consumer.handle(delivery(e), h.commit);
    assert.equal(h.activity[0].toISOString(), e.occurredAt);
  });
test('assessment duplicate signals each request evaluation without revision ordering', async () => {
  const h = harness(),
    d = delivery(event());
  await h.consumer.handle(d, h.commit);
  await h.consumer.handle(d, h.commit);
  assert.equal(h.trace.filter((s) => s === 'queue').length, 2);
  assert.equal(h.activity[0].getTime(), h.activity[1].getTime());
});
for (const mode of [
  'missing-enrollment',
  'missing-course',
  'invalid-payload',
  'invalid-envelope',
  'invalid-json',
  'tombstone',
])
  test(`assessment ${mode} quarantines before committing`, async () => {
    const h = harness(mode !== 'missing-enrollment'),
      e = event();
    if (mode === 'missing-course')
      delete (e.data as Partial<typeof e.data>).courseId;
    if (mode === 'invalid-payload')
      (e.data as { learnerId: string }).learnerId = 'bad';
    if (mode === 'invalid-envelope') e.version = 2;
    const d = delivery(e);
    if (mode === 'invalid-json') d.value = Buffer.from('{');
    if (mode === 'tombstone') d.value = null;
    await h.consumer.handle(d, h.commit);
    assert.ok(h.trace.includes('quarantine'));
    assert.ok(!h.trace.includes('queue'));
    assert.equal(h.trace.at(-1), 'offset-commit');
  });
for (const valid of [true, false])
  test(`assessment transaction failure (${valid}) never commits offset`, async () => {
    const h = harness();
    h.fail();
    await assert.rejects(
      h.consumer.handle(delivery(valid ? event() : {}), h.commit),
    );
    assert.ok(!h.trace.includes('db-commit'));
    assert.ok(!h.trace.includes('offset-commit'));
  });
test('assessment decoder rejects organization mismatch and malformed activity', () => {
  const e = event();
  e.data.organizationId = randomUUID();
  assert.equal(decodeAssessment(delivery(e)).reason, 'INVALID_PAYLOAD');
  e.data.organizationId = e.organizationId;
  e.data.firstActivityAt = 'yesterday';
  assert.equal(decodeAssessment(delivery(e)).reason, 'INVALID_PAYLOAD');
});
for (const timestamp of [
  '0000-01-01T00:00:00Z',
  '2026-02-30T12:00:00Z',
  '2026-10-29T24:00:00Z',
])
  test(`assessment rejects impossible timestamp ${timestamp}`, () => {
    const e = event();
    e.data.firstActivityAt = timestamp;
    assert.equal(decodeAssessment(delivery(e)).reason, 'INVALID_PAYLOAD');
  });
test('assessment config defaults and invalid flag', () => {
  const c = readAssessmentStatusConfig(() => undefined);
  assert.equal(c.groupId, 'learning-assessment-status-v1');
  assert.equal(c.enabled, false);
  assert.equal(c.topic, 'learnup.assessment.learner-assessment-events');
  assert.throws(() =>
    readAssessmentStatusConfig((k) =>
      k === 'ASSESSMENT_CONSUMER_ENABLED' ? 'yes' : undefined,
    ),
  );
});
test('assessment quarantine logs one line with delivery coordinates and no payload', async () => {
  const warnings: unknown[] = [];
  const spy = mock.method(Logger.prototype, 'warn', (value: unknown) => {
    warnings.push(value);
  });
  try {
    const h = harness();
    await h.consumer.handle(delivery({ secret: 'must-not-log' }), h.commit);
    assert.equal(warnings.length, 1);
    assert.equal(typeof warnings[0], 'string');
    const line = warnings[0] as string;
    assert.ok(!line.includes('\n'));
    assert.ok(!line.includes('must-not-log'));
    assert.deepEqual(JSON.parse(line), {
      code: 'INVALID_ENVELOPE',
      topic: 'assessment-test',
      partition: 1,
      offset: '9007199254740993',
    });
  } finally {
    spy.mock.restore();
  }
});
test('assessment disabled consumer does not load native Kafka client', async () => {
  const h = harness();
  let loads = 0;
  (h.consumer as unknown as { loadKafka: () => Promise<never> }).loadKafka =
    async () => {
      loads++;
      throw new Error();
    };
  h.consumer.onModuleInit();
  await h.consumer.onModuleDestroy();
  assert.equal(loads, 0);
});
test('assessment broker/topic startup failure is nonblocking and retryable', async () => {
  const config = readAssessmentStatusConfig((k) =>
    k === 'ASSESSMENT_CONSUMER_ENABLED' ? 'true' : undefined,
  );
  const c = new AssessmentStatusConsumer(
    {} as AssessmentStatusRepository,
    config,
  );
  let loads = 0,
    connected = false,
    disconnected = 0;
  const fake = {
    connect: async () => {},
    disconnect: async () => {
      disconnected++;
    },
    subscribe: async () => {
      if (!connected) throw new Error('missing topic');
    },
    run: async () => {},
  };
  (c as unknown as { loadKafka: () => Promise<unknown> }).loadKafka =
    async () => {
      loads++;
      if (loads === 1) throw new Error('broker down');
      return {
        KafkaJS: {
          Kafka: class {
            consumer(options: {
              kafkaJS: { autoCommit: boolean; allowAutoTopicCreation: boolean };
            }) {
              assert.equal(options.kafkaJS.autoCommit, false);
              assert.equal(options.kafkaJS.allowAutoTopicCreation, false);
              return fake;
            }
          },
          logLevel: { NOTHING: 0 },
        },
      };
    };
  c.onModuleInit();
  const internal = c as unknown as {
    connecting?: Promise<void>;
    connect: () => void;
  };
  await internal.connecting;
  internal.connect();
  await internal.connecting;
  connected = true;
  internal.connect();
  await internal.connecting;
  assert.equal(loads, 3);
  await c.onModuleDestroy();
  assert.equal(disconnected, 2);
});
