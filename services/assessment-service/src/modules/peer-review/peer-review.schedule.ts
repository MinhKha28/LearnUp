import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationClient } from '../../infrastructure/clients/notification/notification.client';
import { PeerReviewRepository } from './peer-review.repository';
import { reminderNotice } from './review-notice';
import { PeerReviewService } from './peer-review.service';

const HOUR_MS = 3_600_000;

/** BR-232: the reminder goes out once, when the review deadline is closer than `reminderHours` and not yet passed. */
export function isReminderDue(
  cycle: { reviewDueAt: Date; reminderHours: number },
  now: Date,
): boolean {
  const due = cycle.reviewDueAt.getTime();
  return (
    now.getTime() < due && now.getTime() >= due - cycle.reminderHours * HOUR_MS
  );
}

export interface IScheduleRun {
  closed: number;
  reminded: number;
  expired: number;
}

/**
 * UC33 — what the cycles do on their own (BR-230): they close at their closing line and hand out the reviews, remind
 * the reviewers before the deadline (BR-232) and, when the deadline has passed, move what was not reviewed to the
 * Instructor (BR-237, BR-243) and mark who skipped (BR-236, BR-239).
 *
 * Every step claims the cycle with a conditional update, so two runs at the same moment, or two instances of the
 * service, do the work once. A run that fails on one cycle goes on with the others and tries that one again next time.
 * ponytail: a timer in the process; move to a queue or a cron service when there is more than this one job.
 */
@Injectable()
export class PeerReviewSchedule
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PeerReviewSchedule.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly repository: PeerReviewRepository,
    private readonly service: PeerReviewService,
    private readonly notifications: NotificationClient,
    private readonly config: ConfigService,
  ) {}

  /** PEER_REVIEW_TICK_MS is how often it runs; not set (or 0) means it does not run by itself. */
  onApplicationBootstrap(): void {
    const everyMs = Number(this.config.get<string>('PEER_REVIEW_TICK_MS'));
    if (!(everyMs > 0)) return;
    this.timer = setInterval(() => void this.runOnce(), everyMs);
    this.timer.unref();
    this.logger.log(`Peer review schedule runs every ${everyMs} ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(now: Date = new Date()): Promise<IScheduleRun> {
    const run: IScheduleRun = { closed: 0, reminded: 0, expired: 0 };
    if (this.running) return run;
    this.running = true;
    try {
      run.closed = await this.closeDue(now);
      run.reminded = await this.remind(now);
      run.expired = await this.expire(now);
    } catch (error) {
      this.logger.error(`Peer review schedule failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
    // a run that did nothing stays quiet (it runs every tick); one that did something says how much
    if (run.closed || run.reminded || run.expired) {
      this.logger.log(
        `Peer review schedule run: closed=${run.closed} reminded=${run.reminded} expired=${run.expired}`,
      );
    }
    return run;
  }

  private async closeDue(now: Date): Promise<number> {
    let closed = 0;
    for (const cycle of await this.repository.findCyclesToClose(now)) {
      try {
        const result = await this.service.closeOpen(
          cycle,
          cycle.assessment.title,
          now,
        );
        if (!result.alreadyClosed) closed += 1;
      } catch (error) {
        this.logger.error(`Closing cycle ${cycle.id} failed: ${String(error)}`);
      }
    }
    return closed;
  }

  private async remind(now: Date): Promise<number> {
    let reminded = 0;
    for (const cycle of await this.repository.findCyclesToRemind(now)) {
      if (!isReminderDue(cycle, now)) continue;
      try {
        // claimed first: a lost reminder is better than the same reminder twice
        const claimed = await this.repository.claimReminder(cycle.id, now);
        if (claimed.count === 0) continue;
        reminded += 1;
        const owed = await this.repository.pendingReviewCounts(cycle.id);
        for (const [reviewerId, total] of owed) {
          await this.notifyOne(cycle.organizationId, reviewerId, {
            ...reminderNotice(total, cycle.assessment.title, cycle.reviewDueAt),
            metadata: { assignmentId: cycle.assessmentId, cycleId: cycle.id },
          });
        }
      } catch (error) {
        this.logger.error(`Reminder of ${cycle.id} failed: ${String(error)}`);
      }
    }
    return reminded;
  }

  private async expire(now: Date): Promise<number> {
    let expired = 0;
    for (const cycle of await this.repository.findCyclesPastDeadline(now)) {
      try {
        const done = await this.repository.transaction(async (tx) => {
          const claimed = await this.repository.claimExpiredCycle(
            tx,
            cycle.id,
            now,
          );
          if (claimed.count === 0) return false;
          await this.repository.expirePendingReviews(tx, cycle.id);
          await this.repository.sendUnderReviewedToInstructor(
            tx,
            cycle.id,
            cycle.reviewersPerSubmission,
          );
          return true;
        });
        if (done) expired += 1;
      } catch (error) {
        this.logger.error(`Expiring ${cycle.id} failed: ${String(error)}`);
      }
    }
    return expired;
  }

  private async notifyOne(
    organizationId: string,
    recipientUserId: string,
    item: { title: string; message: string; metadata: Record<string, string> },
  ): Promise<void> {
    try {
      await this.notifications.send({
        organizationId,
        recipientUserId,
        ...item,
      });
    } catch (error) {
      this.logger.warn(`Could not notify ${recipientUserId}: ${String(error)}`);
    }
  }
}
