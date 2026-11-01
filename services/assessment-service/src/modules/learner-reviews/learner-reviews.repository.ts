import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ASSIGNMENT_KIND } from '../learner-submissions/learner-submissions.constants';
import {
  emitCompletionSignal,
  type CompletionSignal,
} from '../outbox/completion-signal';

/** The Instructor's own reviews are compared without case, as everywhere else (UC25.4). */
const INSTRUCTOR_ROLE = 'instructor';

/** A review of a Learner, with what the screens and the rules need and nothing that names the author. */
const reviewInclude = {
  cycle: {
    select: { id: true, status: true, reviewDueAt: true, scoreGap: true },
  },
  scores: true,
  submission: {
    select: {
      id: true,
      content: true,
      fileKey: true,
      fileName: true,
      fileMime: true,
      fileSizeBytes: true,
      gradingStatus: true,
      supersededAt: true,
      assessment: {
        select: {
          id: true,
          title: true,
          courseId: true,
          kind: true,
          prompt: true,
          promptFileKey: true,
          promptFileName: true,
          rubricCriteria: {
            orderBy: { position: 'asc' as const },
            select: {
              id: true,
              name: true,
              description: true,
              maxPoints: true,
              position: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.SubmissionReviewInclude;

export type ReviewRow = Prisma.SubmissionReviewGetPayload<{
  include: typeof reviewInclude;
}>;

@Injectable()
export class LearnerReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The peer reviews of one Learner on Assignments, the newest first; the Instructor's own rows are not peer reviews. */
  findOfReviewer(
    organizationId: string,
    reviewerId: string,
    limit: number,
  ): Promise<ReviewRow[]> {
    return this.prisma.submissionReview.findMany({
      where: {
        organizationId,
        reviewerId,
        NOT: { reviewerRole: { equals: INSTRUCTOR_ROLE, mode: 'insensitive' } },
        submission: { assessment: { kind: ASSIGNMENT_KIND } },
      },
      include: reviewInclude,
      orderBy: { id: 'desc' },
      take: limit,
    });
  }

  /** One review of this Learner: someone else's review is not found. Inside a transaction when one is given. */
  findOne(
    organizationId: string,
    reviewerId: string,
    reviewId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewRow | null> {
    return (tx ?? this.prisma).submissionReview.findFirst({
      where: {
        id: reviewId,
        organizationId,
        reviewerId,
        NOT: { reviewerRole: { equals: INSTRUCTOR_ROLE, mode: 'insensitive' } },
        submission: { assessment: { kind: ASSIGNMENT_KIND } },
      },
      include: reviewInclude,
    });
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  /** The reviews of one submission take turns, so the last one to finish is the one that decides where it goes. */
  async lockSubmission(
    tx: Prisma.TransactionClient,
    submissionId: string,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`review:${submissionId}`}))`;
  }

  /** Takes the review: only one caller sees count 1 while it is Pending, so a second press changes nothing. */
  async complete(
    tx: Prisma.TransactionClient,
    review: { id: string; organizationId: string },
    data: {
      score: number;
      comment: string;
      completedAt: Date;
      scores: { criterionId: string; points: number }[];
    },
  ): Promise<boolean> {
    const taken = await tx.submissionReview.updateMany({
      where: { id: review.id, status: 'Pending' },
      data: {
        status: 'Completed',
        score: data.score,
        comment: data.comment,
        completedAt: data.completedAt,
      },
    });
    if (taken.count === 0) return false;
    await tx.submissionReviewScore.createMany({
      data: data.scores.map((item) => ({
        organizationId: review.organizationId,
        reviewId: review.id,
        criterionId: item.criterionId,
        points: item.points,
      })),
    });
    return true;
  }

  /** The peer reviews handed out for a submission, with the scores of the ones given. */
  peerReviewsOf(tx: Prisma.TransactionClient, submissionId: string) {
    return tx.submissionReview.findMany({
      where: {
        submissionId,
        NOT: { reviewerRole: { equals: INSTRUCTOR_ROLE, mode: 'insensitive' } },
      },
      select: { status: true, score: true },
    });
  }

  /** Moves the submission on, only while it still waits for its peers (it may have gone to the Instructor, or been replaced). */
  async moveOn(
    tx: Prisma.TransactionClient,
    submissionId: string,
    to: { gradingStatus: string; interventionReason: string | null },
  ): Promise<boolean> {
    const moved = await tx.submission.updateMany({
      where: {
        id: submissionId,
        gradingStatus: 'AwaitingPeerReview',
        supersededAt: null,
      },
      data: to,
    });
    return moved.count > 0;
  }

  /** How many reviews of this Assignment the Learner can still give in the cycles handed out and not past their deadline. */
  countOpen(
    tx: Prisma.TransactionClient,
    organizationId: string,
    reviewerId: string,
    assessmentId: string,
    now: Date,
  ): Promise<number> {
    return tx.submissionReview.count({
      where: {
        organizationId,
        reviewerId,
        status: 'Pending',
        NOT: { reviewerRole: { equals: INSTRUCTOR_ROLE, mode: 'insensitive' } },
        submission: { assessmentId },
        cycle: { status: 'Assigned', reviewDueAt: { gt: now } },
      },
    });
  }

  /** The row of the Learner on the Assignment is the aggregate of the event; a reviewer has submitted, so it exists. */
  ensureState(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assessmentId: string,
    learnerId: string,
    now: Date,
  ) {
    return tx.learnerAssessmentState.upsert({
      where: { assessmentId_learnerId: { assessmentId, learnerId } },
      create: { organizationId, assessmentId, learnerId, firstActivityAt: now },
      update: {},
      select: { id: true },
    });
  }

  /** The status-changed event of the Learner, written in the transaction of the change (see emitCompletionSignal). */
  emitSignal(tx: Prisma.TransactionClient, signal: CompletionSignal) {
    return emitCompletionSignal(tx, signal);
  }
}
