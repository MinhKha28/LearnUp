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

  /** UC43: mọi gói, đang cung cấp trước, rẻ nhất trước. */
  findAll(tx?: Prisma.TransactionClient) {
    return this.db(tx).subscriptionPlan.findMany({
      orderBy: [{ isOffered: 'desc' }, { price: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Số Organization có Subscription hiện hành (Active, Grace, Suspended) theo từng gói. */
  async countOrganizationsByPlan(
    statuses: readonly string[],
    tx?: Prisma.TransactionClient,
  ): Promise<Map<string, number>> {
    const rows = await this.db(tx).subscription.groupBy({
      by: ['planId'],
      where: { status: { in: [...statuses] } },
      _count: { organizationId: true },
    });
    return new Map(rows.map((row) => [row.planId, row._count.organizationId]));
  }

  /** Khóa theo tên gói (không phân biệt hoa thường) tới hết transaction, để hai lượt tạo cùng tên chạy lần lượt. */
  async lockPlanName(name: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${PLAN_NAME_LOCK_NAMESPACE}::int, hashtext(lower(${name})))`;
  }

  findByNameInsensitive(name: string, tx: Prisma.TransactionClient) {
    return tx.subscriptionPlan.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
  }

  create(
    data: Prisma.SubscriptionPlanCreateInput,
    tx: Prisma.TransactionClient,
  ) {
    return tx.subscriptionPlan.create({ data });
  }
}

export const PLAN_NAME_LOCK_NAMESPACE = 2403;
