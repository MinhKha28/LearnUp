import { createApiError, type CurrentUser } from '@learnup/ts-common';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  TENANT_CLIENT,
  TenantUnavailableError,
  TenantOrganizationNotFoundError,
  type TenantClient,
} from '../../infrastructure/clients/tenant/tenant.client';
import { serviceUnavailable } from '../../infrastructure/clients/course/service-unavailable';
import { BaseDueAtRepository } from '../enrollments/base-due-at.repository';
import { AssignmentChangesRepository } from './assignment-changes.repository';
import { AssignmentReadsService } from './assignment-reads.service';
import {
  assertExemptible,
  assertExtendable,
  validateExtension,
} from './assignment-change-rules';
import {
  type ExtendAssignmentDto,
  type ExemptAssignmentDto,
  normalizeReason,
} from './change-assignment.dto';

@Injectable()
export class AssignmentChangesService {
  private readonly logger = new Logger(AssignmentChangesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly changes: AssignmentChangesRepository,
    private readonly reads: AssignmentReadsService,
    private readonly deadlines: BaseDueAtRepository,
    @Inject(TENANT_CLIENT) private readonly tenant: TenantClient,
  ) {}

  private async access(user: CurrentUser) {
    if (!user.organizationId)
      throw new ForbiddenException(
        createApiError('FORBIDDEN', 'Tài khoản không thuộc tổ chức.'),
      );
    try {
      const access = await this.tenant.getOrganizationAccess(user);
      if (access.organizationStatus !== 'Active')
        throw this.organizationNotActive();
      if (access.subscriptionStatus !== 'Active')
        throw new ForbiddenException(
          createApiError(
            'SUBSCRIPTION_NOT_ACTIVE',
            'Gói đăng ký của tổ chức chưa hoạt động.',
          ),
        );
      return { organizationId: user.organizationId, timezone: access.timezone };
    } catch (error) {
      if (error instanceof TenantOrganizationNotFoundError)
        throw this.organizationNotActive();
      if (error instanceof TenantUnavailableError) {
        this.logger.warn(error.message);
        throw serviceUnavailable();
      }
      throw error;
    }
  }

  async extend(user: CurrentUser, id: string, dto: ExtendAssignmentDto) {
    const { organizationId, timezone } = await this.access(user);
    await this.deadlines.validateTimezone(timezone);
    await this.prisma.$transaction(async (tx) => {
      const row = await this.changes.lock(tx, organizationId, id);
      if (!row) throw this.notFound();
      assertExtendable(row.status);
      const { now, today } = await this.changes.clock(tx, timezone);
      const newDueAt = await this.deadlines.computeDueAtForDate(
        dto.newDueDate,
        timezone,
        tx,
      );
      const seconds = validateExtension(
        row.dueAt,
        newDueAt,
        dto.newDueDate,
        today,
        row.dueAtHasSubMillisecond,
      );
      await this.changes.extend(
        tx,
        organizationId,
        id,
        newDueAt,
        seconds,
        timezone,
      );
      await this.changes.event(
        tx,
        organizationId,
        row,
        'EnrollmentDueDateExtended',
        now,
        {
          previousDueAt: row.dueAt.toISOString(),
          newDueAt: newDueAt.toISOString(),
          reason: (normalizeReason(dto.reason) as string | undefined) || null,
          actorId: user.userId,
          occurredAt: now.toISOString(),
        },
      );
    });
    return this.reads.detail(user, id);
  }

  async exempt(user: CurrentUser, id: string, dto: ExemptAssignmentDto) {
    const { organizationId, timezone } = await this.access(user);
    try {
      await this.prisma.$transaction(async (tx) => {
        const row = await this.changes.lock(tx, organizationId, id);
        if (!row) throw this.notFound();
        assertExemptible(row.status);
        const { now } = await this.changes.clock(tx, timezone);
        const reason = normalizeReason(dto.reason) as string;
        await this.changes.exempt(tx, organizationId, id, reason, now);
        await this.changes.event(
          tx,
          organizationId,
          row,
          'EnrollmentExempted',
          now,
          {
            reason,
            actorId: user.userId,
            exemptedAt: now.toISOString(),
          },
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          createApiError(
            'ENROLLMENT_NOT_EXEMPTIBLE',
            'Không thể miễn phân công ở trạng thái hiện tại.',
          ),
        );
      throw error;
    }
    return this.reads.detail(user, id);
  }

  private notFound() {
    return new NotFoundException(
      createApiError('ASSIGNMENT_NOT_FOUND', 'Không tìm thấy phân công.'),
    );
  }

  private organizationNotActive(): ForbiddenException {
    return new ForbiddenException(
      createApiError(
        'ORGANIZATION_NOT_ACTIVE',
        'Tổ chức hiện không hoạt động. Vui lòng liên hệ quản trị viên nền tảng.',
      ),
    );
  }
}
