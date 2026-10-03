import {
  createApiError,
  createPageResponse,
  HEADER_NAMES,
  STANDARD_ERROR_CODES,
  type CurrentUser,
  type PageResponse,
} from '@learnup/ts-common';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Prisma } from '../../../generated/prisma/client';
import { buildCourseSnapshotRows } from '../course-snapshots/course-snapshot-rows';
import { CourseSnapshotsRepository } from '../course-snapshots/course-snapshots.repository';
import { CourseServiceClient } from '../../infrastructure/integrations/course-service/course-service.client';
import {
  CourseNotAvailableError,
  CourseServiceContractError,
  CourseServiceError,
  CourseServiceUnavailableError,
} from '../../infrastructure/integrations/course-service/course-service.errors';
import type { CourseBatchItem } from '../../infrastructure/integrations/course-service/course-service.interface';
import { serviceUnavailable } from '../../infrastructure/integrations/course-service/service-unavailable';
import { OrganizationTimezoneService } from '../../infrastructure/integrations/tenant/organization-timezone.service';
import {
  TENANT_CLIENT,
  TenantUnavailableError,
  type TenantClient,
} from '../../infrastructure/integrations/tenant/tenant.client';
import { PlatformSettingsRepository } from '../platform-settings/platform-settings.repository';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import {
  EnrollmentsRepository,
  type CreatedEnrollment,
  type EnrolledCourseRef,
  type MyEnrollmentRow,
} from './enrollments.repository';

/** D6, D36: UC26 cố định 20 dòng một trang. */
export const MY_ENROLLMENTS_PAGE_SIZE = 20;

/** Một dòng UC26; không thêm trường nào ngoài danh sách đã chốt. */
export interface MyEnrollmentItem {
  enrollmentId: string;
  courseId: string;
  enrollmentType: string;
  status: string;
  dueAt: string | null;
  requiredMaterials: { completed: number; total: number };
  course: {
    name: string;
    versionNumber: number;
    coverFileId: string | null;
  } | null;
}

export interface MyEnrollmentsPage extends PageResponse<MyEnrollmentItem> {
  organizationTimezone: string | null;
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
    private readonly organizationTimezone: OrganizationTimezoneService,
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

  /** D20, D48: Course Learner đã đăng ký kèm enrollmentId (trừ Withdrawn), để gắn nhãn và mở UC27. */
  async getMyCourseIds(user: CurrentUser): Promise<EnrolledCourseRef[]> {
    return this.enrollments.findCourseIdsOfLearner(
      user.userId,
      this.organizationIdOf(user),
    );
  }

  /**
   * UC26: Course của tôi. Đếm trước; trang rỗng hoặc vượt tổng thì trả ngay, không chạy truy vấn danh sách,
   * không gọi I3 hay tenant. I3 và tenant chạy song song; tenant chỉ gọi khi trang có Required có hạn (D24).
   */
  async findMyEnrollments(
    user: CurrentUser,
    page: number,
  ): Promise<MyEnrollmentsPage> {
    const organizationId = this.organizationIdOf(user);
    const pageSize = MY_ENROLLMENTS_PAGE_SIZE;
    const emptyPage = (total: number): MyEnrollmentsPage => ({
      ...createPageResponse<MyEnrollmentItem>([], page, pageSize, total),
      organizationTimezone: null,
    });
    // Header không phải UUID thì không thể có Enrollment nào
    const invalidHeaders = [
      [HEADER_NAMES.USER_ID, user.userId],
      [HEADER_NAMES.ORGANIZATION_ID, organizationId],
    ].filter(([, value]) => !isUUID(value, 'all'));
    if (invalidHeaders.length > 0) {
      for (const [header, value] of invalidHeaders) {
        this.logger.warn(
          `UC26: header ${header} không phải UUID ("${value.slice(0, 64)}"); trả danh sách rỗng.`,
        );
      }
      return emptyPage(0);
    }

    const total = await this.enrollments.countMine(user.userId, organizationId);
    const offset = (page - 1) * pageSize;
    if (offset >= total) {
      return emptyPage(total);
    }

    const rows = await this.enrollments.findMinePage(
      user.userId,
      organizationId,
      pageSize,
      offset,
    );
    // Dòng bị xóa giữa lúc đếm và lúc đọc trang
    if (rows.length === 0) {
      return emptyPage(total);
    }
    const counts = await this.enrollments.countRequiredMaterials(
      rows.map((row) => row.id),
      organizationId,
    );
    const hasRequiredDeadline = rows.some(
      (row) => row.enrollmentType === 'Required' && row.dueAt !== null,
    );
    const [courses, organizationTimezone] = await Promise.all([
      this.callCourseService(() =>
        this.courseService.getCoursesBatch(user, [
          ...new Set(rows.map((row) => row.courseId)),
        ]),
      ),
      hasRequiredDeadline
        ? this.organizationTimezone.getTimezone(user)
        : Promise.resolve(null),
    ]);

    const courseById = new Map(courses.map((c) => [c.courseId, c]));
    const items = rows.map((row) =>
      this.toMyEnrollmentItem(
        row,
        courseById.get(row.courseId),
        counts.get(row.id),
      ),
    );
    return {
      ...createPageResponse(items, page, pageSize, total),
      organizationTimezone,
    };
  }

  private toMyEnrollmentItem(
    row: MyEnrollmentRow,
    course: CourseBatchItem | undefined,
    count: { completed: number; total: number } | undefined,
  ): MyEnrollmentItem {
    if (!course) {
      // D26: vẫn hiện dòng để Learner không mất Enrollment Required
      this.logger.error(
        `I3 không trả Course ${row.courseId} của Enrollment ${row.id}; trả course: null.`,
      );
    }
    return {
      enrollmentId: row.id,
      courseId: row.courseId,
      enrollmentType: row.enrollmentType,
      status: row.status,
      dueAt: row.dueAt ? row.dueAt.toISOString() : null,
      requiredMaterials: count ?? { completed: 0, total: 0 },
      course: course
        ? {
            name: course.name,
            versionNumber: course.versionNumber,
            coverFileId: course.coverFileId,
          }
        : null,
    };
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

  async getCourseLearnerCounts(user: CurrentUser, courseIds: string[]) {
    if (user.role !== 'ORGANIZER') {
      throw new ForbiddenException(
        'Only Organizer can retrieve Course learner counts.',
      );
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    const groups = await this.prisma.enrollment.groupBy({
      by: ['courseId'],
      where: {
        organizationId: user.organizationId,
        courseId: {
          in: courseIds,
        },
        status: 'InProgress',
      },
      _count: {
        _all: true,
      },
    });

    const countMap = new Map(
      groups.map((item) => [item.courseId, item._count._all]),
    );

    return courseIds.map((courseId) => ({
      courseId,
      learnerCount: countMap.get(courseId) ?? 0,
    }));
  }
}
