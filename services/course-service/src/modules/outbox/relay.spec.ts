import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import {
  RelayProducer,
  SerializationFailure,
  message,
  classifyError,
} from './relay.producer';
import { RelayRepository } from './relay.repository';
import { RelayService } from './relay.service';
import { readRelayConfig } from './relay.config';
import type { OutboxRow } from './interfaces/outbox-row.interface';

jest.mock('./relay.repository', () => ({ RelayRepository: class {} }));
// No native client: the tests that build real RelayProducer clients replace this constructor.
jest.mock('@confluentinc/kafka-javascript', () => ({
  KafkaJS: {
    Kafka: jest.fn(),
    logLevel: { NOTHING: 0 },
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
  jest.spyOn(producer, 'ready').mockResolvedValue({ status: 'ready' });
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
    failed: jest.fn(async (tx, event, code: string) => {
      if (!code) throw new Error('Missing diagnostic code');
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

it('classifies numeric missing topics and preserves send failure accounting', async () => {
  for (const code of [3, -188])
    expect(classifyError({ code })).toEqual({
      code: 'OUTBOX_TOPIC_MISSING',
      individual: false,
    });
  const h = harness([row(1), row(2)], () =>
    Promise.reject(
      Object.assign(new Error('test broker failure'), { code: 3 }),
    ),
  );
  await h.service.tick();
  expect(h.failed).toHaveLength(2);
  expect(h.published).toHaveLength(0);
  expect(h.repository.failed).toHaveBeenCalledWith(
    expect.anything(),
    row(1),
    'OUTBOX_TOPIC_MISSING',
  );
});

it('distinguishes missing readiness and logs topic transitions without claiming rows', async () => {
  const h = harness([], () => Promise.resolve());
  jest.restoreAllMocks();
  const warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => {});
  let topics: string[] = [];
  let error: Error | undefined;
  Object.assign(h.producer, {
    config,
    connected: true,
    admin: {
      listTopics: () =>
        error ? Promise.reject(error) : Promise.resolve(topics),
    },
  });
  expect(await h.producer.ready()).toEqual({
    status: 'missing-topics',
    topics: [config.topic],
  });
  await h.service.tick();
  await h.service.tick();
  expect(warn.mock.calls).toEqual([
    [`OUTBOX_TOPIC_MISSING topic=${config.topic} hint="run kafka-init"`],
  ]);
  expect(h.repository.transaction).not.toHaveBeenCalled();
  error = Object.assign(new Error('test probe failure'), { code: 3 });
  expect(await h.producer.ready()).toEqual({
    status: 'missing-topics',
    topics: [config.topic],
  });
  error = Object.assign(new Error('test probe failure'), { code: -195 });
  await h.service.tick();
  expect(warn.mock.calls[1][0]).toBe(
    'OUTBOX_BROKER_UNAVAILABLE: will retry code=KAFKA_-195',
  );
  error = undefined;
  topics = [config.topic];
  await h.service.tick();
  topics = [];
  await h.service.tick();
  expect(warn.mock.calls[2]).toEqual(warn.mock.calls[0]);
});

it('dedupes alternating broker codes across a minute and warns again after transitions and recovery', async () => {
  jest.useFakeTimers();
  const warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => {});
  const h = harness([], () => Promise.resolve());
  const ready = jest.spyOn(h.producer, 'ready');
  const secondsPerMinute = 60;
  const pollMs = 1000;
  const codes = ['KAFKA_-195', 'OUTBOX_PROBE_TIMEOUT'];
  for (let second = 0; second < secondsPerMinute; second++) {
    ready.mockResolvedValue({
      status: 'broker-failure',
      code: codes[second % codes.length],
    });
    await h.service.tick();
    await jest.advanceTimersByTimeAsync(pollMs);
  }
  expect(warn.mock.calls).toEqual([
    ['OUTBOX_BROKER_UNAVAILABLE: will retry code=KAFKA_-195'],
  ]);
  expect(h.repository.transaction).not.toHaveBeenCalled();
  ready.mockResolvedValue({ status: 'missing-topics', topics: [config.topic] });
  await h.service.tick();
  ready.mockResolvedValue({ status: 'broker-failure', code: codes[0] });
  await h.service.tick();
  expect(warn.mock.calls).toEqual([
    ['OUTBOX_BROKER_UNAVAILABLE: will retry code=KAFKA_-195'],
    [`OUTBOX_TOPIC_MISSING topic=${config.topic} hint="run kafka-init"`],
    ['OUTBOX_BROKER_UNAVAILABLE: will retry code=KAFKA_-195'],
  ]);
  ready.mockResolvedValue({ status: 'ready' });
  await h.service.tick();
  expect(h.repository.transaction).toHaveBeenCalledTimes(1);
  ready.mockResolvedValue({ status: 'broker-failure', code: codes[1] });
  await h.service.tick();
  expect(warn.mock.calls[3]).toEqual([
    'OUTBOX_BROKER_UNAVAILABLE: will retry code=OUTBOX_PROBE_TIMEOUT',
  ]);
  expect(warn).toHaveBeenCalledTimes(4);
});

it.each([
  [-195, 'KAFKA_-195'],
  [undefined, 'OUTBOX_UNKNOWN'],
  ['invalid', 'OUTBOX_UNKNOWN'],
])(
  'logs classified readiness code %s without claiming rows',
  async (code, diagnostic) => {
    const h = harness([], () => Promise.resolve());
    jest.spyOn(h.producer, 'ready').mockRestore();
    const error = Object.assign(new Error('private broker details'), { code });
    Object.assign(h.producer, {
      config,
      connected: true,
      admin: { listTopics: () => Promise.reject(error) },
    });
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    await h.service.tick();
    expect(warn).toHaveBeenCalledWith(
      `OUTBOX_BROKER_UNAVAILABLE: will retry code=${diagnostic}`,
    );
    expect(h.repository.transaction).not.toHaveBeenCalled();
  },
);

it.each([
  [
    Object.assign(new Error('private broker details'), { code: -195 }),
    'Error',
    'KAFKA_-195',
  ],
  [new Error('private database details'), 'Error', 'OUTBOX_UNKNOWN'],
  [undefined, 'Unknown', 'OUTBOX_UNKNOWN'],
])(
  'logs the error name and classified code for an unexpected tick failure %#',
  async (error, name, diagnostic) => {
    // ready() never rejects (it returns a readiness failure), so the failure comes from the claim transaction.
    const h = harness([row(1)], () => Promise.resolve());
    const errorLog = jest.spyOn(Logger.prototype, 'error');
    h.repository.transaction.mockRejectedValueOnce(error);
    await h.service.tick();
    expect(errorLog).toHaveBeenCalledWith(
      `OUTBOX_RELAY_FAILURE ${name} code=${diagnostic}`,
    );
    expect(h.published).toEqual([]);
    await h.service.tick();
    expect(h.published).toEqual([row(1).id]);
  },
);

it('classifies non-Error inputs directly', () => {
  expect(classifyError({ code: -195 }).code).toBe('KAFKA_-195');
  expect(classifyError('private broker details').code).toBe('OUTBOX_UNKNOWN');
  expect(classifyError(undefined).code).toBe('OUTBOX_UNKNOWN');
});

interface FakeClient {
  connect: jest.Mock<() => Promise<void>>;
  disconnect: jest.Mock<() => Promise<void>>;
  listTopics: jest.Mock<() => Promise<string[]>>;
}

function fakeClient(connectError?: Error): FakeClient {
  return {
    connect: jest.fn(() =>
      connectError ? Promise.reject(connectError) : Promise.resolve(),
    ),
    disconnect: jest.fn(() => Promise.resolve()),
    listTopics: jest.fn(() => Promise.resolve([config.topic])),
  };
}

/** One Kafka build: the producer and admin that kafka.producer() and kafka.admin() return, or a throw from admin(). */
interface ClientBuild {
  producer: FakeClient;
  admin: FakeClient | Error;
}

/** Replaces the KafkaJS constructor so each RelayProducer build takes the next planned clients. */
function planKafkaBuilds(builds: ClientBuild[]) {
  let next = 0;
  jest.mocked(KafkaJS.Kafka).mockImplementation(() => {
    const build = builds[next++];
    return {
      producer: () => build.producer,
      admin: () => {
        if (build.admin instanceof Error) throw build.admin;
        return build.admin;
      },
    } as unknown as jest.Mocked<KafkaJS.Kafka>;
  });
  return { builds: () => next };
}

function relayClients(producer: RelayProducer) {
  return producer as unknown as { producer?: unknown; admin?: unknown };
}

it('turns a failed probe into a readiness failure and rebuilds the clients', async () => {
  const brokerDown = Object.assign(new Error('private broker details'), {
    code: -195,
  });
  const first = { producer: fakeClient(), admin: fakeClient(brokerDown) };
  const second = { producer: fakeClient(), admin: fakeClient() };
  const kafka = planKafkaBuilds([first, second]);
  const producer = new RelayProducer(config);

  await expect(producer.ready()).resolves.toEqual({
    status: 'broker-failure',
    code: 'KAFKA_-195',
  });
  expect(kafka.builds()).toBe(2);
  expect(first.producer.disconnect).toHaveBeenCalled();
  expect(first.admin.disconnect).toHaveBeenCalled();

  await expect(producer.ready()).resolves.toEqual({ status: 'ready' });
  expect(second.producer.connect).toHaveBeenCalledTimes(1);
});

it('turns a client build failure during replacement into a readiness failure and retries cleanly', async () => {
  const brokerDown = Object.assign(new Error('private broker details'), {
    code: -195,
  });
  const buildError = Object.assign(new Error('private config details'), {
    code: -172,
  });
  const first = { producer: fakeClient(), admin: fakeClient(brokerDown) };
  // The producer is built, then admin() throws: this producer must be dropped, never used.
  const halfBuilt = { producer: fakeClient(), admin: buildError };
  const third = { producer: fakeClient(), admin: fakeClient() };
  const kafka = planKafkaBuilds([first, halfBuilt, third]);
  const producer = new RelayProducer(config);

  // The probe's code stays the reason; the rebuild failure is attached beside it.
  await expect(producer.ready()).resolves.toEqual({
    status: 'broker-failure',
    code: 'KAFKA_-195',
    rebuildCode: 'KAFKA_-172',
  });
  expect(relayClients(producer).producer).toBeUndefined();
  expect(relayClients(producer).admin).toBeUndefined();

  await expect(producer.ready()).resolves.toEqual({ status: 'ready' });
  expect(kafka.builds()).toBe(3);
  expect(relayClients(producer).producer).toBe(third.producer);
  expect(relayClients(producer).admin).toBe(third.admin);
  expect(halfBuilt.producer.connect).not.toHaveBeenCalled();
  expect(halfBuilt.producer.disconnect).not.toHaveBeenCalled();
});

it('logs a failed rebuild after a failed probe as rebuild_code beside the probe code', async () => {
  const buildError = Object.assign(new Error('private config details'), {
    code: -172,
  });
  const first = {
    producer: fakeClient(),
    admin: fakeClient(Object.assign(new Error('down'), { code: -195 })),
  };
  planKafkaBuilds([first, { producer: fakeClient(), admin: buildError }]);
  const producer = new RelayProducer(config);
  const repository = { transaction: jest.fn() };
  const service = new RelayService(
    repository as unknown as RelayRepository,
    producer,
    config,
  );
  const warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => {});
  const error = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => {});

  await service.tick();

  expect(warn.mock.calls).toEqual([
    [
      'OUTBOX_BROKER_UNAVAILABLE: will retry code=KAFKA_-195 rebuild_code=KAFKA_-172',
    ],
  ]);
  expect(error).not.toHaveBeenCalled();
  expect(repository.transaction).not.toHaveBeenCalled();
});

it('logs exactly the probe failure line when the rebuild after it succeeds', async () => {
  const brokerDown = Object.assign(new Error('private broker details'), {
    code: -195,
  });
  planKafkaBuilds([
    { producer: fakeClient(), admin: fakeClient(brokerDown) },
    { producer: fakeClient(), admin: fakeClient(brokerDown) },
  ]);
  const producer = new RelayProducer(config);
  const repository = { transaction: jest.fn() };
  const service = new RelayService(
    repository as unknown as RelayRepository,
    producer,
    config,
  );
  const warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => {});

  await service.tick();

  expect(warn.mock.calls).toEqual([
    ['OUTBOX_BROKER_UNAVAILABLE: will retry code=KAFKA_-195'],
  ]);
  expect(repository.transaction).not.toHaveBeenCalled();
});
