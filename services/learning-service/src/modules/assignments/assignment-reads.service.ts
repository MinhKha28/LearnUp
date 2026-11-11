import type { Prisma } from '../../../generated/prisma/client';
import { createApiError, type CurrentUser } from '@learnup/ts-common';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  TENANT_CLIENT,
  type TenantClient,
} from '../../infrastructure/clients/tenant/tenant.client';
import { CourseServiceClient } from '../../infrastructure/clients/course/course-service.client';
import { EnrollmentsRepository } from '../enrollments/enrollments.repository';
import { AssignmentKeywordSearch } from './assignment-keyword-search.service';
import type { AssignmentListQueryDto } from './assignment-list-query.dto';
import { toSafeNumber } from '../../common/utils/to-safe-number';
import {
  AssignmentReadsRepository,
  type AssignmentRow,
} from './assignment-reads.repository';

@Injectable()
export class AssignmentReadsService {
  private readonly logger = new Logger(AssignmentReadsService.name);
  constructor(
    private readonly assignments: AssignmentReadsRepository,
    private readonly enrollments: EnrollmentsRepository,
    @Inject(TENANT_CLIENT) private readonly tenant: TenantClient,
    private readonly courses: CourseServiceClient,
    private readonly keywords: AssignmentKeywordSearch,
  ) {}

  private organization(user: CurrentUser) {
    if (!user.organizationId)
      throw new ForbiddenException(
        createApiError('FORBIDDEN', 'Tài khoản không thuộc tổ chức.'),
      );
    return user.organizationId;
  }

  async list(user: CurrentUser, query: AssignmentListQueryDto) {
    const organizationId = this.organization(user);
    const { page, status, dueFrom, dueTo } = query;
    if (dueFrom && dueTo && dueFrom > dueTo) {
      throw new BadRequestException(
        createApiError(
          'INVALID_DUE_DATE_RANGE',
          'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
        ),
      );
    }

    const [learnerIds, courseIds] = await Promise.all([
      query.learner
        ? this.keywords.ids(user, 'learner', query.learner)
        : undefined,
      query.course
        ? this.keywords.ids(user, 'course', query.course)
        : undefined,
    ]);
    if (learnerIds?.length === 0 || courseIds?.length === 0)
      return { items: [], page, pageSize: 20, total: 0 };

    const offset = (page - 1) * 20;
    if (learnerIds || courseIds || status || dueFrom || dueTo) {
      const { total, rows } = await this.assignments.filteredPage(
        organizationId,
        offset,
        {
          learnerIds,
          courseIds,
          status,
          dueFrom,
          dueTo,
        },
      );
      return {
        items: await this.enrich(user, rows),
        page,
        pageSize: 20,
        total,
      };
    }

    const total = await this.assignments.count(organizationId);
    const rows =
      offset >= total
        ? []
        : await this.assignments.page(organizationId, offset);
    return { items: await this.enrich(user, rows), page, pageSize: 20, total };
  }

  async detailSnapshot(
    organizationId: string,
    id: string,
    tx?: Prisma.TransactionClient,
  ) {
    const row = await this.assignments.detail(organizationId, id, tx);
    if (!row)
      throw new NotFoundException(
        createApiError('ASSIGNMENT_NOT_FOUND', 'Không tìm thấy phân công.'),
      );
    const intervals = await this.assignments.intervals(organizationId, id, tx);
    return { row, intervals };
  }

  async detail(
    user: CurrentUser,
    id: string,
    snapshot?: Awaited<ReturnType<AssignmentReadsService['detailSnapshot']>>,
  ) {
    const organizationId = this.organization(user);
    const { row, intervals } =
      snapshot ?? (await this.detailSnapshot(organizationId, id));
    const [items, organizationTimezone] = await Promise.all([
      this.enrich(user, [row]),
      this.fallback<string | null>(
        'tenant access',
        async () => (await this.tenant.getOrganizationAccess(user)).timezone,
        null,
      ),
    ]);
    return {
      ...items[0],
      organizationTimezone,
      baseDueAt: row.baseDueAt,
      extensionSeconds: toSafeNumber(row.extensionSeconds),
      firstActivityAt: row.firstActivityAt,
      completedAt: row.completedAt,
      completedLate: row.completedLate,
      withdrawnAt: row.withdrawnAt,
      withdrawnReason: row.withdrawnReason,
      intervals,
    };
  }

  private async fallback<T>(
    source: string,
    call: () => Promise<T>,
    empty: T,
  ): Promise<T> {
    try {
      return await call();
    } catch (error) {
      this.logger.warn(
        `${source}: không thể lấy thông tin phân công (${error instanceof Error ? error.message : String(error)}).`,
      );
      return empty;
    }
  }

  private async enrich(user: CurrentUser, rows: AssignmentRow[]) {
    if (!rows.length) return [];
    const [learners, courses, counts] = await Promise.all([
      this.fallback(
        'tenant lookup',
        () =>
          this.tenant.lookupLearners(user, [
            ...new Set(rows.map((r) => r.learnerId)),
          ]),
        [],
      ),
      this.fallback(
        'I3',
        () =>
          this.courses.getCoursesBatch(user, [
            ...new Set(rows.map((r) => r.courseId)),
          ]),
        [],
      ),
      this.enrollments.countRequiredMaterials(
        rows.map((r) => r.enrollmentId),
        this.organization(user),
      ),
    ]);
    const learnerMap = new Map(learners.map((l) => [l.userId, l]));
    const courseMap = new Map(courses.map((c) => [c.courseId, c]));
    return rows.map((row) => {
      const l = learnerMap.get(row.learnerId);
      const c = courseMap.get(row.courseId);
      const count = counts.get(row.enrollmentId);
      return {
        enrollmentId: row.enrollmentId,
        learner: l
          ? {
              id: l.userId,
              fullName: l.fullName,
              email: l.email,
              status: l.status,
              activatedAt: l.activatedAt,
              deletedAt: l.deletedAt,
            }
          : null,
        course: c
          ? { id: c.courseId, title: c.name, versionNumber: c.versionNumber }
          : null,
        assignedAt: row.assignedAt,
        dueAt: row.dueAt,
        dueTimezone: row.dueTimezone,
        status: row.status,
        requiredCompleted: count?.completed ?? 0,
        requiredTotal: count?.total ?? 0,
      };
    });
  }
}
