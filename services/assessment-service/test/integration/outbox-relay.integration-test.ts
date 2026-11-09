/**
 * Steps 22 and 23 of the plan on a real Postgres: the relay claims events with `FOR UPDATE SKIP LOCKED`, so two relays
 * (two instances of the service) never send the same event, a failed event waits and tries again, and the events of one
 * Learner go out in the order they were written. The relays run in this process over their own connections, with a gate
 * that records what it was given; the Kafka gate itself is tested in outbox-kafka.integration-test.ts.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { LEARNER_STATUS_CHANGED_EVENT } from '../../src/modules/learner-submissions/learner-submissions.constants';
import { GateFailure, OutboxGate } from '../../src/modules/outbox/relay.gate';
import {
  RelayRepository,
  type RelayRow,
} from '../../src/modules/outbox/relay.repository';
import {
  createTestDatabase,
  sleep,
  startService,
  type TestDatabase,
} from './harness';
import { addEvents, aggregate, relayConfig, relayOver } from './outbox-helpers';

class RecordingGate extends OutboxGate {
  sent: string[] = [];
  calls = 0;
  open = true;
  /** When it matches a row of the batch the gate refuses with this failure. */
  failEvery: ((row: RelayRow) => boolean) | null = null;
  failure = new GateFailure('TEST_REFUSED', true);
  /** The time the gate takes: long enough for the other relay to claim while this one holds its rows. */
  constructor(private readonly delayMs = 0) {
    super();
  }
  ready() {
    return Promise.resolve(this.open);
  }
  async send(rows: RelayRow[]) {
    this.calls += 1;
    await sleep(this.delayMs);
    if (this.failEvery && rows.some(this.failEvery)) throw this.failure;
    this.sent.push(...rows.map((row) => row.id));
  }
  close() {
    return Promise.resolve();
  }
}

