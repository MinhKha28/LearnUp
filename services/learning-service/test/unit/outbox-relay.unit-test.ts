import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Logger } from '@nestjs/common';
import { CODES } from '@confluentinc/kafka-javascript';
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
    config,
  );
  return {
    relay,
    producer,
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
    assert.equal(logs.length, 1);
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
