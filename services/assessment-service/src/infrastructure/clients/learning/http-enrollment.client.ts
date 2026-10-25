import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { HEADER_NAMES } from '@learnup/ts-common';
import {
  ASSESSMENT_ACCESS_LEVELS,
  type AssessmentAccess,
  type AssessmentAccessLevel,
  EnrollmentClient,
} from './enrollment.client';

const DEFAULT_TIMEOUT_MS = 2000;
const NOT_FOUND_CODE = 'ENROLLMENT_NOT_FOUND';

/**
 * Gọi learning-service thật (ENROLLMENT_CLIENT_MODE=http, là chế độ mặc định).
 *
 *   GET {LEARNING_SERVICE_URL}/api/v1/internal/enrollments/assessment-access?learnerId=&courseId=
 *   Header: x-internal-key + x-user-id, x-organization-id, x-user-role của Learner (guard của learning bắt đủ các header này)
 *   200:    { statusCode, message, data: { enrollmentId, status, access: Full | ReadOnly | None } }
 *   404:    error.code = ENROLLMENT_NOT_FOUND (chưa Enroll Course này, hoặc Enrollment thuộc Organization khác)
 *
 * Hợp đồng: contracts/openapi/learning-service.yaml. Timeout mặc định 2000 ms (chỉnh qua LEARNING_SERVICE_TIMEOUT_MS):
 * Learner đang chờ, và p99 đo được ở learning là dưới 300 ms.
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

  async getAssessmentAccess(
    courseId: string,
    user: CurrentUser,
  ): Promise<AssessmentAccess | null> {
    const query = new URLSearchParams({ learnerId: user.userId, courseId });
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/api/v1/internal/enrollments/assessment-access?${query.toString()}`,
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

    if (
      response.status === 404 &&
      (await this.errorCode(response)) === NOT_FOUND_CODE
    ) {
      return null;
    }
    if (!response.ok) {
      this.logger.warn(`learning-service trả về HTTP ${response.status}.`);
      throw this.unavailable(
        `Learning Service returned HTTP ${response.status}.`,
      );
    }
    return this.parse(await response.json().catch(() => undefined));
  }

  /** error.code of an error answer; other 404s (for example a learning-service without this route) are not "not enrolled". */
  private async errorCode(response: Response): Promise<string | undefined> {
    const body = (await response.json().catch(() => undefined)) as
      { error?: { code?: unknown } } | undefined;
    const code = body?.error?.code;
    return typeof code === 'string' ? code : undefined;
  }

  /** An answer that does not have the agreed shape is not trusted: the caller is refused with 503. */
  private parse(body: unknown): AssessmentAccess {
    const data = (body as { data?: Record<string, unknown> } | undefined)?.data;
    const level = data?.access;
    if (
      !data ||
      typeof data.enrollmentId !== 'string' ||
      typeof data.status !== 'string' ||
      typeof level !== 'string' ||
      !(ASSESSMENT_ACCESS_LEVELS as readonly string[]).includes(level)
    ) {
      this.logger.warn(
        'learning-service trả về câu trả lời quyền làm bài sai dạng.',
      );
      throw this.unavailable('Learning Service returned an unexpected answer.');
    }
    return {
      enrollmentId: data.enrollmentId,
      status: data.status,
      access: level as AssessmentAccessLevel,
    };
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
