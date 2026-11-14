import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { deliverNotice } from '../../infrastructure/clients/notification/deliver-notice';
import { NotificationClient } from '../../infrastructure/clients/notification/notification.client';
import { TenantDirectoryClient } from '../../infrastructure/clients/tenant/tenant-directory.client';
import { reviewCounts } from '../outbox/peer-review-assigned';
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
  /** The notices handed over and not yet delivered: a notification-service that is slow never holds the timer. */
  private readonly delivering = new Set<Promise<void>>();

  constructor(
    private readonly repository: PeerReviewRepository,
    private readonly service: PeerReviewService,
    private readonly notifications: NotificationClient,
    private readonly tenant: TenantDirectoryClient,
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
          this.remindOne(cycle, reviewerId, total);
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
          const missed = await this.repository.expirePendingReviews(
            tx,
            cycle.id,
          );
          await this.repository.sendUnderReviewedToInstructor(
            tx,
            cycle.id,
            cycle.reviewersPerSubmission,
          );
          // Learning looks at the Course again for each Learner who skipped reviews (BR-236, BR-239); the ones who gave all
          // theirs get nothing. Same transaction as the marks, so the event exists if and only if they do.
          const signals = await this.repository.emitReviewerSignals(
            tx,
            cycle,
            'Missed',
            reviewCounts(missed.map((reviewerId) => ({ reviewerId }))),
            now,
          );
          if (signals.repaired.length > 0) {
            this.logger.warn(
              `Cycle ${cycle.id}: made the missing state row of ${signals.repaired.join(', ')} so learning is told about their missed reviews.`,
            );
          }
          return true;
        });
        if (done) expired += 1;
      } catch (error) {
        this.logger.error(`Expiring ${cycle.id} failed: ${String(error)}`);
      }
    }
    return expired;
  }

  /**
   * BR-232: the bell and the e-mail of the reminder of one reviewer. They are handed over without waiting: each channel is
   * tried again for about a minute (see `deliverNotice`), which must not hold the other reviewers or the next tick.
   * The reminder was claimed before, so a notice lost with the process is not sent twice.
   */
  private remindOne(
    cycle: {
      id: string;
      organizationId: string;
      assessmentId: string;
      reviewDueAt: Date;
      assessment: { title: string };
    },
    reviewerId: string,
    total: number,
  ): void {
    const notice = reminderNotice(
      total,
      cycle.assessment.title,
      cycle.reviewDueAt,
    );
    const delivery: Promise<void> = deliverNotice(
      {
        notifications: this.notifications,
        tenant: this.tenant,
        logger: this.logger,
      },
      {
        organizationId: cycle.organizationId,
        recipientUserId: reviewerId,
        title: notice.title,
        message: notice.message,
        metadata: { assignmentId: cycle.assessmentId, cycleId: cycle.id },
        templateCode: 'PEER_REVIEW_REMINDER',
        about: `the reminder of cycle ${cycle.id}`,
        // nobody is asking: the reviewer is the one looked up, in the Organization of the cycle
        lookupAs: {
          userId: reviewerId,
          role: 'LEARNER',
          organizationId: cycle.organizationId,
          isAuthenticated: true,
        },
      },
    )
      .catch((error) =>
        this.logger.error(
          `The reminder of ${reviewerId} for ${cycle.id} failed: ${String(error)}`,
        ),
      )
      .finally(() => this.delivering.delete(delivery));
    this.delivering.add(delivery);
  }

  /** Resolves when every notice handed over so far was delivered or given up (the tests wait for it). */
  async delivered(): Promise<void> {
    await Promise.allSettled([...this.delivering]);
  }
}
