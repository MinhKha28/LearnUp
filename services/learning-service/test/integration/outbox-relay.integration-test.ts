import './tenant-lookup-config';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { ConfigService } from '@nestjs/config';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { readRelayConfig } from '../../src/modules/outbox/relay.config';
import { RelayRepository } from '../../src/modules/outbox/relay.repository';
import { RelayProducer } from '../../src/modules/outbox/relay.producer';
import { RelayService } from '../../src/modules/outbox/relay.service';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import type { AddressInfo } from 'node:net';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing relay tests in production');
const enabled = process.env.OUTBOX_INTEGRATION === 'true';
const org = randomUUID();
const config = {
  ...readRelayConfig((k) => process.env[k]),
  enabled: false,
  topic: `learnup.learning.test-${randomUUID()}`,
};
const prisma = new PrismaService(new ConfigService());
const repo = new RelayRepository(prisma, config);
const p1 = new RelayProducer(config),
  p2 = new RelayProducer(config);
const r1 = new RelayService(repo, p1, config),
  r2 = new RelayService(repo, p2, config);
const kafka = new KafkaJS.Kafka({
  kafkaJS: { brokers: config.brokers, logLevel: KafkaJS.logLevel.NOTHING },
});
const consumer = kafka.consumer({
  kafkaJS: { groupId: `l6-${randomUUID()}`, fromBeginning: true },
});
const received: {
  key: string;
  body: {
    eventId: string;
    occurredAt: string;
    organizationId: string;
    producer: string;
    version: number;
    data: { sequence: number };
  };
}[] = [];
const id = (n: number) =>
  `00000000-${org.slice(0, 4)}-7000-8000-${n.toString(16).padStart(12, '0')}`;
