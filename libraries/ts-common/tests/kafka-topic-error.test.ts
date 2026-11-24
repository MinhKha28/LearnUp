import { describe, expect, it } from 'vitest';
import { isKafkaTopicMissing, OUTBOX_TOPIC_MISSING } from '../src/index.js';

describe('missing Kafka topics', () => {
  it.each([3, -188])('recognizes numeric code %s', (code) => {
    expect(isKafkaTopicMissing(code)).toBe(true);
    expect(OUTBOX_TOPIC_MISSING).toBe('OUTBOX_TOPIC_MISSING');
  });
  it.each([
    -195,
    -187,
    29,
    7,
    0,
    '3',
    '-188',
    null,
    undefined,
    NaN,
    {},
    { code: 3 },
  ])('rejects other codes and values (%s)', (code) => {
    expect(isKafkaTopicMissing(code)).toBe(false);
  });
});
