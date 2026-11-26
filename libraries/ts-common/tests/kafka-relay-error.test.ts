import { describe, expect, it } from 'vitest';
import {
  classifyKafkaRelayError,
  OUTBOX_TOPIC_MISSING,
  OUTBOX_UNKNOWN,
} from '../src/index.js';

describe('classifyKafkaRelayError', () => {
  it.each([
    [
      'an Error with numeric code -195',
      Object.assign(new Error('private broker details'), { code: -195 }),
      'KAFKA_-195',
    ],
    ['a plain object with numeric code -195', { code: -195 }, 'KAFKA_-195'],
    [
      'an Error with a string code',
      Object.assign(new Error('private details'), { code: 'invalid' }),
      OUTBOX_UNKNOWN,
    ],
    [
      'an Error with a non-integer code',
      Object.assign(new Error('private details'), { code: 1.5 }),
      OUTBOX_UNKNOWN,
    ],
    ['an Error without code', new Error('private details'), OUTBOX_UNKNOWN],
    ['undefined', undefined, OUTBOX_UNKNOWN],
    ['null', null, OUTBOX_UNKNOWN],
    ["the string 'Unknown'", 'Unknown', OUTBOX_UNKNOWN],
    ['a plain object without code', {}, OUTBOX_UNKNOWN],
    ['a string', 'private broker details', OUTBOX_UNKNOWN],
  ])('classifies %s by its numeric code only', (_name, error, code) => {
    expect(classifyKafkaRelayError(error)).toEqual({ code, individual: false });
  });

  it.each([2, 4, 10, -161, -162])(
    'marks message error %s as individual',
    (code) => {
      expect(classifyKafkaRelayError({ code })).toEqual({
        code: `KAFKA_${code}`,
        individual: true,
      });
    },
  );

  it.each([-195, -193, -192, -187, -185, 7, 29])(
    'keeps broker and network error %s for the whole batch',
    (code) => {
      expect(classifyKafkaRelayError({ code }).individual).toBe(false);
    },
  );

  it.each([3, -188])(
    'reports missing topic code %s without its number',
    (code) => {
      expect(classifyKafkaRelayError({ code })).toEqual({
        code: OUTBOX_TOPIC_MISSING,
        individual: false,
      });
    },
  );

  it('never returns the error text', () => {
    const error = Object.assign(new Error('broker at 10.0.0.5 said secret'), {
      code: 'secret',
    });
    expect(JSON.stringify(classifyKafkaRelayError(error))).not.toMatch(
      /secret|10\.0\.0\.5/,
    );
  });
});
