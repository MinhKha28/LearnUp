import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '../../common/constants/tenant.constants';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class InternalOrganizationsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findOrganization(organizationId: string) {
    return this.db().organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        status: true,
        timezone: true,
        logoFileKey: true,
      },
    });
  }

  /** Subscription hiện hành: mỗi tổ chức có tối đa một dòng Active, Grace hoặc Suspended (chỉ mục một phần). */
  findCurrentSubscription(organizationId: string) {
    return this.db().subscription.findFirst({
      where: {
        organizationId,
        status: {
          in: [
            SubscriptionStatus.Active,
            SubscriptionStatus.Grace,
            SubscriptionStatus.Suspended,
          ],
        },
      },
      orderBy: { startsAt: 'desc' },
      select: { status: true, readOnlyEndsAt: true, suspendedAt: true },
    });
  }
}
