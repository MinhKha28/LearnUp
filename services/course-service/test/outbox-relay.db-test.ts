import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { readRelayConfig } from '../src/modules/outbox/relay.config';
import { RelayRepository } from '../src/modules/outbox/relay.repository';
import {
  RelayProducer,
  SerializationFailure,
} from '../src/modules/outbox/relay.producer';
import { RelayService } from '../src/modules/outbox/relay.service';
import type { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import type { OutboxRow } from '../src/modules/outbox/interfaces/outbox-row.interface';

// Run only against an explicitly designated disposable database, never a demo DB.
if (
  process.env.NODE_ENV === 'production' ||
  !process.env.OUTBOX_TEST_DATABASE_URL
) {
  throw new Error(
    'Set OUTBOX_TEST_DATABASE_URL to a disposable PostgreSQL database',
  );
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.OUTBOX_TEST_DATABASE_URL,
  }),
});
const config = { ...readRelayConfig(() => undefined), enabled: true };
const repo = new RelayRepository(prisma as unknown as PrismaService, config);
const uuid = (n: number) =>
  `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const org = uuid(999);
async function insert(n: number, course = n, poison = false) {
  await prisma.outboxEvent.create({
    data: {
      id: uuid(n),
      aggregateType: 'Course',
      aggregateId: uuid(100 + course),
      eventType: 'CourseDisabled',
      organizationId: org,
      occurredAt: new Date(0),
      payload: poison
        ? {}
        : {
            courseId: uuid(100 + course),
            organizationId: org,
            occurredAt: new Date(0).toISOString(),
          },
    },
  });
}
function relay(send: (id: string) => Promise<void>, repository = repo) {
  const producer = new RelayProducer({ ...config, enabled: false });
  Object.assign(producer, {
    producer: {
      send: async ({ messages }) => {
        await send(JSON.parse(messages[0].value).eventId);
        return [];
      },
    },
    ready: async () => true,
  });
  return new RelayService(repository, producer, config);
}
const rows = () => prisma.outboxEvent.findMany({ orderBy: { id: 'asc' } });
before(async () => {
  await prisma.$connect();
});
beforeEach(async () => {
  await prisma.outboxEvent.deleteMany({ where: { organizationId: org } });
});
after(async () => {
  await prisma.$disconnect();
});

test('20 slow ACKs commit once inside the real transaction budget', async () => {
  for (let n = 1; n <= 20; n++) await insert(n);
  const acks: string[] = [];
  const started = Date.now();
  await relay(async (id) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    acks.push(id);
  }).tick();
  assert.ok(Date.now() - started < config.transactionMs);
  assert.equal(acks.length, 20);
  assert.equal(new Set(acks).size, 20);
  assert.ok(
    (await rows()).every((row) => row.publishedAt && row.attempts === 0),
  );
});

test('poison head backs off; other courses publish and its successor stays blocked', async () => {
  await insert(1, 1, true);
  await insert(2, 1);
  await insert(3, 2);
  const acks: string[] = [];
  const service = relay(async (id) => {
    acks.push(id);
  });
  await service.tick();
  await service.tick();
  const [head, next, other] = await rows();
  assert.equal(head.attempts, 1);
  assert.ok(head.nextAttemptAt);
  assert.equal(head.lastError, 'OUTBOX_SERIALIZATION');
  assert.equal(head.publishedAt, null);
  assert.equal(next.publishedAt, null);
  assert.ok(other.publishedAt);
  assert.deepEqual(acks, [uuid(3)]);
});

test('broker failure commits backoff for all heads, and the next poll does not resend', async () => {
  for (let n = 1; n <= 20; n++) await insert(n);
  let sends = 0;
  const service = relay(async () => {
    sends++;
    throw Object.assign(Error('timeout'), { code: -185 });
  });
  await service.tick();
  await service.tick();
  assert.equal(sends, 20);
  assert.ok(
    (await rows()).every(
      (row) => !row.publishedAt && row.attempts === 1 && row.nextAttemptAt,
    ),
  );
});

test('rollback after ACK leaves all rows claimable for the next transaction', async () => {
  await insert(1);
  await insert(2);
  const failing = new RelayRepository(
    prisma as unknown as PrismaService,
    config,
  );
  const published = failing.published.bind(failing);
  failing.published = async (tx, row) => {
    await published(tx, row);
    throw Error('injected marking failure');
  };
  await relay(async () => {}, failing).tick();
  assert.ok(
    (await rows()).every((row) => !row.publishedAt && row.attempts === 0),
  );
  await repo.transaction(async (_tx, claimed) => {
    assert.deepEqual(
      claimed.map((row) => row.id),
      [uuid(1), uuid(2)],
    );
  });
});

test('normal and individual fallback paths publish same-course heads in order', async () => {
  for (const fallback of [false, true]) {
    await prisma.outboxEvent.deleteMany({ where: { organizationId: org } });
    await insert(1, 1);
    await insert(2, 1);
    await insert(3, 2);
    const calls: string[] = [],
      acks: string[] = [];
    const service = relay(async (id) => {
      calls.push(id);
      if (
        fallback &&
        id === uuid(1) &&
        calls.filter((v) => v === id).length === 1
      ) {
        throw new SerializationFailure();
      }
      acks.push(id);
    });
    await service.tick();
    assert.ok(!calls.includes(uuid(2)));
    await service.tick();
    assert.ok(acks.indexOf(uuid(1)) < acks.indexOf(uuid(2)));
    assert.ok((await rows()).every((row) => row.publishedAt));
    assert.equal(calls.filter((id) => id === uuid(3)).length, 1);
  }
});

test('SKIP LOCKED across workers never exposes the successor of a locked head', async () => {
  await insert(1, 1);
  await insert(2, 1);
  await insert(3, 2);
  await repo.transaction(async (_tx, claimed: OutboxRow[]) => {
    assert.deepEqual(
      claimed.map((row) => row.id),
      [uuid(1), uuid(3)],
    );
    await repo.transaction(async (_otherTx, otherRows) => {
      assert.equal(otherRows.length, 0);
    });
  });
});
