import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { SubscriptionStatus } from '../../common/constants/tenant.constants';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SignInAccessRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findUserWithOrganization(userId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
  }

  findCurrentSubscription(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ) {
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
      orderBy: { startsAt: 'desc' },
    });
  }
}
