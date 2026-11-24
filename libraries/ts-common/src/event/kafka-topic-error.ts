/** Safe diagnostic shared by outbox relays. */
export const OUTBOX_TOPIC_MISSING = 'OUTBOX_TOPIC_MISSING';

const UNKNOWN_TOPIC_OR_PARTITION = 3;
const LOCAL_UNKNOWN_TOPIC = -188;

/** Match librdkafka numeric codes only; error text is neither stable nor safe. */
export function isKafkaTopicMissing(code: unknown): boolean {
  return code === UNKNOWN_TOPIC_OR_PARTITION || code === LOCAL_UNKNOWN_TOPIC;
}
