import type { PeerReviewCycle } from 'generated/prisma/client';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';

import { NotificationClient } from '../../infrastructure/clients/notification/notification.client';
import { cycleLockKey } from './cycle-lock';
import { assignedNotice } from './review-notice';
import { AssessmentsRepository } from '../assessments/assessments.repository';
import {
  AssessmentsService,
  AUTHORABLE_STATUSES,
} from '../assessments/assessments.service';
import { cycleStatusOf } from './cycle-status';
import type {
  IClosedCycle,
  IPeerReviewCycleList,
} from './interfaces/peer-review-cycle.interface';
import { UpdatePeerReviewDto } from './dto/update-peer-review.dto';
import {
  assignReviews,
  canAssign,
  type ReviewPair,
  shuffle,
} from './review-assignment';
import { PeerReviewRepository } from './peer-review.repository';
import type { PeerReviewUpdateData } from './interfaces/peer-review-update-data.interface';

@Injectable()
export class PeerReviewService {
  private readonly logger = new Logger(PeerReviewService.name);
  /** The clock of the status of a cycle; a test replaces it to travel in time. */
  clock: () => Date = () => new Date();
  /** The randomness of the permutation (BR-249); a test replaces it to know the result. */
  random: () => number = Math.random;

  constructor(
    private readonly repository: PeerReviewRepository,
    private readonly assessmentsRepository: AssessmentsRepository,
    private readonly assessments: AssessmentsService,
    private readonly notifications: NotificationClient,
  ) {}

  /** UC33 — the cycles of an Assignment of the Instructor in charge, oldest first (BR-200). */
  async listCycles(
    user: CurrentUser,
    assignmentId: string,
  ): Promise<IPeerReviewCycleList> {
    const { assignment } = await this.assessments.findOwnAssignment(
      user,
      assignmentId,
    );
    // PRE-1
    if (!assignment.peerReviewEnabled) {
      throw new ConflictException({
        code: 'PEER_REVIEW_NOT_ENABLED',
        message: 'Peer Review is not enabled for this Assignment.',
      });
    }

    const cycles = await this.repository.findCycles(assignment.id);
    const countOf = await this.repository.countSubmissionsByCycle(
      cycles.map((cycle) => cycle.id),
    );

    const now = this.clock();
    return {
      assignmentId: assignment.id,
      title: assignment.title,
      settings: {
        reviewersPerSubmission: assignment.peerReviewersPerSubmission,
        cycleDays: assignment.peerReviewCycleDays,
        deadlineDays: assignment.peerReviewDeadlineDays,
        scoreGap:
          assignment.peerReviewScoreGap === null
            ? null
            : Number(assignment.peerReviewScoreGap.toString()),
      },
      items: cycles.map((cycle) => {
        const submissionCount = countOf.get(cycle.id) ?? 0;
        return {
          id: cycle.id,
          opensAt: cycle.opensAt.toISOString(),
          closesAt: cycle.closesAt.toISOString(),
          reviewDueAt: cycle.reviewDueAt.toISOString(),
          submissionCount,
          closed: cycle.status !== 'Open',
          status: cycleStatusOf({
            stored: cycle.status,
            closesAt: cycle.closesAt,
            reviewersPerSubmission: cycle.reviewersPerSubmission,
            submissionCount,
            now,
          }),
        };
      }),
    };
  }

  /**
   * UC33 — close a cycle: hand out the reviews (BR-249) or send the submissions to the Instructor (BR-242).
   * The cycles run on the calendar (BR-230, BR-231): a cycle that has not reached its closing line is not closed, and the
   * dates of a cycle never move. The Instructor can close one whose line has passed but which the schedule has not closed
   * yet. Closing a closed cycle changes nothing.
   * A submission or a resubmission being placed at this moment takes the same lock (cycleLockKey), so it is either counted
   * here or goes to the next cycle.
   */
  async closeCycle(
    user: CurrentUser,
    assignmentId: string,
    cycleId: string,
  ): Promise<IClosedCycle> {
    const { assignment } = await this.assessments.findOwnAssignment(
      user,
      assignmentId,
    );
    if (!assignment.peerReviewEnabled) {
      throw new ConflictException({
        code: 'PEER_REVIEW_NOT_ENABLED',
        message: 'Peer Review is not enabled for this Assignment.',
      });
    }
    const cycle = await this.repository.findCycle(assignment.id, cycleId);
    if (!cycle) {
      throw new NotFoundException({
        code: 'CYCLE_NOT_FOUND',
        message: 'Peer Review cycle not found.',
      });
    }
    const now = this.clock();
    if (cycle.status !== 'Open') return this.alreadyClosed(cycle);
    if (now < cycle.closesAt) {
      throw new ConflictException({
        code: 'CYCLE_NOT_DUE',
        message: 'This cycle has not reached its closing time yet.',
      });
    }

    return this.closeOpen(cycle, assignment.title, now);
  }

