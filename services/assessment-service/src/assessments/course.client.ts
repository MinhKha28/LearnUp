import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiResponse, CurrentUser } from '@learnup/ts-common';
import { HEADER_NAMES } from '@learnup/ts-common';

export interface CourseAuthoringContext {
  courseId: string;
  organizationId: string;
  instructorId: string;
  status: string;
  locked: boolean;
  disabled: boolean;
}

/**
 * Assessment does not own Course structure, lifecycle or Lock (architecture §3.5),
 * so it asks Course Service over REST — an immediate answer is needed (ADR 0004).
 */
@Injectable()
export class CourseClient {
  private readonly baseUrl: string;
  private readonly internalKey: string;

  constructor(config: ConfigService) {
    this.baseUrl =
      config.get<string>('COURSE_SERVICE_URL') ?? 'http://localhost:8083';
    this.internalKey = config.getOrThrow<string>('INTERNAL_SERVICE_KEY');
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
          signal: AbortSignal.timeout(5000),
        },
      );
    } catch {
      throw new ServiceUnavailableException('Course Service is unavailable.');
    }

    if (response.status === 404)
      throw new NotFoundException('Course not found.');
    if (!response.ok) {
      throw new ServiceUnavailableException('Course Service is unavailable.');
    }
    const body = (await response.json()) as ApiResponse<CourseAuthoringContext>;
    return body.data;
  }
}
