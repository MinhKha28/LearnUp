import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { SubscriptionStatus } from '../../common/constants/tenant.constants';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SubscriptionsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findOrganization(organizationId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
  }

  findCurrent(organizationId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).subscription.findFirst({
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
      include: { plan: { select: { name: true } } },
      orderBy: { startsAt: 'desc' },
    });
  }

  findScheduled(organizationId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).subscription.findFirst({
      where: { organizationId, status: SubscriptionStatus.Scheduled },
      include: { plan: { select: { name: true } } },
      orderBy: { startsAt: 'asc' },
    });
  }

  countSeats(
    organizationId: string,
    role: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).user.count({
      where: { organizationId, role, deletedAt: null },
    });
  }
}
