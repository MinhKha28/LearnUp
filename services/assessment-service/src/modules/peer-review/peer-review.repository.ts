import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { assignmentInclude } from '../assessments/assessments.repository';
import type { AssignmentFacts } from '../completion-snapshot/completion-snapshot';
import type { PeerReviewUpdateData } from './interfaces/peer-review-update-data.interface';

/** Database access of UC19.5; the Peer Review settings live on the Assignment row. */
@Injectable()
export class PeerReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  updateConfig(assignmentId: string, data: PeerReviewUpdateData) {
    return this.prisma.assessment.update({
      where: { id: assignmentId },
      data,
      include: assignmentInclude,
    });
  }

  /** UC33: the cycles of an Assignment, oldest first. */
  findCycles(assessmentId: string) {
    return this.prisma.peerReviewCycle.findMany({
      where: { assessmentId },
      orderBy: { opensAt: 'asc' },
    });
  }

  /** UC33: the submissions in each cycle, one per Learner: a replaced submission is not counted (BR-171). */
  async countSubmissionsByCycle(
    cycleIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.submission.groupBy({
      by: ['cycleId'],
      where: { cycleId: { in: cycleIds }, supersededAt: null },
      _count: { _all: true },
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.cycleId) counts.set(row.cycleId, row._count._all);
    }
    return counts;
  }

  /** UC33.2: the state of one Learner on one Assignment (BR-176 counters, and when the duty was waived). */
  findLearnerState(
    tx: Prisma.TransactionClient,
    assessmentId: string,
    learnerId: string,
  ) {
    return tx.learnerAssessmentState.findUnique({
      where: { assessmentId_learnerId: { assessmentId, learnerId } },
    });
  }

  /**
   * UC33.2: the reviews the Learner owes or gave as a peer on one Assignment (never the Instructor's own), each with its
   * cycle: the facts the completion snapshot reads, so "owes a peer review" is decided with peerReviewOf everywhere (D10).
   */
  async findLearnerPeerReviews(
    tx: Prisma.TransactionClient,
    assessmentId: string,
    learnerId: string,
  ): Promise<AssignmentFacts['reviews']> {
    return tx.$queryRaw<AssignmentFacts['reviews']>(Prisma.sql`
      SELECT r.status, c.review_due_at AS "reviewDueAt", r.cycle_id AS "cycleId", c.closes_at AS "cycleClosesAt"
      FROM submission_reviews r
      JOIN submissions rs ON rs.id = r.submission_id
      LEFT JOIN peer_review_cycles c ON c.id = r.cycle_id
      WHERE rs.assessment_id = ${assessmentId}::uuid AND r.reviewer_id = ${learnerId}::uuid
        AND lower(r.reviewer_role) <> 'instructor'
    `);
  }

  /**
   * UC33.2: records the waiver and the event that tells learning the status of the Learner changed, in one transaction.
   * The update only takes a row that is not waived yet, so of two requests at the same moment exactly one gets true,
   * whatever the locks around it do; the other writes nothing.
   */
  async waive(
    tx: Prisma.TransactionClient,
    state: { id: string; organizationId: string },
    by: string,
    now: Date,
    event: Omit<
      Prisma.OutboxEventUncheckedCreateInput,
      'aggregateType' | 'aggregateId' | 'organizationId' | 'occurredAt'
    >,
  ): Promise<boolean> {
    const taken = await tx.learnerAssessmentState.updateMany({
      where: { id: state.id, exemptedAt: null },
      data: { exemptedAt: now, exemptedBy: by },
    });
    if (taken.count === 0) return false;
    await tx.outboxEvent.create({
      data: {
        ...event,
        aggregateType: 'LearnerAssessmentState',
        aggregateId: state.id,
        organizationId: state.organizationId,
        occurredAt: now,
      },
    });
    return true;
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  /** Transaction-wide lock on a text key (see cycleLockKey): callers with the same key take turns. */
  async lock(tx: Prisma.TransactionClient, key: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  findCycle(assessmentId: string, cycleId: string) {
    return this.prisma.peerReviewCycle.findFirst({
      where: { id: cycleId, assessmentId },
    });
  }

  /**
   * Takes the cycle for closing: only one caller sees count 1 while the cycle is Open, so a second click or a
   * second job run finds it closed already. The row lock holds a concurrent caller until the first one commits.
   */
  claimOpenCycle(
    tx: Prisma.TransactionClient,
    cycleId: string,
    data: Prisma.PeerReviewCycleUpdateManyMutationInput,
  ) {
    return tx.peerReviewCycle.updateMany({
      where: { id: cycleId, status: 'Open' },
      data,
    });
  }

  /** The current submission of each Learner in the cycle (a replaced one is not counted, BR-213). */
  currentSubmissions(tx: Prisma.TransactionClient, cycleId: string) {
    return tx.submission.findMany({
      where: { cycleId, supersededAt: null },
      select: { id: true, learnerId: true, organizationId: true },
      orderBy: { submittedAt: 'asc' },
    });
  }

  finishCycle(
    tx: Prisma.TransactionClient,
    cycleId: string,
    data: Prisma.PeerReviewCycleUpdateInput,
  ) {
    return tx.peerReviewCycle.update({ where: { id: cycleId }, data });
  }

  createReviews(
    tx: Prisma.TransactionClient,
    data: Prisma.SubmissionReviewCreateManyInput[],
  ) {
    return tx.submissionReview.createMany({ data });
  }

  sendToInstructor(
    tx: Prisma.TransactionClient,
    cycleId: string,
    interventionReason: string,
  ) {
    return tx.submission.updateMany({
      where: { cycleId, supersededAt: null },
      data: { gradingStatus: 'AwaitingInstructor', interventionReason },
    });
  }

  async countForCycle(cycleId: string): Promise<[number, number]> {
    return Promise.all([
      this.prisma.submission.count({ where: { cycleId, supersededAt: null } }),
      this.prisma.submissionReview.count({ where: { cycleId } }),
    ]);
  }

  // ---- the schedule (BR-230, BR-232, BR-237) ----

  /** Cycles whose closing line has passed and that nobody has closed yet; the title is for the notification. */
  findCyclesToClose(now: Date) {
    return this.prisma.peerReviewCycle.findMany({
      where: { status: 'Open', closesAt: { lte: now } },
      include: { assessment: { select: { title: true } } },
      orderBy: { closesAt: 'asc' },
    });
  }

  /** Assigned cycles that have not been reminded; the caller keeps the ones inside the reminder window. */
  findCyclesToRemind(now: Date) {
    return this.prisma.peerReviewCycle.findMany({
      where: {
        status: 'Assigned',
        remindedAt: null,
        reviewDueAt: { gt: now },
      },
      include: { assessment: { select: { title: true } } },
    });
  }

  /** Takes the reminder of a cycle: only one caller gets count 1, so the reminder is sent once. */
  claimReminder(cycleId: string, now: Date) {
    return this.prisma.peerReviewCycle.updateMany({
      where: { id: cycleId, status: 'Assigned', remindedAt: null },
      data: { remindedAt: now },
    });
  }

  /** The Learners who still owe reviews in a cycle, with how many (BR-232). */
  async pendingReviewCounts(cycleId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.submissionReview.groupBy({
      by: ['reviewerId'],
      where: { cycleId, status: 'Pending' },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.reviewerId, row._count._all]));
  }

  /** Assigned cycles whose review deadline has passed (BR-237). */
  findCyclesPastDeadline(now: Date) {
    return this.prisma.peerReviewCycle.findMany({
      where: { status: 'Assigned', reviewDueAt: { lte: now } },
      orderBy: { reviewDueAt: 'asc' },
    });
  }

  /** Takes the cycle for the end of its review period: only one caller gets count 1. */
  claimExpiredCycle(tx: Prisma.TransactionClient, cycleId: string, now: Date) {
    return tx.peerReviewCycle.updateMany({
      where: { id: cycleId, status: 'Assigned' },
      data: { status: 'Completed', completedAt: now },
    });
  }

  /** Reviews that were not done in time stop being Pending (BR-236). */
  expirePendingReviews(tx: Prisma.TransactionClient, cycleId: string) {
    return tx.submissionReview.updateMany({
      where: { cycleId, status: 'Pending' },
      data: { status: 'Missed' },
    });
  }

  /**
   * The submissions of the cycle that did not get all N valid reviews go to the Instructor (BR-243, BR-252).
   * A submission already moved on (graded, replaced) is left alone.
   */
  async sendUnderReviewedToInstructor(
    tx: Prisma.TransactionClient,
    cycleId: string,
    reviewersPerSubmission: number,
  ): Promise<number> {
    const submissions = await tx.submission.findMany({
      where: {
        cycleId,
        supersededAt: null,
        gradingStatus: 'AwaitingPeerReview',
      },
      select: {
        id: true,
        _count: { select: { reviews: { where: { status: 'Completed' } } } },
      },
    });
    const short = submissions
      .filter((s) => s._count.reviews < reviewersPerSubmission)
      .map((s) => s.id);
    if (short.length === 0) return 0;
    await tx.submission.updateMany({
      where: { id: { in: short } },
      data: {
        gradingStatus: 'AwaitingInstructor',
        interventionReason: 'REVIEW_MISSED',
      },
    });
    return short.length;
  }
}
