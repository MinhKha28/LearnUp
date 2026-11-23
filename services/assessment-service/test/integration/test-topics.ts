/**
 * Typed access to the shared CommonJS helper that creates isolated test topics with the shapes of the topic manifest
 * (infrastructure/kafka/topics.tsv). createRequire keeps the import lint-clean, as in course-values.learning-test.ts.
 */
import { createRequire } from 'node:module';
import type { KafkaJS } from '@confluentinc/kafka-javascript';

type Admin = KafkaJS.Admin;

/** The manifest IDs of the three topics the assessment relay writes to. */
export type RelayTopicId =
  'assessment-status' | 'peer-review-assigned' | 'submission-finalized';

export interface TopicShape {
  id: string;
  name: string;
  partitions: number;
  replicationFactor: number;
}

/** Plain functions of a CommonJS module: none of them uses `this`, so they can be destructured. */
interface TestTopicsHelper {
  shape: (id: RelayTopicId) => TopicShape;
  createTestTopics: (
    admin: Admin,
    names: Record<RelayTopicId, string>,
  ) => Promise<void>;
  describeTestTopics: (
    admin: Admin,
    topics: string[],
  ) => ReturnType<Admin['fetchTopicMetadata']>;
}

const TEST_TOPICS_HELPER_PATH =
  '../../../../infrastructure/kafka/test-topics.cjs';
const requireFromHere = createRequire(__filename);

export const testTopics = requireFromHere(
  TEST_TOPICS_HELPER_PATH,
) as TestTopicsHelper;
