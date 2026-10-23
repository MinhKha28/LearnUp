import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiResponse, CurrentUser } from '@learnup/ts-common';
import { HEADER_NAMES } from '@learnup/ts-common';
import { EnrolledCourse, EnrollmentClient } from './enrollment.client';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Gọi learning-service thật (ENROLLMENT_CLIENT_MODE=http, là chế độ mặc định).
 *
 *   GET {LEARNING_SERVICE_URL}/api/v1/enrollments/me/course-ids
 *   Header: x-internal-key + x-user-id, x-organization-id, x-user-role của Learner
 *   200:    { statusCode, message, data: [{ courseId, enrollmentId, status? }] } (mọi Enrollment chưa Withdrawn của Learner;
 *           status là trạng thái Enrollment, có từ bản learning-service mới, dùng cho BR-169)
 */
export class HttpEnrollmentClient extends EnrollmentClient {
  private readonly logger = new Logger(HttpEnrollmentClient.name);
  private readonly baseUrl: string;
  private readonly internalKey: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    super();
    this.baseUrl =
      config.get<string>('LEARNING_SERVICE_URL') ?? 'http://localhost:8085';
    this.internalKey = config.getOrThrow<string>('INTERNAL_SERVICE_KEY');
    this.timeoutMs =
      Number(config.get<string>('LEARNING_SERVICE_TIMEOUT_MS')) ||
      DEFAULT_TIMEOUT_MS;
  }

  async findEnrollment(
    courseId: string,
    user: CurrentUser,
  ): Promise<EnrolledCourse | null> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/api/v1/enrollments/me/course-ids`,
        {
          headers: {
            [HEADER_NAMES.INTERNAL_KEY]: this.internalKey,
            [HEADER_NAMES.USER_ID]: user.userId,
            [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId ?? '',
            [HEADER_NAMES.USER_ROLE]: user.role,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
    } catch (error) {
      this.logger.warn(
        `Không gọi được learning-service (${this.baseUrl}): ${(error as Error).message}`,
      );
      throw this.unavailable();
    }
    if (!response.ok) {
      this.logger.warn(`learning-service trả về HTTP ${response.status}.`);
      throw this.unavailable(
        `Learning Service returned HTTP ${response.status}.`,
      );
    }
    const body = (await response.json()) as ApiResponse<EnrolledCourse[]>;
    const found = body.data.find((e) => e.courseId === courseId);
    if (!found) return null;
    return {
      courseId: found.courseId,
      enrollmentId: found.enrollmentId,
      // a status that is not a string is not trusted: the table of Completed Enrollments decides then
      ...(typeof found.status === 'string' ? { status: found.status } : {}),
    };
  }

  /**
   *   POST {LEARNING_SERVICE_URL}/api/v1/internal/enrollments/{enrollmentId}/learning-activity   body: { occurredAt }
   *   Header: như findEnrollment. learning-service chuyển Enrollment NotStarted sang InProgress và ghi thời điểm hoạt động đầu tiên.
   *   200: đã ghi (hoặc Enrollment đã bắt đầu từ trước, không đổi gì).
   */
  async reportLearningActivity(
    enrollmentId: string,
    occurredAt: Date,
    user: CurrentUser,
  ): Promise<void> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/api/v1/internal/enrollments/${enrollmentId}/learning-activity`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [HEADER_NAMES.INTERNAL_KEY]: this.internalKey,
            [HEADER_NAMES.USER_ID]: user.userId,
            [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId ?? '',
            [HEADER_NAMES.USER_ROLE]: user.role,
          },
          body: JSON.stringify({ occurredAt: occurredAt.toISOString() }),
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
    } catch (error) {
      this.logger.warn(
        `Không gọi được learning-service (${this.baseUrl}): ${(error as Error).message}`,
      );
      throw this.unavailable();
    }
    if (!response.ok) {
      this.logger.warn(`learning-service trả về HTTP ${response.status}.`);
      throw this.unavailable(
        `Learning Service returned HTTP ${response.status}.`,
      );
    }
  }

  private unavailable(
    message = 'Learning Service is unavailable. Please try again later.',
  ) {
    return new ServiceUnavailableException({
      code: 'LEARNING_SERVICE_UNAVAILABLE',
      message,
    });
  }
}
