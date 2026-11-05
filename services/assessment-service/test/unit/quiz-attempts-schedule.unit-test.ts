/** UC29.1, BR-200: the job that submits the Quiz attempts that ran out of time. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import { QuizAttemptsSchedule } from '../../src/modules/quiz-attempts/quiz-attempts.schedule';
import type { QuizAttemptSettler } from '../../src/modules/quiz-attempts/quiz-attempt-settler';

const config = (value?: string) =>
  ({ get: () => value }) as unknown as ConfigService;

function build(settle: (now: Date) => Promise<number>, tick?: string) {
  const calls: Date[] = [];
  const settler = {
    settleExpired: (now: Date) => {
      calls.push(now);
      return settle(now);
    },
  } as unknown as QuizAttemptSettler;
  return { calls, job: new QuizAttemptsSchedule(settler, config(tick)) };
}

describe('QuizAttemptsSchedule', () => {
  test('a run settles at the time it is given and says how many attempts it submitted', async () => {
    const { job, calls } = build(() => Promise.resolve(3));
    const now = new Date('2026-11-05T10:00:00Z');
    assert.equal(await job.runOnce(now), 3);
    assert.deepEqual(calls, [now]);
  });

  test('a run that is still going makes the next tick skip, so two runs never overlap', async () => {
    let release: (n: number) => void = () => undefined;
    const { job, calls } = build(
      () => new Promise<number>((resolve) => (release = resolve)),
    );
    const first = job.runOnce();
    assert.equal(await job.runOnce(), 0);
    assert.equal(calls.length, 1);
    release(2);
    assert.equal(await first, 2);
    // and it runs again once the first has ended
    const again = job.runOnce();
    release(1);
    assert.equal(await again, 1);
    assert.equal(calls.length, 2);
  });

  test('a failure is logged and swallowed, and the next run tries again', async () => {
    let fail = true;
    const { job } = build(() =>
      fail ? Promise.reject(new Error('db down')) : Promise.resolve(1),
    );
    assert.equal(await job.runOnce(), 0);
    fail = false;
    assert.equal(await job.runOnce(), 1);
  });

  test('without QUIZ_SETTLE_TICK_MS (or with 0 or a bad value) it does not run by itself', () => {
    for (const value of [undefined, '', '0', 'abc', '-5']) {
      const { job } = build(() => Promise.resolve(0), value);
      job.onApplicationBootstrap();
      assert.equal(
        (job as unknown as { timer?: unknown }).timer,
        undefined,
        String(value),
      );
    }
  });

  test('with a period it starts a timer, and the timer is stopped when the module is destroyed', () => {
    const { job } = build(() => Promise.resolve(0), '60000');
    job.onApplicationBootstrap();
    const timer = (job as unknown as { timer?: NodeJS.Timeout }).timer;
    assert.ok(timer);
    job.onModuleDestroy();
    assert.equal(timer.hasRef(), false);
  });
});
