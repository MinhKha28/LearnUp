/** Step 23 of the plan: the message of an event, and what each Kafka failure is called and how the relay treats it. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { KafkaJS, CODES } from '@confluentinc/kafka-javascript';
import { readRelayConfig } from '../../src/modules/outbox/relay.config';
import { GateFailure } from '../../src/modules/outbox/relay.gate';
import {
  classifyError,
  KafkaOutboxGate,
  readinessFailure,
  message,
} from '../../src/modules/outbox/relay.kafka-gate';
import type {
  RelayRow,
  RelayRepository,
} from '../../src/modules/outbox/relay.repository';
import { RelayService } from '../../src/modules/outbox/relay.service';

const row = (over: Partial<RelayRow> = {}): RelayRow => ({
  id: '00000000-0000-4000-8000-0000000000e1',
  aggregate_id: '00000000-0000-4000-8000-0000000000e2',
  event_type: 'LearnerAssessmentStatusChanged',
  organization_id: '00000000-0000-4000-8000-0000000000e3',
  payload: {
    learnerId: '00000000-0000-4000-8000-0000000000e4',
    reason: 'ASSIGNMENT_SUBMITTED',
  },
  occurred_at: new Date('2026-11-02T03:00:00.000Z'),
  attempts: 0,
  ...over,
});

describe('the message of an event', () => {
  test('is the envelope of every LearnUP event, keyed by the Learner', () => {
    const built = message(row());
    assert.equal(built.key, '00000000-0000-4000-8000-0000000000e4');
    assert.deepEqual(JSON.parse(built.value), {
      eventId: '00000000-0000-4000-8000-0000000000e1',
      eventType: 'LearnerAssessmentStatusChanged',
      version: 1,
      occurredAt: '2026-11-02T03:00:00.000Z',
      organizationId: '00000000-0000-4000-8000-0000000000e3',
      producer: 'assessment-service',
      data: {
        learnerId: '00000000-0000-4000-8000-0000000000e4',
        reason: 'ASSIGNMENT_SUBMITTED',
      },
    });
  });

  test('is the same each time for the same row, so a repeated send is the same event', () => {
    assert.equal(message(row()).value, message(row()).value);
  });

  for (const [name, over] of [
    ['an event without an organization', { organization_id: null }],
    ['a payload that is not an object', { payload: [] as never }],
    ['a payload without the Learner', { payload: { kind: 'ASSIGNMENT' } }],
    ['a Learner that is not text', { payload: { learnerId: 5 } }],
  ] as [string, Partial<RelayRow>][]) {
    test(`refuses ${name} as a failure of that row only`, () => {
      assert.throws(
        () => message(row(over)),
        (error: unknown) =>
          error instanceof GateFailure &&
          error.code === 'OUTBOX_SERIALIZATION' &&
          error.individual,
      );
    });
  }
});

describe('the message of PeerReviewAssigned', () => {
  const reviewer = '00000000-0000-4000-8000-0000000000f1';
  const assigned = row({
    event_type: 'PeerReviewAssigned',
    payload: {
      learnerId: reviewer,
      assessmentId: '00000000-0000-4000-8000-0000000000f2',
      cycleId: '00000000-0000-4000-8000-0000000000f3',
      assignmentTitle: 'Bài tập an toàn',
      reviewCount: 2,
      reviewDueAt: '2026-11-10T17:00:00.000Z',
    },
  });

  test('is the same envelope, keyed by the reviewer, with the data as the payload', () => {
    const built = message(assigned);
    assert.equal(built.key, reviewer);
    const envelope = JSON.parse(built.value);
    assert.equal(envelope.eventType, 'PeerReviewAssigned');
    assert.equal(envelope.version, 1);
    assert.equal(envelope.producer, 'assessment-service');
    assert.equal(
      envelope.organizationId,
      '00000000-0000-4000-8000-0000000000e3',
    );
    assert.equal(envelope.data.reviewCount, 2);
    assert.equal(envelope.data.assignmentTitle, 'Bài tập an toàn');
  });
});

describe('classifyError', () => {
  const errors = CODES.ERRORS;

  test('a failure that is about the message is individual and keeps its number', () => {
    for (const code of [
      errors.ERR_MSG_SIZE_TOO_LARGE,
      errors.ERR_INVALID_MSG,
      errors.ERR__KEY_SERIALIZATION,
    ]) {
      const failure = classifyError({ code });
      assert.equal(failure.individual, true, String(code));
      assert.equal(failure.code, `KAFKA_${code}`);
    }
  });

  test('a failure of the broker or the network is the same for every row: not individual', () => {
    for (const code of [-195, -193, -192, -187, -185, 7]) {
      const failure = classifyError({ code });
      assert.equal(failure.individual, false, String(code));
      assert.equal(failure.code, `KAFKA_${code}`);
    }
  });

  test('anything else has a fixed code and never carries the text of the error', () => {
    const failure = classifyError(new Error('broker at 10.0.0.5 said secret'));
    assert.equal(failure.code, 'OUTBOX_UNKNOWN');
    assert.equal(failure.individual, false);
    assert.doesNotMatch(failure.message, /secret|10\.0\.0\.5/);
  });

  test('a failure already named passes through as it is', () => {
    const named = new GateFailure('OUTBOX_SERIALIZATION', true);
    assert.equal(classifyError(named), named);
  });
});

describe('the Kafka settings of the relay', () => {
  const read = (env: Record<string, string> = {}) =>
    readRelayConfig((key) => env[key]);

  test('default to the topic of this service, one local broker, one replica', () => {
    const config = read();
    assert.equal(config.topic, 'learnup.assessment.learner-assessment-events');
    assert.deepEqual(config.brokers, ['localhost:9092']);
    assert.equal(config.replicationFactor, 1);
    assert.equal(config.deliveryMs, 10000);
    assert.equal(config.probeMs, 1000);
  });

  test('take a list of brokers', () => {
    assert.deepEqual(read({ KAFKA_BROKERS: 'a:1, b:2' }).brokers, [
      'a:1',
      'b:2',
    ]);
    assert.throws(() => read({ KAFKA_BROKERS: 'a:1,,b:2' }), /KAFKA_BROKERS/);
  });

  for (const topic of ['', 'has space', '-start', 'a/b', 'x'.repeat(250)]) {
    test(`refuse the topic ${JSON.stringify(topic.slice(0, 20))}`, () => {
      assert.throws(() => read({ OUTBOX_TOPIC: topic }), /OUTBOX_TOPIC/);
    });
  }

  test('keep the transaction longer than two deliveries plus five seconds, and at most 30 s', () => {
    assert.throws(
      () =>
        read({
          OUTBOX_DELIVERY_TIMEOUT_MS: '15000',
          OUTBOX_TRANSACTION_TIMEOUT_MS: '30000',
        }),
      /OUTBOX_TRANSACTION_TIMEOUT_MS/,
    );
    assert.throws(
      () => read({ OUTBOX_TRANSACTION_TIMEOUT_MS: '40000' }),
      /OUTBOX_TRANSACTION_TIMEOUT_MS/,
    );
    assert.equal(
      read({
        OUTBOX_DELIVERY_TIMEOUT_MS: '5000',
        OUTBOX_TRANSACTION_TIMEOUT_MS: '20000',
      }).deliveryMs,
      5000,
    );
  });
});

test('missing numeric classification and mixed readiness failures retain broker severity', () => {
  for (const code of [3, -188]) {
    assert.equal(classifyError({ code }).code, 'OUTBOX_TOPIC_MISSING');
    assert.equal(classifyError({ code }).individual, false);
  }
  assert.deepEqual(
    readinessFailure(new AggregateError([{ code: 3 }, { code: -188 }]), [
      'test.topic',
    ]),
    { status: 'missing-topics', topics: ['test.topic'] },
  );
  for (const code of [-195, 29, undefined]) {
    for (const causes of [
      [{ code: 3 }, { code }],
      [{ code }, { code: -188 }],
    ])
      assert.equal(
        readinessFailure(new AggregateError(causes), ['test.topic']).status,
        'broker-failure',
      );
  }
});

function gateFixture(t: import('node:test').TestContext) {
  const config = readRelayConfig(() => undefined);
  let error: unknown;
  let topics: string[] = [];
  let connects = 0;
  const client = () => ({
    connect: async () => {
      connects++;
    },
    disconnect: async () => {},
    listTopics: async () => {
      if (error) throw error;
      return topics;
    },
  });
  t.mock.method(KafkaJS.Kafka.prototype, 'producer', client);
  t.mock.method(KafkaJS.Kafka.prototype, 'admin', client);
  const gate = new KafkaOutboxGate(config);
  const replacement = t.mock.method(
    gate as unknown as { replaceClients(): void },
    'replaceClients',
  );
  return {
    config,
    gate,
    replacement,
    connects: () => connects,
    fail: (value: unknown) => {
      error = value;
    },
    list: (value: string[]) => {
      topics = value;
    },
  };
}

test('missing-only polls keep clients and clear consecutive broker failures', async (t) => {
  const f = gateFixture(t);
  await f.gate.ready();
  f.fail({ code: -195 });
  await f.gate.ready();
  await f.gate.ready();
  f.fail(undefined);
  for (let i = 0; i < 6; i++)
    assert.equal((await f.gate.ready()).status, 'missing-topics');
  assert.equal(f.replacement.mock.callCount(), 0);
  assert.equal(f.connects(), 2);
  f.fail({ code: -195 });
  await f.gate.ready();
  await f.gate.ready();
  assert.equal(f.replacement.mock.callCount(), 0);
  await f.gate.ready();
  assert.equal(f.replacement.mock.callCount(), 1);
  await f.gate.close();
});

test('mixed missing-topic and broker failures still replace connected clients', async (t) => {
  const f = gateFixture(t);
  await f.gate.ready();
  f.fail(new AggregateError([{ code: 3 }, { code: -195 }]));
  for (let i = 0; i < 3; i++)
    assert.equal((await f.gate.ready()).status, 'broker-failure');
  assert.equal(f.replacement.mock.callCount(), 1);
  await f.gate.close();
});

test('initial connection failure replaces clients and can recover', async (t) => {
  const f = gateFixture(t);
  const internal = f.gate as unknown as { admin: { connect(): Promise<void> } };
  t.mock.method(internal.admin, 'connect', async () => {
    throw { code: -195 };
  });
  assert.equal((await f.gate.ready()).status, 'broker-failure');
  assert.equal(f.replacement.mock.callCount(), 1);
  f.list([
    f.config.topic,
    f.config.peerReviewTopic,
    f.config.submissionFinalizedTopic,
  ]);
  assert.equal((await f.gate.ready()).status, 'ready');
  await f.gate.close();
});

test('unresolved probes time out as broker failures, never as missing-only', async (t) => {
  const f = gateFixture(t);
  await f.gate.ready();
  Object.assign(f.gate, { budgetMs: 5 });
  const internal = f.gate as unknown as {
    admin: { listTopics(): Promise<string[]> };
  };
  t.mock.method(
    internal.admin,
    'listTopics',
    () => new Promise<string[]>(() => {}),
  );
  for (let i = 0; i < 3; i++)
    assert.deepEqual(await f.gate.ready(), {
      status: 'broker-failure',
      code: 'OUTBOX_PROBE_TIMEOUT',
    });
  assert.equal(f.replacement.mock.callCount(), 1);
  await f.gate.close();
});

test('stale probes cannot mark a replaced generation connected', async (t) => {
  const f = gateFixture(t);
  let finish!: () => void;
  const internal = f.gate as unknown as {
    admin: { connect(): Promise<void> };
    probe(generation: number): Promise<unknown>;
    replaceClients(): void;
    connected: boolean;
  };
  t.mock.method(
    internal.admin,
    'connect',
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = internal.probe(0);
  internal.replaceClients();
  finish();
  assert.deepEqual(await pending, {
    status: 'broker-failure',
    code: 'OUTBOX_STALE_PROBE',
  });
  assert.equal(internal.connected, false);
  await f.gate.close();
});

test('send-time missing topics preserve whole-batch attempted-send accounting', async (t) => {
  const f = gateFixture(t);
  t.mock.method(f.gate, 'ready', () =>
    Promise.resolve({ status: 'ready' as const }),
  );
  const internal = f.gate as unknown as { producer: object };
  Object.assign(internal.producer, {
    sendBatch: () =>
      Promise.reject(
        Object.assign(new Error('test send failure'), { code: -188 }),
      ),
  });
  const failureCodes: string[] = [];
  let published = 0;
  const repository = {
    transaction: (work: (tx: unknown, rows: RelayRow[]) => Promise<void>) =>
      work({}, [row(), row({ id: '00000000-0000-4000-8000-0000000000e4' })]),
    failed: (_tx: unknown, _row: RelayRow, code: string) => {
      failureCodes.push(code);
      return Promise.resolve();
    },
    published: () => {
      published++;
      return Promise.resolve();
    },
  };
  const service = new RelayService(
    repository as unknown as RelayRepository,
    f.gate,
    f.config,
  );
  await service.tick();
  assert.deepEqual(failureCodes, [
    'OUTBOX_TOPIC_MISSING',
    'OUTBOX_TOPIC_MISSING',
  ]);
  assert.equal(published, 0);
  await f.gate.close();
});
