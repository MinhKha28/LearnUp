const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');

if (process.env.NODE_ENV === 'production') {
  throw new Error('Database integration tests must not run in production.');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for database integration tests.');
}

process.env.NODE_PATH = require('node:path').resolve(__dirname, '../dist');
require('node:module').Module._initPaths();

const {
  PrismaService,
} = require('../dist/src/infrastructure/prisma/prisma.service');
const {
  OutboxRepository,
} = require('../dist/src/modules/outbox/outbox.repository');

const eventType = `EmailRelayIntegration-${randomUUID()}`;

test('outbox claim, retry state and index against PostgreSQL', async (t) => {
  const prisma = new PrismaService({
    getOrThrow: () => process.env.DATABASE_URL,
  });
  await prisma.$connect();
  const repository = new OutboxRepository(prisma);
  const cleanup = () => prisma.outboxEvent.deleteMany({ where: { eventType } });
  try {
    await cleanup();
    const ids = [];
    for (const index of [1, 2]) {
      const event = await prisma.outboxEvent.create({
        data: {
          aggregateType: 'EmailRelayIntegration',
          aggregateId: randomUUID(),
          eventType,
          payload: { index },
          occurredAt: new Date(),
        },
      });
      ids.push(event.id);
    }

    await t.test(
      'an empty exclude list returns the oldest pending email',
      async () => {
        const claimed = await prisma.$transaction((tx) =>
          repository.claimNextUnpublished(eventType, [], tx),
        );
        assert.equal(claimed.id, ids[0]);
        assert.deepEqual(claimed.payload, { index: 1 });
      },
    );

    await t.test(
      'a concurrent claim gets the next unlocked email',
      async () => {
        let releaseFirst;
        const firstHolding = new Promise((resolve) => (releaseFirst = resolve));
        let firstClaimed;
        const first = prisma.$transaction(async (tx) => {
          firstClaimed = await repository.claimNextUnpublished(
            eventType,
            [],
            tx,
          );
          await firstHolding;
        });
        while (!firstClaimed)
          await new Promise((resolve) => setTimeout(resolve, 10));
        const second = await prisma.$transaction((tx) =>
          repository.claimNextUnpublished(eventType, [], tx),
        );
        releaseFirst();
        await first;
        assert.equal(firstClaimed.id, ids[0]);
        assert.equal(second.id, ids[1]);
      },
    );

    await t.test('excluded and published emails are not claimed', async () => {
      await repository.markPublished(ids[1], { redacted: true });
      const claimed = await prisma.$transaction((tx) =>
        repository.claimNextUnpublished(eventType, [ids[0]], tx),
      );
      assert.equal(claimed, null);
    });

    await t.test('recordFailure stores the retry state', async () => {
      const nextAttemptAt = new Date(Date.now() + 60_000);
      await prisma.$transaction((tx) =>
        repository.recordFailure(
          ids[0],
          {
            attempts: 1,
            lastErrorCode: 'HTTP_503',
            nextAttemptAt,
            failedAt: null,
          },
          tx,
        ),
      );
      const row = await prisma.outboxEvent.findUnique({
        where: { id: ids[0] },
      });
      assert.equal(row.attempts, 1);
      assert.equal(row.lastErrorCode, 'HTTP_503');
      assert.equal(row.nextAttemptAt.getTime(), nextAttemptAt.getTime());
      assert.equal(row.failedAt, null);
      assert.equal(row.publishedAt, null);
    });

    await t.test(
      'emails waiting for their next attempt or failed are not claimed',
      async () => {
        const create = (data) =>
          prisma.outboxEvent.create({
            data: {
              aggregateType: 'EmailRelayIntegration',
              aggregateId: randomUUID(),
              eventType,
              payload: {},
              occurredAt: new Date(),
              ...data,
            },
          });
        await create({ failedAt: new Date(), attempts: 8 });
        const due = await create({
          attempts: 2,
          nextAttemptAt: new Date(Date.now() - 1000),
        });
        const claimed = await prisma.$transaction((tx) =>
          repository.claimNextUnpublished(eventType, [], tx),
        );
        assert.equal(claimed.id, due.id);
        assert.equal(claimed.attempts, 2);
      },
    );

    await t.test('the claim query uses the partial index', async () => {
      const plan = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
        return tx.$queryRaw`
          EXPLAIN (FORMAT JSON)
          SELECT id, payload, attempts
          FROM outbox_events
          WHERE event_type = ${eventType}
            AND published_at IS NULL
            AND failed_at IS NULL
            AND (next_attempt_at IS NULL OR next_attempt_at <= now())
            AND NOT (id = ANY(${[]}::uuid[]))
          ORDER BY id
          LIMIT 1
          FOR UPDATE SKIP LOCKED`;
      });
      assert.match(JSON.stringify(plan), /outbox_events_pending_claim_idx/);
    });
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});
