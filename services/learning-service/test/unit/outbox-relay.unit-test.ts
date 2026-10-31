/* Test doubles intentionally implement promise APIs synchronously and throw
 * code-shaped broker/Prisma failures. Original methods are saved for restoration. */
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/only-throw-error, @typescript-eslint/unbound-method */
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Logger } from '@nestjs/common';
import { CODES, KafkaJS } from '@confluentinc/kafka-javascript';
import {
  readRelayConfig,
  retryDelay,
} from '../../src/modules/outbox/relay.config';
import {
  classifyError,
  message,
  RelayProducer,
  SerializationFailure,
} from '../../src/modules/outbox/relay.producer';
import {
  RelayRepository,
  redactPayload,
  type OutboxRow,
  secretFields,
} from '../../src/modules/outbox/relay.repository';
import { RelayService } from '../../src/modules/outbox/relay.service';
import type { Prisma } from '../../generated/prisma/client';
const config = readRelayConfig(() => undefined);
const row = (id = '019a0000-0000-7000-8000-000000000001'): OutboxRow => ({
  id,
  aggregate_id: id,
  organization_id: id,
  event_type: 'EnrollmentAssigned',
  payload: { enrollmentId: id },
  occurred_at: new Date('2026-10-23T00:00:00Z'),
  attempts: 0,
});
function fixture(
  send: (rows: OutboxRow[]) => Promise<void>,
  rows = [row(), row('019a0000-0000-7000-8000-000000000002')],
  settings = config,
) {
  const published: string[] = [],
    failed: { id: string; code: string }[] = [];
  let transactions = 0,
    closed = false;
  const repository = {
    transaction: async (
      work: (tx: Prisma.TransactionClient, rows: OutboxRow[]) => Promise<void>,
    ) => {
      transactions++;
      await work({} as Prisma.TransactionClient, rows);
    },
    published: async (_: unknown, r: OutboxRow) => {
      published.push(r.id);
    },
    failed: async (_: unknown, r: OutboxRow, code: string) => {
      failed.push({ id: r.id, code });
    },
    cleanup: async () => {},
  };
  const producer = {
    ready: async () => true,
    send,
    close: async () => {
      closed = true;
    },
  };
  const relay = new RelayService(
    repository as unknown as RelayRepository,
    producer as unknown as RelayProducer,
    settings,
  );
  return {
    relay,
    producer,
    repository,
    published,
    failed,
    transactions: () => transactions,
    closed: () => closed,
  };
}
test('relay envelope preserves the outbox identity and occurrence on retry', () => {
  const r = row(),
    first = message(r);
  assert.deepEqual(message(r), first);
  assert.deepEqual(JSON.parse(first.value), {
    eventId: r.id,
    eventType: r.event_type,
    version: 1,
    occurredAt: r.occurred_at.toISOString(),
    organizationId: r.organization_id,
    producer: 'learning-service',
    data: r.payload,
  });
  assert.equal(first.key, r.aggregate_id);
});
test('relay rejects invalid organization and payload without exposing content', () => {
  assert.throws(
    () => message({ ...row(), organization_id: null }),
    SerializationFailure,
  );
});
test('relay validates time budget, booleans and numeric settings at startup', () => {
  for (const [key, value] of [
    ['OUTBOX_TRANSACTION_TIMEOUT_MS', '25000'],
    ['OUTBOX_TRANSACTION_TIMEOUT_MS', '31000'],
    ['OUTBOX_BATCH_SIZE', '0'],
    ['OUTBOX_RELAY_ENABLED', 'yes'],
  ])
    assert.throws(() =>
      readRelayConfig((k) => (k === key ? value : undefined)),
    );
});
test('relay backoff doubles and caps at five minutes', () => {
  assert.deepEqual(
    [1, 2, 3, 10, 1000].map((a) => retryDelay(a, config)),
    [1000, 2000, 4000, 300000, 300000],
  );
});
test('relay only isolates explicitly message-specific Kafka codes', () => {
  for (const code of [10, 2, 4, -162, -161])
    assert.equal(classifyError({ code }).individual, true);
  for (const code of [-195, -192, -187, -185, 7, 6, 19, 20, 29, 9999])
    assert.equal(classifyError({ code }).individual, false);
  assert.equal(
    classifyError(new Error('secret payload')).code,
    'OUTBOX_UNKNOWN',
  );
});
test('relay acknowledges all successful rows', async () => {
  const f = fixture(async () => {});
  await f.relay.tick();
  assert.equal(f.published.length, 2);
  assert.equal(f.failed.length, 0);
});
test('broker outage before transaction skips all database locks', async () => {
  const f = fixture(async () => {
    throw new Error();
  });
  f.producer.ready = async () => false;
  const start = performance.now();
  await f.relay.tick();
  assert.equal(f.transactions(), 0);
  assert.ok(performance.now() - start < 100);
});
test('common batch failures back off all rows without individual sends or publication', async () => {
  let calls = 0;
  const f = fixture(async () => {
    calls++;
    throw { code: CODES.ERRORS.ERR__TRANSPORT, payload: 'private' };
  });
  await f.relay.tick();
  assert.equal(calls, 1);
  assert.equal(f.failed.length, 2);
  assert.equal(f.published.length, 0);
  assert.ok(f.failed.every((r) => r.code === 'KAFKA_-195'));
});
test('message failure isolates rows concurrently and waits for every outcome', async () => {
  let concurrent = 0,
    peak = 0;
  const f = fixture(async (rows) => {
    if (rows.length > 1) throw { code: 10 };
    concurrent++;
    peak = Math.max(peak, concurrent);
    await new Promise((resolve) => setTimeout(resolve, 5));
    concurrent--;
    if (rows[0].id.endsWith('2')) throw { code: 10 };
  });
  await f.relay.tick();
  assert.equal(peak, 2);
  assert.equal(f.published.length, 1);
  assert.equal(f.failed.length, 1);
});
test('redaction erases a synthetic event secret without mutating the sent payload', () => {
  const payload = { enrollmentId: 'test', secret: 'synthetic-private' };
  assert.deepEqual(
    redactPayload('SyntheticSecret', payload, { SyntheticSecret: ['secret'] }),
    { enrollmentId: 'test' },
  );
  assert.equal(payload.secret, 'synthetic-private');
});
test('relay alerts from attempt ten using only event id and sanitized code', async () => {
  const logs: unknown[][] = [],
    original = Logger.prototype.error;
  Logger.prototype.error = (...args: unknown[]) => {
    logs.push(args);
  };
  try {
    const f = fixture(async () => {
      throw new Error('private payload');
    }, [{ ...row(), attempts: 9 }]);
    await f.relay.tick();
    assert.equal(logs.length, 2);
    assert.ok(!JSON.stringify(logs).includes('private payload'));
  } finally {
    Logger.prototype.error = original;
  }
});
test('relay prevents overlapping polls and shutdown waits for in-flight delivery', async () => {
  let release!: () => void;
  const f = fixture(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const first = f.relay.tick();
  assert.equal(f.relay.tick(), first);
  await new Promise((resolve) => setImmediate(resolve));
  const stop = f.relay.beforeApplicationShutdown();
  assert.equal(f.closed(), false);
  release();
  await stop;
  assert.equal(f.closed(), true);
  assert.equal(f.published.length, 2);
  await f.relay.tick();
  assert.equal(f.transactions(), 1);
});
test('repository records attempts and bounded backoff on the caller transaction', async () => {
  const repository = new RelayRepository({} as PrismaService, config);
  const calls: unknown[][] = [];
  const taggedTx = {
    $executeRaw: async (...args: unknown[]) => {
      calls.push(args);
      return 1;
    },
  };
  await repository.failed(
    taggedTx as unknown as Prisma.TransactionClient,
    { ...row(), attempts: 2 },
    'KAFKA_-195',
  );
  assert.ok(JSON.stringify(calls[0][0]).includes('attempts=attempts+1'));
  assert.ok(calls[0].includes(4000));
  assert.ok(calls[0].includes('KAFKA_-195'));
});
test('repository redacts after ACK in the publication transaction', async () => {
  const calls: unknown[][] = [];
  Object.defineProperty(secretFields, 'SyntheticSecret', {
    value: ['secret'],
    configurable: true,
  });
  try {
    const repository = new RelayRepository({} as PrismaService, config);
    const tx = {
      $executeRaw: async (...args: unknown[]) => {
        calls.push(args);
        return 1;
      },
    };
    await repository.published(tx as unknown as Prisma.TransactionClient, {
      ...row(),
      event_type: 'SyntheticSecret',
      payload: { secret: 'synthetic-private', enrollmentId: 'fixture' },
    });
    assert.ok(
      JSON.stringify(calls[0][0]).includes('published_at=clock_timestamp()'),
    );
    assert.ok(!JSON.stringify(calls).includes('synthetic-private'));
    assert.ok(calls[0].includes(JSON.stringify({ enrollmentId: 'fixture' })));
  } finally {
    delete (secretFields as Record<string, unknown>).SyntheticSecret;
  }
});

test('broker unavailability warns once per outage and keeps retrying', async () => {
  const logs: unknown[][] = [],
    original = Logger.prototype.warn;
  Logger.prototype.warn = (...args: unknown[]) => {
    logs.push(args);
  };
  try {
    const f = fixture(async () => {});
    let available = false,
      probes = 0;
    f.producer.ready = async () => {
      probes++;
      return available;
    };
    await f.relay.tick();
    await f.relay.tick();
    assert.equal(logs.length, 1);
    assert.equal(probes, 2);
    assert.equal(f.transactions(), 0);
    assert.deepEqual(logs[0], ['OUTBOX_BROKER_UNAVAILABLE: relay will retry']);
    available = true;
    await f.relay.tick();
    assert.equal(f.published.length, 2);
    available = false;
    await f.relay.tick();
    assert.equal(logs.length, 2);
  } finally {
    Logger.prototype.warn = original;
  }
});

test('producer replaces failed initial clients before trying to connect again', async () => {
  const proto = KafkaJS.Kafka.prototype;
  const originalAdmin = proto.admin,
    originalProducer = proto.producer;
  let admins = 0,
    disconnected = 0;
  proto.admin = () => {
    const fail = ++admins === 1;
    return {
      connect: async () => {
        if (fail) throw { code: -195 };
      },
      disconnect: async () => {
        disconnected++;
      },
      listTopics: async () => [],
      createTopics: async () => true,
    } as unknown as KafkaJS.Admin;
  };
  proto.producer = <K, V>() =>
    ({
      connect: async () => {},
      disconnect: async () => {
        disconnected++;
      },
    }) as unknown as KafkaJS.Producer<K, V>;
  try {
    const producer = new RelayProducer(config);
    assert.equal(await producer.ready(), false);
    assert.equal(admins, 2);
    assert.equal(disconnected, 2);
    assert.equal(await producer.ready(), true);
    await producer.close();
    assert.equal(disconnected, 4);
  } finally {
    proto.admin = originalAdmin;
    proto.producer = originalProducer;
  }
});

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
test('gap zero: full batches commit and yield before claiming again without polling', async () => {
  const f = fixture(async () => {}, [row(), row()], {
    ...config,
    batchSize: 2,
    drainGapMs: 0,
  });
  let calls = 0;
  let committed = false;
  let yielded = false;
  setImmediate(() => {
    yielded = true;
  });
  f.repository.transaction = async (work) => {
    if (calls++) {
      assert.equal(committed, true);
      assert.equal(yielded, true);
    }
    await work(
      {} as Prisma.TransactionClient,
      calls < 3 ? [row(), row()] : [row()],
    );
    committed = true;
  };
  await f.relay.tick();
  assert.equal(calls, 3);
  assert.equal(f.published.length, 5);
  await f.relay.beforeApplicationShutdown();
});

test('full batch waits exactly drainGapMs before the next claim', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(async () => {}, [row()], {
    ...config,
    batchSize: 1,
    drainGapMs: 100,
  });
  let claims = 0;
  f.repository.transaction = async (work) => {
    await work({} as Prisma.TransactionClient, ++claims === 1 ? [row()] : []);
  };
  try {
    const wave = f.relay.tick();
    await flush();
    assert.equal(claims, 1);
    t.mock.timers.tick(99);
    await flush();
    assert.equal(claims, 1);
    t.mock.timers.tick(1);
    await wave;
    assert.equal(claims, 2);
  } finally {
    await f.relay.beforeApplicationShutdown();
    t.mock.timers.reset();
  }
});

