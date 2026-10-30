import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SubscriptionsRepository } from './subscriptions.repository';

export const ACTIVATION_BATCH_SIZE = 20;
export const STALE_PAYMENT_AFTER_MS = 10 * 60 * 1000;

/**
 * BR-17: kỳ gia hạn sớm bắt đầu khi tới ngày hết hạn của kỳ hiện tại. Mỗi kỳ một transaction, an toàn khi chạy nhiều instance.
 * Cùng lượt: Payment gia hạn hoặc nâng cấp còn Pending quá lâu (service dừng giữa chừng) chuyển sang Failed.
 */
@Injectable()
export class SubscriptionActivationService implements OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionActivationService.name);
  private currentRound: Promise<void> | null = null;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: SubscriptionsRepository,
  ) {}

  @Interval(60_000)
  async activateDue(): Promise<void> {
    if (this.currentRound || this.stopping) return;
    this.currentRound = this.runRound();
    try {
      await this.currentRound;
    } catch (error) {
      this.logger.warn(
        `Subscription job failed (${(error as { code?: string }).code ?? 'DATABASE_ERROR'}).`,
      );
    } finally {
      this.currentRound = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    await this.currentRound?.catch(() => undefined);
  }

  private async runRound(): Promise<void> {
    const activated: string[] = [];
    while (activated.length < ACTIVATION_BATCH_SIZE && !this.stopping) {
      const due = await this.prisma.$transaction(async (tx) => {
        const claimed = await this.repository.claimDueScheduled(tx, activated);
        if (!claimed) return null;
        await this.repository.lockOrganization(claimed.organizationId, tx);
        await this.repository.endCurrent(
          claimed.organizationId,
          new Date(),
          tx,
        );
        await this.repository.activateScheduled(claimed.id, tx);
        return claimed;
      });
      if (!due) break;
      activated.push(due.id);
      this.logger.log(
        `Scheduled renewal ${due.id} activated for organization ${due.organizationId}.`,
      );
    }

    const stale = await this.repository.failStalePayments(
      new Date(Date.now() - STALE_PAYMENT_AFTER_MS),
    );
    if (stale > 0) {
      this.logger.error(
        `${stale} renewal or upgrade payment(s) stayed Pending too long and were marked Failed; check them for a refund.`,
      );
    }
  }
}
