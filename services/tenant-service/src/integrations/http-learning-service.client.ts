import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { HEADER_NAMES } from '@learnup/ts-common';
import {
  LearnerEnrollmentSummary,
  LearningServiceClient,
} from './learning-service.client';

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Gọi learning-service thật (LEARNING_CLIENT_MODE=http).
 *
 * Hợp đồng đề xuất (learning-service CHƯA có, cần chốt với Hào):
 *   POST {LEARNING_SERVICE_URL}/api/v1/internal/enrollments/summary-by-learners
 *   Header: x-internal-key + x-user-id, x-organization-id, x-user-role của người gọi
 *   Body:   { learnerIds: string[] }
 *   200:    { statusCode, message, data: { summaries: { [learnerId]: { activeCourseCount, overdueCourseCount } } } }
 *           (data bọc theo TransformInterceptor của learning-service; chỉ đếm Enrollment thuộc x-organization-id)
 */
export class HttpLearningServiceClient extends LearningServiceClient {
  private readonly logger = new Logger(HttpLearningServiceClient.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async summarizeEnrollmentsByLearners(
    user: CurrentUser,
    learnerIds: string[],
  ): Promise<Record<string, LearnerEnrollmentSummary>> {
    if (learnerIds.length === 0) return {};

    const baseUrl = this.config.get<string>('LEARNING_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('Chưa cấu hình LEARNING_SERVICE_URL.');
    }
    if (!user.organizationId) {
      throw new Error('Thiếu organizationId của người gọi.');
    }
    const timeoutMs =
      Number(this.config.get<string>('LEARNING_SERVICE_TIMEOUT_MS')) ||
      DEFAULT_TIMEOUT_MS;

    const response = await fetch(
      `${baseUrl}/api/v1/internal/enrollments/summary-by-learners`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          [HEADER_NAMES.INTERNAL_KEY]: this.config.getOrThrow<string>(
            'INTERNAL_SERVICE_KEY',
          ),
          [HEADER_NAMES.USER_ID]: user.userId,
          [HEADER_NAMES.USER_ROLE]: user.role,
          [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId,
        },
        body: JSON.stringify({ learnerIds }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) {
      throw new Error(`learning-service trả về HTTP ${response.status}.`);
    }

    const body = (await response.json()) as {
      data?: { summaries?: unknown };
    };
    const summaries = body.data?.summaries;
    if (typeof summaries !== 'object' || summaries === null) {
      this.logger.error('Response của learning-service thiếu data.summaries.');
      throw new Error('Response của learning-service sai hợp đồng.');
    }
    return summaries as Record<string, LearnerEnrollmentSummary>;
  }
}
