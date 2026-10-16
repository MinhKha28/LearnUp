import { createApiError, type CurrentUser } from '@learnup/ts-common';
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  TENANT_CLIENT,
  TenantUnavailableError,
  type TenantClient,
} from '../../infrastructure/clients/tenant/tenant.client';
import { serviceUnavailable } from '../../infrastructure/clients/course/service-unavailable';
import { BaseDueAtRepository } from '../enrollments/base-due-at.repository';
import { AssignmentChangesRepository } from './assignment-changes.repository';
import { AssignmentReadsService } from './assignment-reads.service';
import { assertExtendable, validateExtension } from './assignment-change-rules';
import {
  type ExtendAssignmentDto,
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
      if (access.subscriptionStatus !== 'Active')
        throw new ForbiddenException(
          createApiError(
            'SUBSCRIPTION_NOT_ACTIVE',
            'Gói đăng ký của tổ chức chưa hoạt động.',
          ),
        );
      return { organizationId: user.organizationId, timezone: access.timezone };
    } catch (error) {
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
      );
      await this.changes.extend(tx, organizationId, id, newDueAt, seconds);
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

  private notFound() {
    return new NotFoundException(
      createApiError('ASSIGNMENT_NOT_FOUND', 'Không tìm thấy phân công.'),
    );
  }
}
