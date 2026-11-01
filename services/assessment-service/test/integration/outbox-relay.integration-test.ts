/**
 * Step 22 of the plan on a real Postgres: the relay claims events with `FOR UPDATE SKIP LOCKED`, so two relays (two
 * instances of the service) never send the same event, a failed event waits and tries again, and the events of one
 * Learner go out in the order they were written. The relays run in this process over their own connections, with a gate
 * that records what it was given.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { LEARNER_STATUS_CHANGED_EVENT } from '../../src/modules/learner-submissions/learner-submissions.constants';
import {
  readRelayConfig,
  type RelayConfig,
} from '../../src/modules/outbox/relay.config';
import { OutboxGate } from '../../src/modules/outbox/relay.gate';
import {
  RelayRepository,
  type RelayRow,
} from '../../src/modules/outbox/relay.repository';
import { RelayService } from '../../src/modules/outbox/relay.service';
import {
  createTestDatabase,
  ORG,
  sleep,
  startService,
  type TestDatabase,
} from './harness';

class RecordingGate extends OutboxGate {
  sent: string[] = [];
  open = true;
  failEvery: ((row: RelayRow) => boolean) | null = null;
  /** The time the gate takes: long enough for the other relay to claim while this one holds its rows. */
  constructor(private readonly delayMs = 0) {
    super();
  }
  ready() {
    return Promise.resolve(this.open);
  }
  async send(rows: RelayRow[]) {
    await sleep(this.delayMs);
    if (this.failEvery && rows.some(this.failEvery))
      throw new Error('the destination refused it');
    this.sent.push(...rows.map((row) => row.id));
  }
  close() {
    return Promise.resolve();
  }
}

