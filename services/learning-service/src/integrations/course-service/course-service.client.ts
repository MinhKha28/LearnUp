import { HEADER_NAMES } from '@learnup/ts-common';
import type { CurrentUser } from '@learnup/ts-common';
import { Logger } from '@nestjs/common';
import type { CourseServiceConfig } from './course-service.config';
import { parseCourseTree, parseLockedCourse } from './course-service.contract';
import {
  CourseNotAvailableError,
  CourseServiceConfigurationError,
  CourseServiceContractError,
  CourseServiceError,
  CourseServiceUnavailableError,
} from './course-service.errors';
import type {
  CourseBatchItem,
  CourseTree,
  LessonContent,
  LockedCourse,
} from './course-service.types';

interface ApiEnvelope {
  data?: unknown;
  error?: unknown;
}

/**
 * Gọi REST nội bộ của course-service (I1–I4), chuyển tiếp người gọi qua header.
 * Không tự retry; lỗi được đổi sang các lớp CourseServiceError để lớp trên quyết định.
 */
export class CourseServiceClient {
  private readonly logger = new Logger(CourseServiceClient.name);

  constructor(private readonly config: CourseServiceConfig) {}

  /** I1: gắn Locked và kiểm Course còn nhận Enrollment. */
  async lockCourse(
    user: CurrentUser,
    courseId: string,
    selfEnroll: boolean,
  ): Promise<LockedCourse> {
    const data = await this.request(user, 'I1 lock', {
      method: 'POST',
      path: `/${encodeURIComponent(courseId)}/lock`,
      body: { selfEnroll },
    });
    return this.parse(() =>
      parseLockedCourse(data, {
        courseId,
        organizationId: this.organizationIdOf(user),
      }),
    );
  }

  /** I2: cây chương trình của một phiên bản. */
  async getCourseTree(
    user: CurrentUser,
    courseId: string,
  ): Promise<CourseTree> {
    const data = await this.request(user, 'I2 tree', {
      method: 'GET',
      path: `/${encodeURIComponent(courseId)}/tree`,
    });
    return this.parse(() => parseCourseTree(data, courseId));
  }

  /** I3: thông tin phiên bản theo lô; ID không thuộc tổ chức bị bỏ qua. */
  async getCoursesBatch(
    user: CurrentUser,
    courseIds: string[],
  ): Promise<CourseBatchItem[]> {
    const data = await this.request(user, 'I3 batch', {
      method: 'POST',
      path: '/batch',
      body: { courseIds },
    });
    return data as CourseBatchItem[];
  }

  /** I4: nội dung một Lesson. */
  async getLesson(
    user: CurrentUser,
    courseId: string,
    lessonId: string,
  ): Promise<LessonContent> {
    const data = (await this.request(user, 'I4 lesson', {
      method: 'GET',
      path: `/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
    })) as Omit<LessonContent, 'disabledAt'> & { disabledAt: string | null };
    return {
      ...data,
      disabledAt: data.disabledAt === null ? null : new Date(data.disabledAt),
    };
  }

  private organizationIdOf(user: CurrentUser): string {
    if (!user.organizationId) {
      throw new CourseServiceError(
        'Thiếu organizationId của người gọi: không thể gọi course-service.',
      );
    }
    return user.organizationId;
  }

  private parse<T>(parse: () => T): T {
    try {
      return parse();
    } catch (error) {
      if (error instanceof CourseServiceContractError) {
        this.logger.error(
          `Response của course-service sai hợp đồng: ${error.message}`,
        );
      }
      throw error;
    }
  }

  private async request(
    user: CurrentUser,
    endpoint: string,
    options: { method: 'GET' | 'POST'; path: string; body?: unknown },
  ): Promise<unknown> {
    const url = `${this.config.baseUrl}/api/v1/internal/courses${options.path}`;
    const headers: Record<string, string> = {
      [HEADER_NAMES.INTERNAL_KEY]: this.config.internalKey,
      [HEADER_NAMES.USER_ID]: user.userId,
      [HEADER_NAMES.USER_ROLE]: user.role,
      [HEADER_NAMES.ORGANIZATION_ID]: this.organizationIdOf(user),
      accept: 'application/json',
    };
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method,
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      const reason = timedOut ? `quá ${this.config.timeoutMs} ms` : 'lỗi mạng';
      this.logger.warn(
        `${endpoint}: course-service không trả lời (${reason}).`,
      );
      throw new CourseServiceUnavailableError(
        `${endpoint}: course-service không trả lời (${reason}).`,
      );
    }

    const body = await this.readBody(response);

    if (response.ok) {
      if (body === null || !('data' in body)) {
        const error = new CourseServiceContractError(
          endpoint,
          'data',
          'không có trong response',
        );
        this.logger.error(
          `Response của course-service sai hợp đồng: ${error.message}`,
        );
        throw error;
      }
      return body.data;
    }

    const { code, message } = this.errorOf(body);
    const detail = `${endpoint}: HTTP ${response.status}${code ? ` ${code}` : ''}`;

    if (
      response.status === 404 ||
      (response.status === 409 && code === 'COURSE_NOT_AVAILABLE')
    ) {
      throw new CourseNotAvailableError(code, message ?? detail);
    }
    if (response.status >= 500) {
      this.logger.warn(`${detail}: course-service lỗi phía server.`);
      throw new CourseServiceUnavailableError(detail);
    }
    if (response.status === 401 || response.status === 403) {
      this.logger.error(
        `${detail}: course-service từ chối khóa nội bộ hoặc user context. Kiểm INTERNAL_SERVICE_KEY của hai service.`,
      );
      throw new CourseServiceConfigurationError(detail);
    }

    this.logger.error(`${detail}: response không mong đợi từ course-service.`);
    throw new CourseServiceError(detail);
  }

  private async readBody(response: Response): Promise<ApiEnvelope | null> {
    try {
      const parsed: unknown = await response.json();
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }

  private errorOf(body: ApiEnvelope | null): {
    code: string | null;
    message: string | null;
  } {
    const error = body?.error;
    if (typeof error === 'object' && error !== null) {
      const { code, message } = error as Record<string, unknown>;
      return {
        code: typeof code === 'string' ? code : null,
        message: typeof message === 'string' ? message : null,
      };
    }
    return { code: null, message: null };
  }
}
