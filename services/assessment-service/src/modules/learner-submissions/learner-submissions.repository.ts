import { Injectable } from '@nestjs/common';
import type { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ASSIGNMENT_KIND } from './learner-submissions.constants';

/** The Assignment with what a Learner may read; the Rubric is shown so the Learner knows how the work is judged. */
export const learnerAssignmentInclude = {
  rubricCriteria: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.AssessmentInclude;

export type LearnerAssignmentRow = Prisma.AssessmentGetPayload<{
  include: typeof learnerAssignmentInclude;
}>;

export type SubmissionRow = Prisma.SubmissionGetPayload<object>;
export type LearnerStateRow = Prisma.LearnerAssessmentStateGetPayload<object>;
export type CycleRow = Prisma.PeerReviewCycleGetPayload<object>;

@Injectable()
export class LearnerSubmissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  findAssignment(
    organizationId: string,
    id: string,
  ): Promise<LearnerAssignmentRow | null> {
    return this.prisma.assessment.findFirst({
      where: { id, organizationId, kind: ASSIGNMENT_KIND },
      include: learnerAssignmentInclude,
    });
  }

  findState(
    assessmentId: string,
    learnerId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).learnerAssessmentState.findUnique({
      where: { assessmentId_learnerId: { assessmentId, learnerId } },
    });
  }

  /** The submission that counts: the newest one that has not been replaced (BR-170). */
  findLatestSubmission(
    assessmentId: string,
    learnerId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).submission.findFirst({
      where: { assessmentId, learnerId, supersededAt: null },
      orderBy: { submissionNumber: 'desc' },
    });
  }

  /** BR-169: an Enrollment that is Completed is read-only (the row comes from learning-service events). */
  async isEnrollmentCompleted(enrollmentId: string): Promise<boolean> {
    const row = await this.prisma.completedEnrollment.findUnique({
      where: { enrollmentId },
      select: { enrollmentId: true },
    });
    return row !== null;
  }

  findPlatformSetting() {
    return this.prisma.platformSetting.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Transaction-wide lock on a text key: callers with the same key take turns (same idea as UC19.2). */
  async lock(tx: Prisma.TransactionClient, key: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  /** First activity creates the row (BR-176 counters); needs the caller to hold the lock of this Learner. */
  ensureState(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assessmentId: string,
    learnerId: string,
    now: Date,
  ): Promise<LearnerStateRow> {
    return tx.learnerAssessmentState.upsert({
      where: { assessmentId_learnerId: { assessmentId, learnerId } },
      create: { organizationId, assessmentId, learnerId, firstActivityAt: now },
      update: {},
    });
  }

  updateState(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.LearnerAssessmentStateUpdateInput,
  ) {
    return tx.learnerAssessmentState.update({ where: { id }, data });
  }

  findCycleContaining(
    tx: Prisma.TransactionClient,
    assessmentId: string,
    at: Date,
  ) {
    return tx.peerReviewCycle.findFirst({
      where: { assessmentId, opensAt: { lte: at }, closesAt: { gt: at } },
    });
  }

  findLatestCycle(tx: Prisma.TransactionClient, assessmentId: string) {
    return tx.peerReviewCycle.findFirst({
      where: { assessmentId },
      orderBy: { closesAt: 'desc' },
    });
  }

  createCycle(
    tx: Prisma.TransactionClient,
    data: Prisma.PeerReviewCycleUncheckedCreateInput,
  ) {
    return tx.peerReviewCycle.create({ data });
  }

  findCycleById(id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).peerReviewCycle.findUnique({ where: { id } });
  }

  /** UC30.1 step 4: the new submission takes over; the old one stays as history (BR-170). */
  markSuperseded(tx: Prisma.TransactionClient, id: string, at: Date) {
    return tx.submission.update({ where: { id }, data: { supersededAt: at } });
  }

  async nextSubmissionNumber(
    tx: Prisma.TransactionClient,
    assessmentId: string,
    learnerId: string,
  ): Promise<number> {
    const last = await tx.submission.aggregate({
      where: { assessmentId, learnerId },
      _max: { submissionNumber: true },
    });
    return (last._max.submissionNumber ?? 0) + 1;
  }

  createSubmission(
    tx: Prisma.TransactionClient,
    data: Prisma.SubmissionUncheckedCreateInput,
  ) {
    return tx.submission.create({ data });
  }

  createOutboxEvent(
    tx: Prisma.TransactionClient,
    data: Prisma.OutboxEventUncheckedCreateInput,
  ) {
    return tx.outboxEvent.create({ data });
  }
}
