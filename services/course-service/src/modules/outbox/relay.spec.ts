import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { RelayProducer, SerializationFailure, message } from './relay.producer';
import { RelayRepository } from './relay.repository';
import { RelayService } from './relay.service';
import { readRelayConfig } from './relay.config';
import type { OutboxRow } from './interfaces/outbox-row.interface';

jest.mock('./relay.repository', () => ({ RelayRepository: class {} }));
jest.mock('@confluentinc/kafka-javascript', () => ({
  CODES: {
    ERRORS: {
      ERR_MSG_SIZE_TOO_LARGE: 10,
      ERR__KEY_SERIALIZATION: -1,
      ERR__VALUE_SERIALIZATION: -2,
      ERR_INVALID_MSG: 2,
      ERR_INVALID_MSG_SIZE: 4,
    },
  },
}));

const config = { ...readRelayConfig(() => undefined), enabled: true };
const uuid = (n: number) =>
  `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number): OutboxRow => ({
  id: uuid(n),
  aggregate_type: 'Course',
  aggregate_id: uuid(n + 100),
  event_type: 'CourseDisabled',
  organization_id: uuid(999),
  attempts: 0,
  occurred_at: new Date('2026-10-30T00:00:00Z'),
  payload: {
    courseId: uuid(n + 100),
    organizationId: uuid(999),
    occurredAt: '2026-10-30T00:00:00.000Z',
  },
});

function harness(rows: OutboxRow[], send: (id: string) => Promise<void>) {
  const transport = jest.fn(async ({ messages }) => {
    await send(JSON.parse(messages[0].value).eventId);
    return [];
  });
  const producer = new RelayProducer({ ...config, enabled: false });
  Object.assign(producer, { producer: { send: transport } });
  jest.spyOn(producer, 'ready').mockResolvedValue(true);
  const published: string[] = [],
    failed: string[] = [];
  let commits = 0,
    rollbacks = 0;
  const repository = {
    transaction: jest.fn(async (work) => {
      const tx = { published: [] as string[], failed: [] as string[] };
      const started = Date.now();
      try {
        await work(tx, rows);
        if (Date.now() - started >= config.transactionMs)
          throw Error('expired');
        published.push(...tx.published);
        failed.push(...tx.failed);
        commits++;
      } catch (error) {
        rollbacks++;
        throw error;
      }
    }),
    published: jest.fn(async (tx, event) => {
      tx.published.push(event.id);
    }),
    failed: jest.fn(async (tx, event) => {
      tx.failed.push(event.id);
    }),
  };
  const service = new RelayService(
    repository as unknown as RelayRepository,
    producer,
    config,
  );
  return {
    service,
    repository,
    producer,
    transport,
    published,
    failed,
    counts: () => ({ commits, rollbacks }),
  };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('commits 20 concurrent 2-second ACKs once within the 30-second budget', async () => {
  jest.useFakeTimers();
  const rows = Array.from({ length: 20 }, (_, n) => row(n + 1));
  const h = harness(
    rows,
    () => new Promise((resolve) => setTimeout(resolve, 2000)),
  );
  const started = Date.now();
  const tick = h.service.tick();
  await jest.advanceTimersByTimeAsync(2000);
  await tick;
  expect(Date.now() - started).toBe(2000);
  expect(h.transport).toHaveBeenCalledTimes(20);
  expect(h.published).toEqual(rows.map((r) => r.id));
  expect(h.counts()).toEqual({ commits: 1, rollbacks: 0 });
});

it('retries only a poison event and publishes other ACKed events once', async () => {
  const h = harness([row(1), row(2), row(3)], async (id) => {
    if (id === uuid(2)) throw new SerializationFailure();
  });
  await h.service.tick();
  expect(h.published).toEqual([uuid(1), uuid(3)]);
  expect(h.failed).toEqual([uuid(2)]);
  expect(
    h.transport.mock.calls.map(
      ([v]) => JSON.parse(v.messages[0].value).eventId,
    ),
  ).toEqual([uuid(1), uuid(2), uuid(3), uuid(2)]);
  expect(h.counts()).toEqual({ commits: 1, rollbacks: 0 });
});

it('publishes an individually failed event when its concurrent fallback succeeds', async () => {
  const attempts = new Map<string, number>();
  const h = harness([row(1), row(2)], async (id) => {
    const n = (attempts.get(id) ?? 0) + 1;
    attempts.set(id, n);
    if (id === uuid(2) && n === 1) throw new SerializationFailure();
  });
  await h.service.tick();
  expect(h.published).toEqual([uuid(1), uuid(2)]);
  expect(h.failed).toEqual([]);
  expect(attempts.get(uuid(1))).toBe(1);
});

it('drains every delivery report before retrying an individual failure', async () => {
  jest.useFakeTimers();
  let attempts = 0;
  const h = harness([row(1), row(2)], async (id) => {
    if (id === uuid(1) && ++attempts === 1) throw new SerializationFailure();
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });
  const tick = h.service.tick();
  await jest.advanceTimersByTimeAsync(1999);
  expect(h.transport).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(2001);
  await tick;
  expect(h.published).toEqual([uuid(1), uuid(2)]);
  expect(h.counts().rollbacks).toBe(0);
});

it('backs off every claimed row on broker failure and commits without retrying', async () => {
  const h = harness([row(1), row(2)], async (id) => {
    if (id === uuid(2)) throw Object.assign(Error('timeout'), { code: -185 });
  });
  await h.service.tick();
  expect(h.failed).toEqual([uuid(1), uuid(2)]);
  expect(h.published).toEqual([]);
  expect(h.transport).toHaveBeenCalledTimes(2);
  expect(h.repository.transaction).toHaveBeenCalledTimes(1);
  expect(h.counts()).toEqual({ commits: 1, rollbacks: 0 });
});

it('retries multiple individual failures concurrently within two delivery windows', async () => {
  jest.useFakeTimers();
  const attempts = new Map<string, number>();
  const h = harness([row(1), row(2), row(3)], async (id) => {
    const n = (attempts.get(id) ?? 0) + 1;
    attempts.set(id, n);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (id !== uuid(3) && n === 1) throw new SerializationFailure();
  });
  const started = Date.now();
  const tick = h.service.tick();
  await jest.advanceTimersByTimeAsync(4000);
  await tick;
  expect(Date.now() - started).toBe(4000);
  expect(h.published).toEqual([uuid(1), uuid(2), uuid(3)]);
  expect(attempts.get(uuid(3))).toBe(1);
  expect(h.counts()).toEqual({ commits: 1, rollbacks: 0 });
});

it('retains the course envelope, key and event identity', () => {
  const event = row(1),
    result = message(event);
  expect(result.key).toBe(event.aggregate_id);
  expect(JSON.parse(result.value)).toMatchObject({
    eventId: event.id,
    eventType: 'CourseDisabled',
    producer: 'course-service',
    version: 1,
    data: event.payload,
  });
});

it.each([
  [19999, 10000],
  [5000, 1000],
  [4999, 1000],
  [30001, 10000],
])('rejects transaction %i / delivery %i at startup', (tx, delivery) => {
  expect(() =>
    readRelayConfig(
      (key) =>
        ({
          OUTBOX_TRANSACTION_TIMEOUT_MS: String(tx),
          OUTBOX_DELIVERY_TIMEOUT_MS: String(delivery),
        })[key],
    ),
  ).toThrow(
    'OUTBOX_TRANSACTION_TIMEOUT_MS must be >= 2 * OUTBOX_DELIVERY_TIMEOUT_MS',
  );
});

it.each([
  [20000, 10000],
  [5001, 2500],
  [30000, 10000],
])('accepts transaction %i / delivery %i', (tx, delivery) => {
  expect(
    readRelayConfig(
      (key) =>
        ({
          OUTBOX_TRANSACTION_TIMEOUT_MS: String(tx),
          OUTBOX_DELIVERY_TIMEOUT_MS: String(delivery),
        })[key],
    ).transactionMs,
  ).toBe(tx);
});