test(
  'shutdown interrupts the drain gap promptly without another claim',
  { timeout: 2000 },
  async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const f = fixture(async () => {}, [row()], {
      ...config,
      batchSize: 1,
      drainGapMs: 60000,
    });
    try {
      const wave = f.relay.tick();
      await flush();
      assert.equal(f.transactions(), 1);
      await f.relay.beforeApplicationShutdown();
      await wave;
      assert.equal(f.closed(), true);
      t.mock.timers.tick(60000);
      await flush();
      assert.equal(f.transactions(), 1);
    } finally {
      t.mock.timers.reset();
    }
  },
);

test('drain gap accepts zero and nonnegative integers and rejects invalid settings', () => {
  assert.equal(readRelayConfig(() => undefined).drainGapMs, 50);
  for (const value of ['0', '50', '100']) {
    assert.equal(
      readRelayConfig((key) =>
        key === 'OUTBOX_DRAIN_GAP_MS' ? value : undefined,
      ).drainGapMs,
      Number(value),
    );
  }
  for (const value of [
    '',
    '-1',
    '1.5',
    'NaN',
    'Infinity',
    ' 50',
    '9007199254740992',
  ]) {
    assert.throws(
      () =>
        readRelayConfig((key) =>
          key === 'OUTBOX_DRAIN_GAP_MS' ? value : undefined,
        ),
      /Invalid OUTBOX_DRAIN_GAP_MS/,
    );
  }
});

