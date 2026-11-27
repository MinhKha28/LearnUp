import {
  isKafkaTopicMissing,
  OUTBOX_TOPIC_MISSING,
} from './kafka-topic-error.js';

/** Safe diagnostic for an error that carries no numeric Kafka code. */
export const OUTBOX_UNKNOWN = 'OUTBOX_UNKNOWN';

/** Prefix of the diagnostic for a numeric librdkafka code, for example `KAFKA_-195`. */
const KAFKA_CODE_PREFIX = 'KAFKA_';

// librdkafka codes that say the message itself is the problem, not the broker.
const ERR_INVALID_MSG = 2;
const ERR_INVALID_MSG_SIZE = 4;
const ERR_MSG_SIZE_TOO_LARGE = 10;
const ERR_VALUE_SERIALIZATION = -161;
const ERR_KEY_SERIALIZATION = -162;

const MESSAGE_ERROR_CODES = new Set<number>([
  ERR_INVALID_MSG,
  ERR_INVALID_MSG_SIZE,
  ERR_MSG_SIZE_TOO_LARGE,
  ERR_VALUE_SERIALIZATION,
  ERR_KEY_SERIALIZATION,
]);

/**
 * How an outbox relay treats a failed Kafka call.
 * `code` is a fixed diagnostic for `last_error` and logs, never the error text.
 * `individual` is true when the failure belongs to the message rather than the broker,
 * so the relay retries the other rows of the batch one by one instead of backing off all of them.
 */
export interface KafkaRelayErrorClassification {
  code: string;
  individual: boolean;
}

/** Classify an unknown relay error by its numeric librdkafka code only; error text is neither stable nor safe. */
export function classifyKafkaRelayError(
  error: unknown,
): KafkaRelayErrorClassification {
  const kafkaCode = readErrorCode(error);
  if (isKafkaTopicMissing(kafkaCode)) {
    return { code: OUTBOX_TOPIC_MISSING, individual: false };
  }
  if (typeof kafkaCode === 'number' && Number.isInteger(kafkaCode)) {
    return {
      code: `${KAFKA_CODE_PREFIX}${kafkaCode}`,
      individual: MESSAGE_ERROR_CODES.has(kafkaCode),
    };
  }
  return { code: OUTBOX_UNKNOWN, individual: false };
}

function readErrorCode(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  if (!('code' in error)) return undefined;
  return error.code;
}
