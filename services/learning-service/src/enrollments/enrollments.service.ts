import {
  createApiError,
  STANDARD_ERROR_CODES,
  type CurrentUser,
} from '@learnup/ts-common';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { buildCourseSnapshotRows } from '../course-snapshots/course-snapshot-rows';
import { CourseSnapshotsRepository } from '../course-snapshots/course-snapshots.repository';
import { CourseServiceClient } from '../integrations/course-service/course-service.client';
import {
  CourseNotAvailableError,
  CourseServiceContractError,
  CourseServiceError,
  CourseServiceUnavailableError,
} from '../integrations/course-service/course-service.errors';
import {
  TENANT_CLIENT,
  TenantUnavailableError,
  type TenantClient,
} from '../integrations/tenant/tenant.client';
import { PlatformSettingsRepository } from '../platform-settings/platform-settings.repository';
import { PrismaService } from '../prisma/prisma.service';
import {
  EnrollmentsRepository,
  type CreatedEnrollment,
} from './enrollments.repository';

const BUSY_MESSAGE = 'Hệ thống đang bận, vui lòng thử lại';

function serviceUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    createApiError('SERVICE_UNAVAILABLE', BUSY_MESSAGE),
  );
}

/** 409 kèm ID Enrollment đã có để client mở thẳng Enrollment đó. */
function alreadyEnrolled(enrollmentId: string): ConflictException {
  return new ConflictException({
    ...createApiError('ALREADY_ENROLLED', 'Bạn đã đăng ký Course này'),
    enrollmentId,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentsRepository,
    private readonly courseSnapshots: CourseSnapshotsRepository,
    private readonly platformSettings: PlatformSettingsRepository,
    private readonly courseService: CourseServiceClient,
    @Inject(TENANT_CLIENT) private readonly tenant: TenantClient,
  ) {}

  /**
   * UC25.3: Learner tự đăng ký Course tự chọn.
   * Kiểm cục bộ và gọi mạng trước, rồi ghi bản sao + Enrollment trong một transaction (thiết kế 4.1).
   */
  async enrollOptional(
    user: CurrentUser,
    courseId: string,
  ): Promise<CreatedEnrollment> {
    const organizationId = this.organizationIdOf(user);

    const existingId = await this.enrollments.findIdByLearnerAndCourse(
      user.userId,
      courseId,
    );
    if (existingId) {
      throw alreadyEnrolled(existingId);
    }

    const videoCompletionPercent =
      await this.platformSettings.getVideoCompletionPercent();
    if (videoCompletionPercent === null) {
      this.logger.error(
        'platform_settings trống: chưa có video_completion_percent, không thể tạo Enrollment.',
      );
      throw serviceUnavailable();
    }

    await this.ensureOrganizationActive(user);

    const lock = await this.callCourseService(() =>
      this.courseService.lockCourse(user, courseId, true),
    );

    const hasSnapshot = await this.courseSnapshots.existsForCourse(
      courseId,
      organizationId,
    );
    const snapshotRows = hasSnapshot
      ? null
      : buildCourseSnapshotRows(
          lock,
          await this.callCourseService(() =>
            this.courseService.getCourseTree(user, courseId),
          ),
          new Date(),
        );

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (snapshotRows) {
          await this.courseSnapshots.insertIgnoringConflicts(snapshotRows, tx);
        }
        // Optional: không có hạn, không lưu expectedCompletionDays của I1; không ghi outbox (D19)
        return this.enrollments.create(
          {
            organizationId,
            learnerId: user.userId,
            courseId,
            enrollmentType: 'Optional',
            status: 'NotStarted',
            videoCompletionPercent,
            assignedAt: null,
            expectedCompletionDays: null,
            baseDueAt: null,
            dueAt: null,
            extensionSeconds: 0,
          },
          tx,
        );
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // Request song song đã tạo trước (D21): transaction đã hủy, đọc bằng truy vấn mới
      const enrollmentId = await this.enrollments.findIdByLearnerAndCourse(
        user.userId,
        courseId,
      );
      if (!enrollmentId) {
        throw error;
      }
      throw alreadyEnrolled(enrollmentId);
    }
  }

  /** D20: courseId Learner đã đăng ký (trừ Withdrawn), để giao diện gắn nhãn. */
  async getMyCourseIds(user: CurrentUser): Promise<string[]> {
    return this.enrollments.findCourseIdsOfLearner(
      user.userId,
      this.organizationIdOf(user),
    );
  }

  /** Chỉ tổ chức Active được đăng ký mới (D18, BR-15). */
  private async ensureOrganizationActive(user: CurrentUser): Promise<void> {
    let subscriptionStatus: string;
    try {
      const access = await this.tenant.getOrganizationAccess(user);
      subscriptionStatus = access.subscriptionStatus;
    } catch (error) {
      if (error instanceof TenantUnavailableError) {
        this.logger.warn(`tenant-service không trả lời: ${error.message}`);
        throw serviceUnavailable();
      }
      throw error;
    }

    if (subscriptionStatus === 'Active') {
      return;
    }
    if (subscriptionStatus === 'Grace') {
      throw new ForbiddenException(
        createApiError(
          'ORGANIZATION_IN_GRACE',
          'Tổ chức của bạn đang trong thời gian ân hạn, chưa thể đăng ký Course mới',
        ),
      );
    }
    this.logger.error(
      `Chặn đăng ký Course: tổ chức ${user.organizationId} có subscriptionStatus "${subscriptionStatus}".`,
    );
    throw new ForbiddenException(
      createApiError(
        STANDARD_ERROR_CODES.FORBIDDEN,
        'Không thể đăng ký Course lúc này',
      ),
    );
  }

  /** Đổi lỗi course-service sang HTTP; client đã ghi log chi tiết. */
  private async callCourseService<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof CourseNotAvailableError) {
        throw new NotFoundException(
          createApiError(
            'COURSE_NOT_AVAILABLE',
            'Course không còn trong danh mục',
          ),
        );
      }
      if (
        error instanceof CourseServiceUnavailableError ||
        error instanceof CourseServiceContractError
      ) {
        throw serviceUnavailable();
      }
      if (error instanceof CourseServiceError) {
        throw new InternalServerErrorException(
          createApiError(
            STANDARD_ERROR_CODES.INTERNAL_ERROR,
            'Đã có lỗi xảy ra, vui lòng thử lại sau',
          ),
        );
      }
      throw error;
    }
  }

  private organizationIdOf(user: CurrentUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException(
        createApiError(
          STANDARD_ERROR_CODES.FORBIDDEN,
          'Tài khoản không thuộc tổ chức nào.',
        ),
      );
    }
    return user.organizationId;
  }
}
