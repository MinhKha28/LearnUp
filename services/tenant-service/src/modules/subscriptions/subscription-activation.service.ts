import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SubscriptionsRepository } from './subscriptions.repository';

export const ACTIVATION_BATCH_SIZE = 20;

/** BR-17: kỳ gia hạn sớm bắt đầu khi tới ngày hết hạn của kỳ hiện tại. Mỗi kỳ một transaction, an toàn khi chạy nhiều instance. */
@Injectable()
export class SubscriptionActivationService implements OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionActivationService.name);
  private currentRound: Promise<number> | null = null;
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
    } catch {
      this.logger.warn('Scheduled renewal activation failed (DATABASE_ERROR).');
    } finally {
      this.currentRound = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    await this.currentRound?.catch(() => undefined);
  }

  private async runRound(): Promise<number> {
    const activated: string[] = [];
    while (activated.length < ACTIVATION_BATCH_SIZE && !this.stopping) {
      const id = await this.prisma.$transaction(async (tx) => {
        const due = await this.repository.claimDueScheduled(tx, activated);
        if (!due) return null;
        await this.repository.endCurrent(due.organizationId, new Date(), tx);
        await this.repository.activateScheduled(due.id, tx);
        return due.id;
      });
      if (!id) break;
      activated.push(id);
      this.logger.log(`Scheduled renewal ${id} activated.`);
    }
    return activated.length;
  }
}