/** A UUID v7 like the ones Prisma writes: the first 48 bits are the time, so a later row sorts after an earlier one. */
const uuid7 = (): string => {
  const hex = Date.now().toString(16).padStart(12, '0');
  const random = randomBytes(10).toString('hex');
  const variant = ((parseInt(random[3], 16) & 3) | 8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8)}-7${random.slice(0, 3)}-${variant}${random.slice(4, 7)}-${random.slice(7, 19)}`;
};

const aggregate = (n: number) =>
  `00000000-0000-4000-8000-${(0xb00 + n).toString(16).padStart(12, '0')}`;

describe('the relay of the outbox over Postgres', () => {
  let db: TestDatabase;
  const prismas: PrismaService[] = [];
  const config = (over: Record<string, string> = {}): RelayConfig =>
    readRelayConfig((key) => ({ OUTBOX_BACKOFF_MS: '60000', ...over })[key]);
  const relay = (gate: OutboxGate, over: Record<string, string> = {}) => {
    const prisma = new PrismaService({
      getOrThrow: () => db.url,
    } as unknown as ConfigService);
    prismas.push(prisma);
    const settings = config(over);
    return new RelayService(
      new RelayRepository(prisma, settings),
      gate,
      settings,
    );
  };
  const add = async (
    aggregateId: string,
    type = LEARNER_STATUS_CHANGED_EVENT,
    n = 1,
  ) => {
    const ids: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const [row] = await db.query(
        `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, organization_id, payload, occurred_at, created_at, updated_at)
         VALUES ($4, 'LearnerAssessmentState', $1, $2, $3, '{"n": 1}', now(), now(), now()) RETURNING id`,
        [aggregateId, type, ORG, uuid7()],
      );
      ids.push(row.id as string);
      await sleep(2); // ids are time-ordered: two rows of the same moment would have no order
    }
    return ids;
  };
  const state = async (id: string) =>
    (
      await db.query(
        'SELECT published_at, attempts, last_error, next_attempt_at FROM outbox_events WHERE id = $1',
        [id],
      )
    )[0];
  const clear = () => db.query('DELETE FROM outbox_events');

  before(async () => {
    db = await createTestDatabase();
  });
  after(async () => {
    await Promise.all(prismas.map((p) => p.$disconnect()));
    await db?.drop();
  });

  test('sends a due event once and marks it sent', async () => {
    await clear();
    const gate = new RecordingGate();
    const [id] = await add(aggregate(1));
    await relay(gate).tick();
    assert.deepEqual(gate.sent, [id]);
    const row = await state(id);
    assert.ok(row.published_at);
    assert.equal(row.attempts, 0);
    await relay(gate).tick();
    assert.deepEqual(gate.sent, [id], 'a sent event is not sent again');
  });

  test('two relays at the same moment never send the same event: SKIP LOCKED', async () => {
    await clear();
    // 40 events of 40 Learners, a batch of 10: four batches, shared by two relays that each hold their rows for a while
    const ids: string[] = [];
    for (let i = 0; i < 40; i += 1)
      ids.push(...(await add(aggregate(100 + i))));
    const a = new RecordingGate(150);
    const b = new RecordingGate(150);
    const relayA = relay(a, { OUTBOX_BATCH_SIZE: '10' });
    const relayB = relay(b, { OUTBOX_BATCH_SIZE: '10' });
    for (let round = 0; round < 4; round += 1)
      await Promise.all([relayA.tick(), relayB.tick()]);
    const all = [...a.sent, ...b.sent];
    assert.equal(all.length, 40, 'every event went out');
    assert.equal(new Set(all).size, 40, 'and none went out twice');
    assert.ok(a.sent.length > 0 && b.sent.length > 0, 'both relays took part');
    assert.deepEqual([...all].sort(), [...ids].sort());
  });

  test('a relay does not wait for the rows another relay holds: it takes the next ones at once', async () => {
    await clear();
    for (let i = 0; i < 20; i += 1) await add(aggregate(150 + i));
    const slow = new RecordingGate(1500);
    const quick = new RecordingGate();
    const first = relay(slow, { OUTBOX_BATCH_SIZE: '10' });
    const second = relay(quick, { OUTBOX_BATCH_SIZE: '10' });
    let firstDone = false;
    const running = first.tick().then(() => (firstDone = true));
    await sleep(300); // the first relay holds its 10 rows and is in the gate
    const started = Date.now();
    await second.tick();
    assert.equal(firstDone, false, 'the first relay is still sending');
    assert.ok(
      Date.now() - started < 1000,
      'the second did not wait for the first',
    );
    assert.equal(quick.sent.length, 10, 'it took the other 10 rows');
    await running;
    assert.equal(slow.sent.length, 10);
    assert.equal(new Set([...slow.sent, ...quick.sent]).size, 20);
  });

  test('a batch holds at most the configured number of events', async () => {
    await clear();
    const gate = new RecordingGate();
    for (let i = 0; i < 25; i += 1) await add(aggregate(200 + i));
    await relay(gate).tick();
    assert.equal(gate.sent.length, 20, 'the default batch is 20');
    await relay(gate).tick();
    assert.equal(gate.sent.length, 25);
  });

  test('the events of one Learner go out in the order they were written, one per batch', async () => {
    await clear();
    const gate = new RecordingGate();
    const ids = await add(aggregate(300), LEARNER_STATUS_CHANGED_EVENT, 3);
    const worker = relay(gate);
    await worker.tick();
    await worker.tick();
    await worker.tick();
    assert.deepEqual(gate.sent, ids);
  });

  test('a failed event keeps its place: the code of the failure, a longer wait, and the later events of that Learner wait for it', async () => {
    await clear();
    const gate = new RecordingGate();
    const [first, second] = await add(
      aggregate(400),
      LEARNER_STATUS_CHANGED_EVENT,
      2,
    );
    gate.failEvery = (row) => row.id === first;
    const worker = relay(gate);
    await worker.tick();
    const failed = await state(first);
    assert.equal(failed.published_at, null);
    assert.equal(failed.attempts, 1);
    assert.equal(failed.last_error, 'OUTBOX_SEND_FAILED');
    assert.ok(
      (failed.next_attempt_at as Date).getTime() > Date.now() + 30000,
      'it waits',
    );
    await worker.tick();
    assert.deepEqual(
      gate.sent,
      [],
      'the second event does not overtake the first',
    );
    assert.equal((await state(second)).published_at, null);
  });

  test('a bad event does not hold back the others of its batch: they go out, only it waits', async () => {
    await clear();
    const gate = new RecordingGate();
    const [bad] = await add(aggregate(500));
    const [good, alsoGood] = [
      ...(await add(aggregate(501))),
      ...(await add(aggregate(502))),
    ];
    gate.failEvery = (row) => row.id === bad;
    // the gate refuses the batch because of one row: the relay sends the three one by one
    await relay(gate).tick();
    assert.deepEqual(gate.sent.sort(), [good, alsoGood].sort());
    assert.ok((await state(good)).published_at);
    assert.ok((await state(alsoGood)).published_at);
    const waiting = await state(bad);
    assert.equal(waiting.published_at, null);
    assert.equal(waiting.attempts, 1);
    assert.equal(waiting.last_error, 'OUTBOX_SEND_FAILED');
  });

  test('after the wait it is sent and the failure is forgotten', async () => {
    await clear();
    const gate = new RecordingGate();
    const [id] = await add(aggregate(600));
    gate.failEvery = () => true;
    const worker = relay(gate);
    await worker.tick();
    assert.equal((await state(id)).attempts, 1);
    gate.failEvery = null;
    await db.query(
      "UPDATE outbox_events SET next_attempt_at = now() - interval '1 second' WHERE id = $1",
      [id],
    );
    await worker.tick();
    const row = await state(id);
    assert.ok(row.published_at);
    assert.equal(row.last_error, null);
    assert.equal(row.next_attempt_at, null);
    assert.deepEqual(gate.sent, [id]);
  });

  test('a gate that is down is asked before anything is claimed: nothing is changed', async () => {
    await clear();
    const gate = new RecordingGate();
    gate.open = false;
    const [id] = await add(aggregate(700));
    await relay(gate).tick();
    assert.deepEqual(gate.sent, []);
    const row = await state(id);
    assert.equal(row.published_at, null);
    assert.equal(
      row.attempts,
      0,
      'a gate that was not asked is not a failed attempt',
    );
    gate.open = true;
    await relay(gate).tick();
    assert.deepEqual(gate.sent, [id]);
  });

  test('leaves alone an event that does not go through the relay', async () => {
    await clear();
    const gate = new RecordingGate();
    const [id] = await add(aggregate(800), 'AssignmentMinutesChanged');
    await relay(gate).tick();
    assert.deepEqual(gate.sent, []);
    assert.equal((await state(id)).published_at, null);
  });
});

describe('the relay inside the running service', () => {
  let db: TestDatabase;
  const rowId = async (aggregateId: string) => {
    const [row] = await db.query(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, organization_id, payload, occurred_at, created_at, updated_at)
       VALUES ($4, 'LearnerAssessmentState', $1, $2, $3, '{"n": 1}', now(), now(), now()) RETURNING id`,
      [aggregateId, LEARNER_STATUS_CHANGED_EVENT, ORG, uuid7()],
    );
    return row.id as string;
  };
  const publishedAt = async (id: string) =>
    (
      await db.query('SELECT published_at FROM outbox_events WHERE id = $1', [
        id,
      ])
    )[0].published_at as Date | null;

  before(async () => {
    db = await createTestDatabase();
  });
  after(async () => {
    await db?.drop();
  });

  test('is off by default: an event stays where it was written', async () => {
    const service = await startService(db.url);
    try {
      const id = await rowId(aggregate(900));
      await sleep(2500);
      assert.equal(await publishedAt(id), null);
    } finally {
      await service.stop();
    }
  });

  test('turned on, the service claims and marks the event by itself, and stops cleanly', async () => {
    const service = await startService(db.url, {
      OUTBOX_RELAY_ENABLED: 'true',
      OUTBOX_POLL_INTERVAL_MS: '200',
    });
    try {
      const id = await rowId(aggregate(901));
      for (let i = 0; i < 40 && !(await publishedAt(id)); i += 1)
        await sleep(100);
      assert.ok(await publishedAt(id), 'the relay of the service sent it');
    } finally {
      await service.stop();
    }
  });

  test('a setting that is not valid stops the service from starting', async () => {
    await assert.rejects(
      startService(db.url, { OUTBOX_BATCH_SIZE: '0' }),
      /OUTBOX_BATCH_SIZE|exited|did not/i,
    );
  });
});