describe('the relay of the outbox over Postgres', () => {
  let db: TestDatabase;
  const prismas: PrismaService[] = [];
  const relay = (gate: OutboxGate, over: Record<string, string> = {}) =>
    relayOver(db, prismas, gate, over);
  const add = (
    aggregateId: string,
    type = LEARNER_STATUS_CHANGED_EVENT,
    n = 1,
  ) => addEvents(db, aggregateId, type, n);
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
    assert.equal(failed.last_error, 'TEST_REFUSED');
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

  test('the events of one Learner go out in order even when they are about different Assessments: the later one waits for the earlier', async () => {
    await clear();
    const learner = { learnerId: aggregate(600) };
    // the same Learner on two Assessments: two aggregates, one Kafka key
    const [older] = await addEvents(
      db,
      aggregate(601),
      LEARNER_STATUS_CHANGED_EVENT,
      1,
      learner,
    );
    const [newer] = await addEvents(
      db,
      aggregate(602),
      LEARNER_STATUS_CHANGED_EVENT,
      1,
      learner,
    );
    const gate = new RecordingGate();
    gate.failEvery = (row) => row.id === older;
    const worker = relay(gate);
    await worker.tick();
    assert.equal((await state(older)).attempts, 1);
    await worker.tick();
    assert.deepEqual(
      gate.sent,
      [],
      'the newer event does not overtake the older one, which waits',
    );
    assert.equal((await state(newer)).published_at, null);
    // once the older one can go, it goes first and the newer follows
    await db.query(
      'UPDATE outbox_events SET next_attempt_at = NULL WHERE id = $1',
      [older],
    );
    gate.failEvery = null;
    await worker.tick();
    await worker.tick();
    assert.deepEqual(gate.sent, [older, newer]);
  });

  test('a batch never holds two events of one Learner, so the rows tried one by one cannot swap places', async () => {
    await clear();
    const calls: RelayRow[][] = [];
    class SpyGate extends RecordingGate {
      override async send(rows: RelayRow[]) {
        calls.push(rows);
        await super.send(rows);
      }
    }
    // three Learners, each on three Assessments: nine rows, three per Learner
    for (let learner = 0; learner < 3; learner += 1) {
      for (let assessment = 0; assessment < 3; assessment += 1) {
        await addEvents(
          db,
          aggregate(700 + learner * 10 + assessment),
          LEARNER_STATUS_CHANGED_EVENT,
          1,
          { learnerId: aggregate(690 + learner) },
        );
      }
    }
    const worker = relay(new SpyGate());
    for (let i = 0; i < 4; i += 1) await worker.tick();
    assert.equal(
      calls.flat().length,
      9,
      'every row went out within three runs, one per Learner each',
    );
    for (const rows of calls) {
      const learners = rows.map((row) => row.payload.learnerId as string);
      assert.equal(
        new Set(learners).size,
        learners.length,
        'two rows of one Learner in the same batch',
      );
    }
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
    assert.equal(waiting.last_error, 'TEST_REFUSED');
  });

  test('when the destination fails, every row waits and none is tried alone: one send, not one per row', async () => {
    await clear();
    const gate = new RecordingGate();
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) ids.push(...(await add(aggregate(550 + i))));
    gate.failEvery = () => true;
    gate.failure = new GateFailure('KAFKA_-187', false);
    await relay(gate).tick();
    assert.equal(gate.calls, 1, 'one send for the whole batch, not five more');
    for (const id of ids) {
      const row = await state(id);
      assert.equal(row.published_at, null);
      assert.equal(row.attempts, 1);
      assert.equal(row.last_error, 'KAFKA_-187');
    }
  });

  test('an error the gate cannot name is a failure of the whole batch with a fixed code', async () => {
    await clear();
    const [id] = await add(aggregate(580));
    const gate = new RecordingGate();
    gate.send = () => Promise.reject(new Error('secret detail of the broker'));
    await relay(gate).tick();
    const row = await state(id);
    assert.equal(
      row.last_error,
      'OUTBOX_UNKNOWN',
      'the message is never stored',
    );
    assert.equal(row.attempts, 1);
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

  test('the summary of what waits counts the events not sent yet, of the relayed types, and the age of the oldest', async () => {
    await clear();
    const prisma = new PrismaService({
      getOrThrow: () => db.url,
    } as unknown as ConfigService);
    prismas.push(prisma);
    const repository = new RelayRepository(prisma, relayConfig());
    assert.deepEqual(await repository.unsentSummary(), {
      count: 0,
      oldestAt: null,
    });

    const [oldest, , sent] = [
      ...(await add(aggregate(910))),
      ...(await add(aggregate(911))),
      ...(await add(aggregate(912))),
    ];
    const [otherType] = await add(aggregate(913), 'AssignmentMinutesChanged');
    await db.query(
      "UPDATE outbox_events SET occurred_at = now() - interval '2 hours' WHERE id = $1",
      [oldest],
    );
    await db.query(
      "UPDATE outbox_events SET published_at = now(), occurred_at = now() - interval '5 hours' WHERE id = $1",
      [sent],
    );
    await db.query(
      "UPDATE outbox_events SET occurred_at = now() - interval '9 hours' WHERE id = $1",
      [otherType],
    );
    const { count, oldestAt } = await repository.unsentSummary();
    assert.equal(count, 2, 'a sent event and one of another type do not wait');
    const ageSeconds = (Date.now() - (oldestAt as Date).getTime()) / 1000;
    assert.ok(
      ageSeconds > 7100 && ageSeconds < 7400,
      `the oldest waiting event is the one of 2 hours, not the sent one or the other type (${ageSeconds} s)`,
    );
  });

  test('cleanup removes the sent events older than a week and nothing else', async () => {
    await clear();
    const prisma = new PrismaService({
      getOrThrow: () => db.url,
    } as unknown as ConfigService);
    prismas.push(prisma);
    const repository = new RelayRepository(prisma, relayConfig());
    const [oldSent, recentSent, oldNotSent] = [
      ...(await add(aggregate(900))),
      ...(await add(aggregate(901))),
      ...(await add(aggregate(902))),
    ];
    const [otherType] = await add(aggregate(903), 'AssignmentMinutesChanged');
    await db.query(
      "UPDATE outbox_events SET published_at = now() - interval '8 days' WHERE id = ANY($1)",
      [[oldSent, otherType]],
    );
    await db.query(
      "UPDATE outbox_events SET published_at = now() - interval '1 day' WHERE id = $1",
      [recentSent],
    );
    await db.query(
      "UPDATE outbox_events SET created_at = now() - interval '9 days' WHERE id = $1",
      [oldNotSent],
    );
    await repository.cleanup();
    const left = (await db.query('SELECT id FROM outbox_events')).map(
      (row) => row.id,
    );
    assert.deepEqual(left.sort(), [recentSent, oldNotSent, otherType].sort());
  });
});

describe('the relay inside the running service, without a Kafka', () => {
  let db: TestDatabase;
  const rowOf = async (id: string) =>
    (
      await db.query(
        'SELECT published_at, attempts FROM outbox_events WHERE id = $1',
        [id],
      )
    )[0];
  const event = async (n: number) => (await addEvents(db, aggregate(n)))[0];

  before(async () => {
    db = await createTestDatabase();
  });
  after(async () => {
    await db?.drop();
  });

  test('is off by default: an event stays where it was written', async () => {
    const service = await startService(db.url);
    try {
      const id = await event(900);
      await sleep(2500);
      assert.equal((await rowOf(id)).published_at, null);
    } finally {
      await service.stop();
    }
  });

  test('with a Kafka that cannot be reached the service starts and serves, and holds no event locked: nothing is tried', async () => {
    const service = await startService(db.url, {
      OUTBOX_RELAY_ENABLED: 'true',
      OUTBOX_POLL_INTERVAL_MS: '200',
      KAFKA_BROKERS: '127.0.0.1:9',
    });
    try {
      const id = await event(901);
      await sleep(2500);
      const response = await fetch(
        `${service.baseUrl}/api/v1/assessments/assignments`,
      );
      // no key and no user: the guard answers 401, which only a service that is up and serving can say (not a 500)
      assert.equal(response.status, 401, 'the service answers requests');
      const row = await rowOf(id);
      assert.equal(row.published_at, null);
      assert.equal(
        row.attempts,
        0,
        'the broker was not reachable, so no row was claimed',
      );
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

  test('a relay that is on with a topic that is not valid stops it too', async () => {
    await assert.rejects(
      startService(db.url, { OUTBOX_TOPIC: 'not a topic!' }),
      /OUTBOX_TOPIC|exited|did not/i,
    );
  });
});
