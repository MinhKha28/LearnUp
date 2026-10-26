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

test('claimNextUnpublished skips rows locked by another transaction', async (t) => {
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
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});
