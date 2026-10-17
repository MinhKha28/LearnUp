import {
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiResponse, CurrentUser } from '@learnup/ts-common';
import { HEADER_NAMES } from '@learnup/ts-common';
import {
  CourseAuthoringContext,
  CourseServiceClient,
} from './course-service.client';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Gọi course-service thật (COURSE_CLIENT_MODE=http, là chế độ mặc định).
 *
 *   GET {COURSE_SERVICE_URL}/api/v1/courses/{courseId}/authoring-context
 *   Header: x-internal-key + x-user-id, x-organization-id, x-user-role của người gọi
 *   200:    { statusCode, message, data: CourseAuthoringContext }
 *           (data bọc theo TransformInterceptor; course-service chỉ trả Course thuộc x-organization-id)
 *   404:    Course không tồn tại (hoặc thuộc tổ chức khác)
 */
export class HttpCourseServiceClient extends CourseServiceClient {
  private readonly logger = new Logger(HttpCourseServiceClient.name);
  private readonly baseUrl: string;
  private readonly internalKey: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    super();
    this.baseUrl =
      config.get<string>('COURSE_SERVICE_URL') ?? 'http://localhost:8083';
    this.internalKey = config.getOrThrow<string>('INTERNAL_SERVICE_KEY');
    this.timeoutMs =
      Number(config.get<string>('COURSE_SERVICE_TIMEOUT_MS')) ||
      DEFAULT_TIMEOUT_MS;
  }

  async getAuthoringContext(
    courseId: string,
    user: CurrentUser,
  ): Promise<CourseAuthoringContext> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/api/v1/courses/${courseId}/authoring-context`,
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
        `Không gọi được course-service (${this.baseUrl}): ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: 'COURSE_SERVICE_UNAVAILABLE',
        message: 'Course Service is unavailable. Please try again later.',
      });
    }

    if (response.status === 404) {
      throw new NotFoundException({
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found.',
      });
    }
    if (!response.ok) {
      this.logger.warn(`course-service trả về HTTP ${response.status}.`);
      throw new ServiceUnavailableException({
        code: 'COURSE_SERVICE_UNAVAILABLE',
        message: `Course Service returned HTTP ${response.status}.`,
      });
    }
    const body = (await response.json()) as ApiResponse<CourseAuthoringContext>;
    return body.data;
  }

  /**
   *   GET {COURSE_SERVICE_URL}/api/v1/internal/courses/{courseId}/tree
   *   Header: như getAuthoringContext. course-service chỉ lọc theo x-organization-id (không kiểm người phụ trách).
   *   200:    data = CourseTreeDto, chỉ dùng modules[].id
   *   404:    Course không tồn tại (hoặc thuộc tổ chức khác)
   */
  async getModuleIds(courseId: string, user: CurrentUser): Promise<string[]> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/api/v1/internal/courses/${courseId}/tree`,
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
        `Không gọi được course-service (${this.baseUrl}): ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: 'COURSE_SERVICE_UNAVAILABLE',
        message: 'Course Service is unavailable. Please try again later.',
      });
    }

    if (response.status === 404) {
      throw new NotFoundException({
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found.',
      });
    }
    if (!response.ok) {
      this.logger.warn(`course-service trả về HTTP ${response.status}.`);
      throw new ServiceUnavailableException({
        code: 'COURSE_SERVICE_UNAVAILABLE',
        message: `Course Service returned HTTP ${response.status}.`,
      });
    }
    const body = (await response.json()) as ApiResponse<{
      modules: { id: string }[];
    }>;
    return body.data.modules.map((module) => module.id);
  }

  /**
   *   POST {COURSE_SERVICE_URL}/api/v1/internal/courses/{courseId}/assignment-minutes   body: { minutes }
   *   Header: như getAuthoringContext. course-service ghi assignment_minutes của Course thuộc x-organization-id.
   *   200:    đã ghi. 404: Course không tồn tại (hoặc thuộc tổ chức khác).
   */
  async setAssignmentMinutes(
    courseId: string,
    minutes: number,
    user: CurrentUser,
  ): Promise<void> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/api/v1/internal/courses/${courseId}/assignment-minutes`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [HEADER_NAMES.INTERNAL_KEY]: this.internalKey,
            [HEADER_NAMES.USER_ID]: user.userId,
            [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId ?? '',
            [HEADER_NAMES.USER_ROLE]: user.role,
          },
          body: JSON.stringify({ minutes }),
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
    } catch (error) {
      this.logger.warn(
        `Không gọi được course-service (${this.baseUrl}): ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: 'COURSE_SERVICE_UNAVAILABLE',
        message: 'Course Service is unavailable. Please try again later.',
      });
    }
    if (response.status === 404) {
      throw new NotFoundException({
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found.',
      });
    }
    if (!response.ok) {
      this.logger.warn(`course-service trả về HTTP ${response.status}.`);
      throw new ServiceUnavailableException({
        code: 'COURSE_SERVICE_UNAVAILABLE',
        message: `Course Service returned HTTP ${response.status}.`,
      });
    }
  }
}
