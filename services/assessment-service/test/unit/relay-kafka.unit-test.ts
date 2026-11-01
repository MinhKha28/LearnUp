/** Step 23 of the plan: the message of an event, and what each Kafka failure is called and how the relay treats it. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CODES } from '@confluentinc/kafka-javascript';
import { readRelayConfig } from '../../src/modules/outbox/relay.config';
import { GateFailure } from '../../src/modules/outbox/relay.gate';
import {
  classifyError,
  message,
} from '../../src/modules/outbox/relay.kafka-gate';
import type { RelayRow } from '../../src/modules/outbox/relay.repository';

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
    assert.equal(config.topic, 'learnup.assessment.learner-status-changed');
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
