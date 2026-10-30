import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import {
  PaymentStatus,
  SubscriptionStatus,
} from '../../common/constants/tenant.constants';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const RENEWAL_LOCK_NAMESPACE = 2404;

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

  /** Khóa theo tổ chức tới hết transaction: một lượt gia hạn của tổ chức chạy tại một thời điểm, không chờ. */
  async tryLockRenewal(
    organizationId: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(${RENEWAL_LOCK_NAMESPACE}::int, hashtext(${organizationId})) AS locked`;
    return rows[0]?.locked === true;
  }

  findRenewalContext(organizationId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).organization.findUnique({
      where: { id: organizationId },
      select: { id: true, status: true },
    });
  }

  findCurrentWithPlan(organizationId: string, tx?: Prisma.TransactionClient) {
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
      include: { plan: true },
      orderBy: { startsAt: 'desc' },
    });
  }

  createPayment(
    data: Prisma.PaymentUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).payment.create({ data });
  }

  markPaymentFailed(paymentId: string, failureReason: string | null) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.Failed, failureReason },
    });
  }

  markPaymentSucceeded(
    paymentId: string,
    data: {
      paidAt: Date;
      subscriptionId: string;
      providerReference: string | null;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.Succeeded, ...data },
    });
  }

  endSubscription(id: string, endedAt: Date, tx: Prisma.TransactionClient) {
    return tx.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.Ended, endedAt },
    });
  }

  createSubscription(
    data: Prisma.SubscriptionUncheckedCreateInput,
    tx: Prisma.TransactionClient,
  ) {
    return tx.subscription.create({ data });
  }

  /** Job: kỳ Scheduled đã tới ngày bắt đầu, cũ nhất trước. SKIP LOCKED: dòng instance khác đang giữ thì bỏ qua. */
  async claimDueScheduled(tx: Prisma.TransactionClient, excludeIds: string[]) {
    const rows = await tx.$queryRaw<
      Array<{ id: string; organizationId: string }>
    >`
      SELECT id, organization_id AS "organizationId"
      FROM subscriptions
      WHERE status = ${SubscriptionStatus.Scheduled}
        AND starts_at <= now()
        AND NOT (id = ANY(${excludeIds}::uuid[]))
      ORDER BY starts_at, id
      LIMIT 1
      FOR UPDATE SKIP LOCKED`;
    return rows[0] ?? null;
  }

  endCurrent(
    organizationId: string,
    endedAt: Date,
    tx: Prisma.TransactionClient,
  ) {
    return tx.subscription.updateMany({
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
      data: { status: SubscriptionStatus.Ended, endedAt },
    });
  }

  activateScheduled(id: string, tx: Prisma.TransactionClient) {
    return tx.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.Active },
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