  /**
   * Closes a cycle that is Open: the work of UC33 that the Instructor starts from the screen and the schedule starts
   * when the closing line passes (BR-230). Then each reviewer is told what to review (BR-232).
   */
  async closeOpen(
    cycle: PeerReviewCycle,
    assignmentTitle: string,
    now: Date,
  ): Promise<IClosedCycle> {
    const n = cycle.reviewersPerSubmission;
    const result = await this.repository.transaction(async (tx) => {
      // a submission being placed holds this lock until it commits: it is in the cycle when we read it, or it waits
      // and goes to the next cycle
      await this.repository.lock(tx, cycleLockKey(cycle.assessmentId));
      // The dates stay as the calendar made them: the next cycle opens exactly when this one closes (BR-231).
      const claimed = await this.repository.claimOpenCycle(tx, cycle.id, {
        status: 'Closing',
        closedAt: now,
      });
      if (claimed.count === 0) return null;

      const submissions = await this.repository.currentSubmissions(
        tx,
        cycle.id,
      );
      if (!canAssign(submissions.length, n)) {
        await this.repository.sendToInstructor(
          tx,
          cycle.id,
          'TOO_FEW_SUBMISSIONS',
        );
        await this.repository.finishCycle(tx, cycle.id, {
          status: 'InstructorOnly',
          reviewerPermutation: [],
        });
        return {
          status: 'InstructorOnly' as const,
          submissions: submissions.length,
          reviews: 0,
          pairs: [] as ReviewPair[],
        };
      }

      const permutation = shuffle(
        submissions.map((submission) => submission.learnerId),
        this.random,
      );
      const submissionOf = new Map(
        submissions.map((submission) => [submission.learnerId, submission]),
      );
      const pairs = assignReviews(permutation, n);
      await this.repository.createReviews(
        tx,
        pairs.map((pair) => ({
          organizationId: cycle.organizationId,
          submissionId: submissionOf.get(pair.authorId)!.id,
          cycleId: cycle.id,
          reviewerId: pair.reviewerId,
          reviewerRole: 'Learner',
          status: 'Pending',
        })),
      );
      await this.repository.finishCycle(tx, cycle.id, {
        status: 'Assigned',
        reviewerPermutation: permutation,
      });
      return {
        status: 'Assigned' as const,
        submissions: submissions.length,
        reviews: pairs.length,
        pairs,
      };
    });

    // another caller closed it between our read and our claim
    if (!result) {
      const current = await this.repository.findCycle(
        cycle.assessmentId,
        cycle.id,
      );
      return this.alreadyClosed(current!);
    }
    await this.notifyReviewers(cycle, assignmentTitle, result.pairs);
    return {
      cycleId: cycle.id,
      status: result.status,
      submissionCount: result.submissions,
      reviewCount: result.reviews,
      closedAt: now.toISOString(),
      alreadyClosed: false,
    };
  }

  /** BR-232: tell each reviewer how many submissions to review and by when. Best effort: it never undoes the closing. */
  private async notifyReviewers(
    cycle: PeerReviewCycle,
    assignmentTitle: string,
    pairs: ReviewPair[],
  ): Promise<void> {
    const count = new Map<string, number>();
    for (const pair of pairs) {
      count.set(pair.reviewerId, (count.get(pair.reviewerId) ?? 0) + 1);
    }
    // in parallel: a slow notification-service must not hold the Instructor's request for one timeout per reviewer
    await Promise.all(
      [...count].map(async ([reviewerId, total]) => {
        try {
          await this.notifications.send({
            organizationId: cycle.organizationId,
            recipientUserId: reviewerId,
            ...assignedNotice(total, assignmentTitle, cycle.reviewDueAt),
            metadata: { assignmentId: cycle.assessmentId, cycleId: cycle.id },
          });
        } catch (error) {
          this.logger.warn(
            `Could not notify ${reviewerId} about cycle ${cycle.id}: ${String(error)}`,
          );
        }
      }),
    );
  }

  private async alreadyClosed(cycle: {
    id: string;
    status: string;
    closedAt: Date | null;
    closesAt: Date;
  }): Promise<IClosedCycle> {
    const [submissionCount, reviewCount] = await this.repository.countForCycle(
      cycle.id,
    );
    return {
      cycleId: cycle.id,
      status: cycle.status as IClosedCycle['status'],
      submissionCount,
      reviewCount,
      closedAt: (cycle.closedAt ?? cycle.closesAt).toISOString(),
      alreadyClosed: true,
    };
  }

  /** UC19.5 — turn peer review on/off and configure its cycle (BR-182, BR-183). */
  async updateConfig(
    user: CurrentUser,
    assignmentId: string,
    dto: UpdatePeerReviewDto,
  ) {
    const { assignment, course } = await this.assessments.findOwnAssignment(
      user,
      assignmentId,
    );

    if (course.disabled || !AUTHORABLE_STATUSES.includes(course.status)) {
      throw new ConflictException({
        code: 'COURSE_NOT_EDITABLE',
        message: `Peer Review cannot be changed while the Course is ${course.status}.`,
      });
    }
    // BR-185 / BR-93: only the on/off switch is blocked by Locked; the parameters stay editable.
    if (course.locked && dto.enabled !== assignment.peerReviewEnabled) {
      throw new ConflictException({
        code: 'PEER_REVIEW_TOGGLE_LOCKED',
        message:
          'Peer Review cannot be turned on or off because the Course is Locked. Create a new Course version to change it.',
      });
    }

    let data: PeerReviewUpdateData = { peerReviewEnabled: dto.enabled };
    if (dto.enabled) {
      const settings =
        await this.assessmentsRepository.findLatestPlatformSetting();
      data = {
        peerReviewEnabled: true,
        peerReviewersPerSubmission: dto.reviewersPerSubmission,
        peerReviewCycleDays:
          dto.cycleDays ??
          assignment.peerReviewCycleDays ??
          settings?.defaultPeerReviewCycleDays ??
          7,
        peerReviewDeadlineDays:
          dto.deadlineDays ??
          assignment.peerReviewDeadlineDays ??
          settings?.defaultPeerReviewDeadlineDays ??
          3,
        peerReviewScoreGap: dto.scoreGap,
      };
    }

    // BR-269: new values apply only to cycles created afterwards; existing cycles keep their dates.
    const updated = await this.repository.updateConfig(assignment.id, data);
    return this.assessments.toDetail(updated, course.locked);
  }
}
