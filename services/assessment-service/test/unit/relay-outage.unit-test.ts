/**
 * What the relay says while the destination (Kafka) cannot be reached. Nothing is claimed then, so no row counts an attempt
 * and the alert of the retries never fires: the relay has to alert by itself, after the outage has lasted a while.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { readRelayConfig } from '../../src/modules/outbox/relay.config';
import { EmptyOutboxGate } from '../../src/modules/outbox/relay.gate';
import type { RelayRepository } from '../../src/modules/outbox/relay.repository';
import { RelayService } from '../../src/modules/outbox/relay.service';

const MINUTE = 60_000;
const START = Date.parse('2026-11-05T08:00:00.000Z');

describe('the relay while the destination is down', () => {
  let time: number;
  let open: boolean;
  let summary: () => Promise<{ count: number; oldestAt: Date | null }>;
  let logs: { level: 'log' | 'warn' | 'error'; message: string }[];
  let claimed: number;
  let service: RelayService;

  beforeEach(() => {
    time = START;
    open = false;
    claimed = 0;
    logs = [];
    summary = () =>
      Promise.resolve({ count: 3, oldestAt: new Date(START - 2 * MINUTE) });
    const gate = Object.assign(new EmptyOutboxGate(), {
      ready: () => Promise.resolve(open),
    });
    const repository = {
      transaction: () => {
        claimed += 1;
        return Promise.resolve();
      },
      unsentSummary: () => summary(),
    } as unknown as RelayRepository;
    // alert after 5 minutes, then every 5 minutes (the default)
    const config = readRelayConfig(() => undefined);
    service = new RelayService(repository, gate, config);
    service.now = () => time;
    const record = (level: 'log' | 'warn' | 'error') => (message: string) => {
      logs.push({ level, message });
    };
    (service as unknown as { logger: object }).logger = {
      log: record('log'),
      warn: record('warn'),
      error: record('error'),
    };
  });

  const turns = async (minutes: number) => {
    for (let m = 0; m < minutes; m += 1) {
      time += MINUTE;
      await service.tick();
    }
  };
  const alerts = () =>
    logs.filter((l) => l.message.startsWith('OUTBOX_RETRY_ALERT'));

  test('the default is an alert after five minutes', () => {
    assert.equal(readRelayConfig(() => undefined).outageAlertMs, 300000);
  });

  test('the first turn without the destination is one warning, and nothing is claimed', async () => {
    await service.tick();
    assert.deepEqual(logs, [
      {
        level: 'warn',
        message: 'OUTBOX_GATE_UNAVAILABLE: the relay will retry',
      },
    ]);
    assert.equal(claimed, 0);
  });

  test('no alert before the outage has lasted the period, and one warning only', async () => {
    await service.tick();
    await turns(4);
    assert.equal(alerts().length, 0);
    assert.equal(logs.filter((l) => l.level === 'warn').length, 1);
  });

  test('once it has lasted the period an alert says for how long and how many events wait, and how old the oldest is', async () => {
    await service.tick();
    await turns(5);
    assert.equal(alerts().length, 1);
    assert.equal(alerts()[0].level, 'error');
    // down 5 minutes; the oldest event is 2 minutes older than the start of the outage plus the 5 minutes
    assert.equal(
      alerts()[0].message,
      'OUTBOX_RETRY_ALERT code=OUTBOX_GATE_UNAVAILABLE down_for_s=300 unsent=3 oldest_unsent_age_s=420',
    );
  });

  test('it repeats after each further period, not on every turn', async () => {
    await service.tick();
    await turns(5);
    await turns(4);
    assert.equal(alerts().length, 1);
    await turns(1);
    assert.equal(alerts().length, 2);
    await turns(10);
    assert.equal(alerts().length, 4);
    assert.match(alerts()[3].message, /down_for_s=1200 /);
  });

  test('an outage with nothing waiting says so with a zero age, not a missing one', async () => {
    summary = () => Promise.resolve({ count: 0, oldestAt: null });
    await service.tick();
    await turns(5);
    assert.match(alerts()[0].message, /unsent=0 oldest_unsent_age_s=0$/);
  });

  test('when the database cannot be read either, the alert is still sent, without the numbers', async () => {
    summary = () => Promise.reject(new Error('db down'));
    await service.tick();
    await turns(5);
    assert.equal(
      alerts()[0].message,
      'OUTBOX_RETRY_ALERT code=OUTBOX_GATE_UNAVAILABLE down_for_s=300 unsent=unknown',
    );
  });

  test('when the destination answers again it says so and the clock of the outage starts over', async () => {
    await service.tick();
    await turns(6);
    assert.equal(alerts().length, 1);
    open = true;
    await turns(1);
    const recovered = logs.filter((l) =>
      l.message.startsWith('OUTBOX_GATE_RECOVERED'),
    );
    assert.equal(recovered.length, 1);
    assert.match(recovered[0].message, /after 420s$/);
    assert.equal(claimed, 1, 'the relay works again');

    // a second outage is a new one: its own warning, and no alert before its own period
    open = false;
    const before = logs.length;
    await turns(1);
    assert.deepEqual(logs.slice(before), [
      {
        level: 'warn',
        message: 'OUTBOX_GATE_UNAVAILABLE: the relay will retry',
      },
    ]);
    await turns(4);
    assert.equal(alerts().length, 1);
    await turns(1);
    assert.equal(alerts().length, 2);
  });

  test('an outage shorter than the period leaves no alert behind when it ends', async () => {
    await service.tick();
    await turns(2);
    open = true;
    await turns(1);
    assert.equal(alerts().length, 0);
    assert.equal(
      logs.filter((l) => l.message.startsWith('OUTBOX_GATE_RECOVERED')).length,
      1,
    );
  });
});
