import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  noticeRetryDelaysMs,
  withRetries,
} from '../../src/infrastructure/clients/notification/retry';

describe('withRetries', () => {
  test('runs the work once when it succeeds, without waiting', async () => {
    let calls = 0;
    const result = await withRetries(() => {
      calls += 1;
      return Promise.resolve('sent');
    }, [1000, 1000]);
    assert.equal(result, 'sent');
    assert.equal(calls, 1);
  });

  test('tries again after each delay and stops at the first success', async () => {
    let calls = 0;
    const retries: number[] = [];
    const result = await withRetries(
      () => {
        calls += 1;
        return calls < 3
          ? Promise.reject(new Error(`down ${calls}`))
          : Promise.resolve('sent');
      },
      [1, 1, 1],
      (_error, attempt) => retries.push(attempt),
    );
    assert.equal(result, 'sent');
    assert.equal(calls, 3);
    assert.deepEqual(retries, [2, 3], 'the number of the attempt that follows');
  });

  test('gives up after the last delay and throws the last failure', async () => {
    let calls = 0;
    await assert.rejects(
      withRetries(() => {
        calls += 1;
        return Promise.reject(new Error(`down ${calls}`));
      }, [1, 1]),
      /down 3/,
    );
    assert.equal(calls, 3, 'one attempt, then one after each delay');
  });

  test('with no delay it is a single attempt', async () => {
    let calls = 0;
    await assert.rejects(
      withRetries(() => {
        calls += 1;
        return Promise.reject(new Error('down'));
      }, []),
      /down/,
    );
    assert.equal(calls, 1);
  });
});

describe('noticeRetryDelaysMs', () => {
  test('reads a comma list, and falls back to the defaults for anything else', () => {
    assert.deepEqual(noticeRetryDelaysMs('10, 20,30'), [10, 20, 30]);
    assert.deepEqual(
      noticeRetryDelaysMs(undefined),
      [1000, 4000, 15000, 45000],
    );
    assert.deepEqual(noticeRetryDelaysMs(''), [1000, 4000, 15000, 45000]);
    assert.deepEqual(noticeRetryDelaysMs('soon'), [1000, 4000, 15000, 45000]);
  });

  test('ignores a negative or broken item and keeps the good ones', () => {
    assert.deepEqual(noticeRetryDelaysMs('5,-1,x,7'), [5, 7]);
  });
});
