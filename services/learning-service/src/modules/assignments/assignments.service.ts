import {
  createApiError,
  STANDARD_ERROR_CODES,
  type CurrentUser,
} from '@learnup/ts-common';
import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  TENANT_CLIENT,
  TenantUnavailableError,
  type TenantClient,
} from '../../infrastructure/clients/tenant/tenant.client';
import { CourseServiceClient } from '../../infrastructure/clients/course/course-service.client';
import {
  CourseNotAvailableError,
  CourseServiceContractError,
  CourseServiceUnavailableError,
  CourseServiceError,
} from '../../infrastructure/clients/course/course-service.errors';
import { serviceUnavailable } from '../../infrastructure/clients/course/service-unavailable';
import { CourseSnapshotPreparationService } from '../course-snapshots/course-snapshot-preparation.service';
import { CourseSnapshotsRepository } from '../course-snapshots/course-snapshots.repository';
import { BaseDueAtRepository } from '../enrollments/base-due-at.repository';
import { PlatformSettingsRepository } from '../platform-settings/platform-settings.repository';
import { AssignmentsRepository } from './assignments.repository';
import { classifyLearners } from './classify-learners';
import { concurrentChange, runAssignmentTransaction } from './assignment-retry';
import type { CreateAssignmentDto } from './create-assignment.dto';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsRepository,
    @Inject(TENANT_CLIENT) private readonly tenant: TenantClient,
    private readonly courses: CourseServiceClient,
    private readonly preparation: CourseSnapshotPreparationService,
    private readonly snapshots: CourseSnapshotsRepository,
    private readonly settings: PlatformSettingsRepository,
    private readonly deadlines: BaseDueAtRepository,
  ) {}

  async assign(user: CurrentUser, dto: CreateAssignmentDto) {
    if (!user.organizationId)
      throw new ForbiddenException(
        createApiError('FORBIDDEN', 'Tài khoản không thuộc tổ chức.'),
      );
    const organizationId = user.organizationId;
    const learnerIds = [
      ...new Set(dto.learnerIds.map((id) => id.toLowerCase())),
    ].sort();
    const courseId = dto.courseId.toLowerCase();
    let access;
    let items;
    try {
      access = await this.tenant.getOrganizationAccess(user);
      if (access.subscriptionStatus !== 'Active')
        throw new ForbiddenException(
          createApiError(
            'SUBSCRIPTION_NOT_ACTIVE',
            'Gói đăng ký của tổ chức chưa hoạt động.',
          ),
        );
      items = await this.tenant.lookupLearners(user, learnerIds);
    } catch (error) {
      if (error instanceof TenantUnavailableError) {
        this.logger.warn(error.message);
        throw serviceUnavailable();
      }
      throw error;
    }
    const existing = await this.assignments.findExisting(
      organizationId,
      courseId,
      learnerIds,
    );
    const initial = classifyLearners(learnerIds, items, existing);
    if (initial.errors.length)
      throw new UnprocessableEntityException({
        ...createApiError(
          'ASSIGNMENT_INVALID_LEARNERS',
          'Danh sách Learner không hợp lệ.',
        ),
        errors: initial.errors,
      });

    const videoCompletionPercent =
      await this.settings.getVideoCompletionPercent();
    if (videoCompletionPercent === null) throw serviceUnavailable();
    await this.deadlines.validateTimezone(access.timezone);
    let lock;
    let snapshotRows;
    try {
      lock = await this.courses.lockCourse(user, courseId, false);
      snapshotRows = await this.preparation.prepare(user, lock);
    } catch (error) {
      if (error instanceof CourseNotAvailableError)
        throw new NotFoundException(
          createApiError(
            'COURSE_NOT_ASSIGNABLE',
            'Course không thể phân công.',
          ),
        );
      if (
        error instanceof CourseServiceUnavailableError ||
        error instanceof CourseServiceContractError
      )
        throw serviceUnavailable();
      if (error instanceof CourseServiceError)
        throw new InternalServerErrorException(
          createApiError(
            STANDARD_ERROR_CODES.INTERNAL_ERROR,
            'Không thể gọi course-service.',
          ),
        );
      throw error;
    }
    const expectedCompletionDays = lock.expectedCompletionDays;
    return runAssignmentTransaction(
      () =>
        this.prisma.$transaction(async (tx) => {
          const assignedAt = await this.assignments.transactionStartedAt(tx);
          const locked = await this.assignments.findExisting(
            organizationId,
            courseId,
            learnerIds,
            tx,
          );
          const { errors, plans } = classifyLearners(learnerIds, items, locked);
          if (errors.length) throw concurrentChange();
          const dueAt = await this.deadlines.computeBaseDueAt(
            assignedAt,
            expectedCompletionDays,
            access.timezone,
            tx,
            true,
          );
          if (snapshotRows)
            await this.snapshots.insertIgnoringConflicts(snapshotRows, tx);
          await this.assignments.write(
            plans,
            {
              organizationId,
              courseId,
              assignedBy: user.userId,
              assignedAt,
              dueAt,
              expectedCompletionDays,
              videoCompletionPercent,
            },
            tx,
          );
          return {
            created: plans.filter((p) => p.kind === 'CREATE').length,
            converted: plans.filter((p) => p.kind === 'CONVERT').length,
            completedOnAssign: plans.filter(
              (p) => p.kind === 'CONVERT_COMPLETED',
            ).length,
            restored: plans.filter((p) => p.kind === 'RESTORE').length,
          };
        }),
      this.logger,
      courseId,
      learnerIds.length,
    );
  }
}