for (const failure of [
  'none',
  'batch',
  'individual',
  'transaction',
  'broker',
]) {
  test(`${failure}: scheduled relay waits pollMs after under-full or failed batch`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const f = fixture(
      async (rows) => {
        if (failure === 'batch') throw { code: -195 };
        if (failure === 'individual' && rows.length > 1) throw { code: 10 };
      },
      [row(), row()],
      { ...config, enabled: true, batchSize: failure === 'none' ? 3 : 2 },
    );
    let claims = 0;
    let probes = 0;
    const transaction = f.repository.transaction;
    f.repository.transaction = async (work) => {
      claims++;
      if (failure === 'transaction') throw { code: 'P2028' };
      await transaction(work);
    };
    f.producer.ready = async () => {
      probes++;
      return failure !== 'broker';
    };
    try {
      f.relay.onModuleInit();
      t.mock.timers.tick(0);
      await flush();
      await flush();
      assert.equal(probes, 1);
      assert.equal(claims, failure === 'broker' ? 0 : 1);
      t.mock.timers.tick(config.pollMs - 1);
      await flush();
      assert.equal(probes, 1);
      t.mock.timers.tick(1);
      await flush();
      assert.equal(probes, 2);
    } finally {
      await f.relay.beforeApplicationShutdown();
      t.mock.timers.reset();
    }
  });
}