async function insert(
  n: number,
  aggregate: string,
  sequence: number,
  published = false,
  days = 0,
) {
  await prisma.$executeRaw`INSERT INTO outbox_events (id,aggregate_type,aggregate_id,event_type,organization_id,payload,occurred_at,published_at)
    VALUES (${id(n)}::uuid,'Enrollment',${aggregate}::uuid,'EnrollmentAssigned',${org}::uuid,
    ${JSON.stringify({ sequence })}::jsonb,clock_timestamp(), CASE WHEN ${published} THEN now() - ${days} * interval '1 day' ELSE NULL END)`;
}
async function clear() {
  await prisma.$executeRaw`DELETE FROM outbox_events WHERE organization_id=${org}::uuid`;
}
async function waitFor(
  check: () => boolean | Promise<boolean>,
  timeout = 20000,
) {
  const end = Date.now() + timeout;
  while (!(await check())) {
    if (Date.now() > end) throw new Error('Relay integration wait timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
}
before(async () => {
  if (!enabled) return;
  await prisma.$connect();
  await Promise.all([waitFor(() => p1.ready()), waitFor(() => p2.ready())]);
  await consumer.connect();
  await consumer.subscribe({ topics: [config.topic] });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const body = JSON.parse(message.value!.toString());
      if (body.organizationId === org)
        received.push({ key: message.key!.toString(), body });
    },
  });
});
after(async () => {
  if (!enabled) return;
  await Promise.all([
    r1.beforeApplicationShutdown(),
    r2.beforeApplicationShutdown(),
  ]);
  await consumer.disconnect();
  const admin = kafka.admin();
  await admin.connect();
  await admin.deleteTopics({ topics: [config.topic] });
  await admin.disconnect();
  await clear();
  await prisma.$disconnect();
});
test(
  'Postgres claim keeps a backoff head blocking all later aggregate rows',
  { skip: !enabled },
  async () => {
    await clear();
    const a = randomUUID(),
      b = randomUUID();
    await insert(1, a, 1);
    await insert(2, a, 2);
    await insert(3, b, 1);
    await prisma.$executeRaw`UPDATE outbox_events SET next_attempt_at=now()+interval '1 hour' WHERE id=${id(1)}::uuid`;
    await repo.transaction(async (_tx, rows) => {
      assert.deepEqual(
        rows.filter((r) => r.organization_id === org).map((r) => r.id),
        [id(3)],
      );
    });
    await clear();
  },
);
test(
  'cleanup only deletes published rows older than seven days',
  { skip: !enabled },
  async () => {
    const a = randomUUID();
    await insert(10, a, 1);
    await insert(11, a, 2, true, 8);
    await insert(12, a, 3, true, 6);
    await repo.cleanup();
    const rows = await prisma.$queryRaw<
      { id: string }[]
    >`SELECT id FROM outbox_events WHERE organization_id=${org}::uuid ORDER BY id`;
    assert.deepEqual(
      rows.map((r) => r.id),
      [id(10), id(12)],
    );
    await clear();
  },
);
test(
  'two real relays publish 50 x 3 ordered envelopes without duplicates',
  { skip: !enabled, timeout: 60000 },
  async () => {
    received.length = 0;
    const expected = new Map<string, string>();
    for (let a = 0; a < 50; a++) {
      const aggregate = randomUUID();
      for (let sequence = 1; sequence <= 3; sequence++) {
        const n = 100 + a * 3 + sequence;
        await insert(n, aggregate, sequence);
        expected.set(id(n), aggregate);
      }
    }
    for (let i = 0; i < 12; i++) await Promise.all([r1.tick(), r2.tick()]);
    await waitFor(() => received.length >= 150);
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(received.length, 150);
    assert.equal(new Set(received.map((r) => r.body.eventId)).size, 150);
    const sequences = new Map<string, number[]>();
    for (const m of received) {
      assert.equal(m.key, expected.get(m.body.eventId));
      assert.equal(m.body.producer, 'learning-service');
      assert.equal(m.body.version, 1);
      const values = sequences.get(m.key) ?? [];
      values.push(m.body.data.sequence);
      sequences.set(m.key, values);
    }
    for (const values of sequences.values())
      assert.deepEqual(values, [1, 2, 3]);
    const latency = await prisma.$queryRaw<
      { p50: number; p95: number; published: bigint }[]
    >`
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (published_at-occurred_at))*1000) AS p50,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM (published_at-occurred_at))*1000) AS p95,
      count(published_at) AS published FROM outbox_events WHERE organization_id=${org}::uuid`;
    assert.equal(Number(latency[0].published), 150);
    console.log(
      'L6 latency_ms',
      JSON.stringify({ p50: latency[0].p50, p95: latency[0].p95 }),
    );
    console.log('L6 sample', JSON.stringify(received[0]));
    await clear();
  },
);
test(
  'Kafka down skips DB transaction, API still reads DB, recovery preserves order',
  {
    skip: !enabled || process.env.OUTBOX_KAFKA_CHAOS !== 'true',
    timeout: 90000,
  },
  async () => {
    const container = process.env.OUTBOX_TEST_KAFKA_CONTAINER;
    if (!container || !/^[a-zA-Z0-9_.-]+$/.test(container))
      throw new Error('Explicit test Kafka container required');
    await clear();
    received.length = 0;
    const aggregate = randomUUID();
    await insert(1000, aggregate, 1);
    await insert(1001, aggregate, 2);
    let app: NestExpressApplication | undefined;
    let heldMs = 0,
      transactionCalls = 0;
    const measured = new RelayRepository(prisma, config);
    const transaction = measured.transaction.bind(measured);
    measured.transaction = (work) => {
      transactionCalls++;
      const start = performance.now();
      return transaction(work).finally(() => {
        heldMs += performance.now() - start;
      });
    };
    const relay = new RelayService(measured, p1, config);
    try {
      process.env.OUTBOX_RELAY_ENABLED = 'false';
      app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: false,
      });
      configureApp(app);
      await app.listen(0, '127.0.0.1');
      execFileSync('docker', ['stop', container], { stdio: 'ignore' });
      const start = performance.now();
      const tick = relay.tick();
      const apiStart = performance.now();
      const response = await fetch(
        `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1/enrollments/me/course-ids`,
        {
          headers: {
            'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
            'x-user-id': randomUUID(),
            'x-user-role': 'LEARNER',
            'x-organization-id': org,
          },
        },
      );
      assert.equal(response.status, 200);
      const apiMs = performance.now() - apiStart;
      await tick;
      assert.ok(heldMs <= 30000);
      assert.equal(transactionCalls, 0);
      assert.ok(performance.now() - start < 5000);
      const rows = await prisma.$queryRaw<
        { attempts: number; published_at: Date | null }[]
      >`SELECT attempts,published_at FROM outbox_events WHERE organization_id=${org}::uuid`;
      assert.ok(rows.every((r) => r.attempts === 0 && r.published_at === null));
      console.log(
        'L6 Kafka down',
        JSON.stringify({
          heldMs,
          transactionCalls,
          apiMs,
          tickMs: performance.now() - start,
        }),
      );
      // Simulate the broker disappearing just after a successful preflight.
      const ready = p1.ready.bind(p1);
      p1.ready = async () => true;
      try {
        await relay.tick();
      } finally {
        p1.ready = ready;
      }
      assert.equal(transactionCalls, 1);
      assert.ok(heldMs <= 30000);
      const failed = await prisma.$queryRaw<
        { attempts: number; published_at: Date | null; last_error: string }[]
      >`
        SELECT attempts,published_at,last_error FROM outbox_events WHERE organization_id=${org}::uuid`;
      assert.equal(
        failed.filter(
          (r) =>
            r.attempts === 1 &&
            r.published_at === null &&
            /^KAFKA_-?\d+$/.test(r.last_error),
        ).length,
        1,
      );
      console.log(
        'L6 outage after preflight',
        JSON.stringify({ heldMs, transactionCalls }),
      );
    } finally {
      execFileSync('docker', ['start', container], { stdio: 'ignore' });
      await app?.close();
    }
    await waitFor(() => p1.ready(), 40000);
    await r1.tick();
    await r1.tick();
    await waitFor(() => received.length >= 2, 30000);
    assert.deepEqual(
      received.map((r) => r.body.data.sequence),
      [1, 2],
    );
    await clear();
  },
);
