import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SubscriptionPlansRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /** UC01: các gói đang được cung cấp, rẻ nhất trước. */
  findOffered(tx?: Prisma.TransactionClient) {
    return this.db(tx).subscriptionPlan.findMany({
      where: { isOffered: true },
      orderBy: { price: 'asc' },
    });
  }
}