test('shutdown during full-batch delivery finishes it without another claim', async () => {
  let release!: () => void;
  const f = fixture(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    [row(), row()],
    { ...config, batchSize: 2 },
  );
  const wave = f.relay.tick();
  assert.equal(f.relay.tick(), wave);
  await flush();
  const stopped = f.relay.beforeApplicationShutdown();
  assert.equal(f.closed(), false);
  release();
  await stopped;
  assert.equal(f.published.length, 2);
  assert.equal(f.transactions(), 1);
  assert.equal(f.closed(), true);
});

test('structured failure logs preserve Prisma and Kafka codes without error content', async () => {
  const logs: unknown[] = [];
  const original = Logger.prototype.error;
  Logger.prototype.error = (entry: unknown) => {
    logs.push(entry);
  };
  try {
    for (const code of ['P2028', -195, 'private-token']) {
      const f = fixture(async () => {});
      f.repository.transaction = async () => {
        throw { code, message: 'private-payload' };
      };
      await f.relay.tick();
      await f.relay.beforeApplicationShutdown();
    }
    assert.deepEqual(
      logs,
      ['P2028', -195, 'OUTBOX_UNKNOWN'].map((code) => ({
        message: 'OUTBOX_RELAY_FAILURE',
        code,
      })),
    );
    assert.equal(JSON.stringify(logs).includes('private'), false);
  } finally {
    Logger.prototype.error = original;
  }
});
