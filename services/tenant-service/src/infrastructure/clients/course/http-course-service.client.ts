import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { HEADER_NAMES } from '@learnup/ts-common';
import { CourseServiceClient } from './course-service.client';
import type { IManagedCourseChain } from './interfaces/managed-course-chain.interface';
import type { IOrganizationCourseUsage } from './interfaces/organization-course-usage.interface';

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Gọi course-service thật (COURSE_CLIENT_MODE=http).
 *
 * Hợp đồng đề xuất (course-service CHƯA có, cần chốt với người làm course-service):
 *   POST {COURSE_SERVICE_URL}/api/v1/internal/course-chains/count-by-instructors
 *   Header: x-internal-key + x-user-id, x-organization-id, x-user-role của người gọi
 *   Body:   { instructorIds: string[] }
 *   200:    { statusCode, message, data: { counts: { [instructorId]: number } } }
 *           (data bọc theo TransformInterceptor của course-service; chỉ đếm chuỗi thuộc x-organization-id)
 */
export class HttpCourseServiceClient extends CourseServiceClient {
  private readonly logger = new Logger(HttpCourseServiceClient.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async countCourseChainsByInstructors(
    user: CurrentUser,
    instructorIds: string[],
  ): Promise<Record<string, number>> {
    if (instructorIds.length === 0) return {};

    const baseUrl = this.config.get<string>('COURSE_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('Chưa cấu hình COURSE_SERVICE_URL.');
    }
    if (!user.organizationId) {
      throw new Error('Thiếu organizationId của người gọi.');
    }
    const timeoutMs =
      Number(this.config.get<string>('COURSE_SERVICE_TIMEOUT_MS')) ||
      DEFAULT_TIMEOUT_MS;

    const response = await fetch(
      `${baseUrl}/api/v1/internal/course-chains/count-by-instructors`,
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
        body: JSON.stringify({ instructorIds }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) {
      throw new Error(`course-service trả về HTTP ${response.status}.`);
    }

    const body = (await response.json()) as {
      data?: { counts?: unknown };
    };
    const counts = body.data?.counts;
    if (typeof counts !== 'object' || counts === null) {
      this.logger.error('Response của course-service thiếu data.counts.');
      throw new Error('Response của course-service sai hợp đồng.');
    }
    return counts as Record<string, number>;
  }

  /**
   * UC12.1. Hợp đồng đề xuất (course-service CHƯA có):
   *   GET {COURSE_SERVICE_URL}/api/v1/internal/course-chains/by-instructor/:instructorId
   *   Header: như countCourseChainsByInstructors
   *   200:    { statusCode, message, data: { chains: [{ chainId, courseId, name, versionNumber,
   *           status, courseType, approvedAt }] } } — chỉ chuỗi thuộc x-organization-id,
   *           mỗi chuỗi một phần tử, đại diện bằng phiên bản hiện hành (BR-336).
   */
  async listCourseChainsByInstructor(
    user: CurrentUser,
    instructorId: string,
  ): Promise<IManagedCourseChain[]> {
    const baseUrl = this.config.get<string>('COURSE_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('Chưa cấu hình COURSE_SERVICE_URL.');
    }
    if (!user.organizationId) {
      throw new Error('Thiếu organizationId của người gọi.');
    }
    const timeoutMs =
      Number(this.config.get<string>('COURSE_SERVICE_TIMEOUT_MS')) ||
      DEFAULT_TIMEOUT_MS;

    const response = await fetch(
      `${baseUrl}/api/v1/internal/course-chains/by-instructor/${encodeURIComponent(instructorId)}`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          [HEADER_NAMES.INTERNAL_KEY]: this.config.getOrThrow<string>(
            'INTERNAL_SERVICE_KEY',
          ),
          [HEADER_NAMES.USER_ID]: user.userId,
          [HEADER_NAMES.USER_ROLE]: user.role,
          [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId,
        },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) {
      throw new Error(`course-service trả về HTTP ${response.status}.`);
    }

    const body = (await response.json()) as {
      data?: { chains?: unknown };
    };
    const chains = body.data?.chains;
    if (!Array.isArray(chains)) {
      this.logger.error('Response của course-service thiếu data.chains.');
      throw new Error('Response của course-service sai hợp đồng.');
    }
    // Chỉ chép các trường của hợp đồng; approvedAt là chuỗi ISO trong JSON.
    return (chains as Array<Record<string, unknown>>).map((chain) => ({
      chainId: String(chain.chainId),
      courseId: String(chain.courseId),
      name: String(chain.name),
      versionNumber: Number(chain.versionNumber),
      status: String(chain.status),
      courseType: String(chain.courseType),
      approvedAt:
        typeof chain.approvedAt === 'string'
          ? new Date(chain.approvedAt)
          : null,
    }));
  }

  async getOrganizationUsage(
    user: CurrentUser,
  ): Promise<IOrganizationCourseUsage> {
    const baseUrl = this.config.get<string>('COURSE_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('Chưa cấu hình COURSE_SERVICE_URL.');
    }
    if (!user.organizationId) {
      throw new Error('Thiếu organizationId của người gọi.');
    }
    const timeoutMs =
      Number(this.config.get<string>('COURSE_SERVICE_TIMEOUT_MS')) ||
      DEFAULT_TIMEOUT_MS;

    const response = await fetch(
      `${baseUrl}/api/v1/internal/organizations/${encodeURIComponent(user.organizationId)}/usage`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          [HEADER_NAMES.INTERNAL_KEY]: this.config.getOrThrow<string>(
            'INTERNAL_SERVICE_KEY',
          ),
          [HEADER_NAMES.USER_ID]: user.userId,
          [HEADER_NAMES.USER_ROLE]: user.role,
          [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId,
        },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) {
      throw new Error(`course-service trả về HTTP ${response.status}.`);
    }

    const body = (await response.json()) as {
      data?: Partial<IOrganizationCourseUsage>;
    };
    const courseChains = Number(body.data?.courseChains);
    const storageBytes = Number(body.data?.storageBytes);
    if (!Number.isFinite(courseChains) || !Number.isFinite(storageBytes)) {
      throw new Error('Response của course-service sai hợp đồng.');
    }
    return { courseChains, storageBytes };
  }
}
