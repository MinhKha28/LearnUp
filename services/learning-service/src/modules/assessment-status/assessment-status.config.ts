export const ASSESSMENT_STATUS_CONFIG = Symbol('ASSESSMENT_STATUS_CONFIG');
export function readAssessmentStatusConfig(
  get: (key: string) => string | undefined,
) {
  const enabled = get('ASSESSMENT_CONSUMER_ENABLED') ?? 'false';
  if (!['true', 'false'].includes(enabled))
    throw new Error('Invalid ASSESSMENT_CONSUMER_ENABLED');
  const brokers = (get('KAFKA_BROKERS') ?? 'localhost:9092')
    .split(',')
    .map((b) => b.trim());
  const topic =
    get('ASSESSMENT_CONSUMER_TOPIC') ??
    'learnup.assessment.learner-assessment-events';
  const groupId =
    get('ASSESSMENT_CONSUMER_GROUP_ID') ?? 'learning-assessment-status-v1';
  if (
    brokers.some((b) => !b) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,248}$/.test(topic) ||
    !groupId.trim()
  )
    throw new Error('Invalid assessment consumer Kafka configuration');
  return { enabled: enabled === 'true', brokers, topic, groupId };
}
export type AssessmentStatusConfig = ReturnType<
  typeof readAssessmentStatusConfig
>;
