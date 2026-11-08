import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  emitCompletionSignal,
  type CompletionSignal,
} from '../outbox/completion-signal';
import { QUIZ_KIND } from './quiz-attempts.constants';

/** The Quiz with its questions and options, key included: only the service reads `isCorrect`, never the screen. */
export const quizWithQuestions = {
  questions: {
    orderBy: { position: 'asc' as const },
    include: { options: { orderBy: { position: 'asc' as const } } },
  },
} satisfies Prisma.AssessmentInclude;

export type QuizRow = Prisma.AssessmentGetPayload<{
  include: typeof quizWithQuestions;
}>;
export type AttemptRow = Prisma.QuizAttemptGetPayload<{
  include: { answers: true };
}>;
export type StateRow = Prisma.LearnerAssessmentStateGetPayload<object>;

@Injectable()
export class QuizAttemptsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(work);
  }

  /** One request at a time per Learner and Quiz, so the counter of BR-218 and the "one attempt at a time" of BR-201 hold. */
  async lock(
    tx: Prisma.TransactionClient,
    assessmentId: string,
    learnerId: string,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quiz:${assessmentId}:${learnerId}`}))`;
  }

  findQuiz(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).assessment.findFirst({
      where: { id, organizationId, kind: QUIZ_KIND },
      include: quizWithQuestions,
    });
  }

  findQuizOfAttempt(attemptId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).assessment.findFirst({
      where: { quizAttempts: { some: { id: attemptId } } },
      include: quizWithQuestions,
    });
  }

  findAttempt(attemptId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).quizAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true },
    });
  }

  findAttempts(
    assessmentId: string,
    learnerId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).quizAttempt.findMany({
      where: { assessmentId, learnerId },
      orderBy: { attemptNumber: 'asc' },
      include: { answers: true },
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

  /** The first activity creates the row (BR-140); the caller holds the lock of this Learner and Quiz. */
  ensureState(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assessmentId: string,
    learnerId: string,
    now: Date,
  ): Promise<StateRow> {
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

  async nextAttemptNumber(
    tx: Prisma.TransactionClient,
    assessmentId: string,
    learnerId: string,
  ): Promise<number> {
    const result = await tx.quizAttempt.aggregate({
      where: { assessmentId, learnerId },
      _max: { attemptNumber: true },
    });
    return (result._max.attemptNumber ?? 0) + 1;
  }

  createAttempt(
    tx: Prisma.TransactionClient,
    data: Prisma.QuizAttemptUncheckedCreateInput,
  ) {
    return tx.quizAttempt.create({ data });
  }

  /** The answer of one question is the whole set of options chosen: the old rows go, the new ones are written. */
  async replaceAnswer(
    tx: Prisma.TransactionClient,
    organizationId: string,
    attemptId: string,
    questionId: string,
    optionIds: string[],
  ) {
    await tx.quizAttemptAnswer.deleteMany({ where: { attemptId, questionId } });
    if (optionIds.length > 0) {
      await tx.quizAttemptAnswer.createMany({
        data: optionIds.map((optionId) => ({
          organizationId,
          attemptId,
          questionId,
          optionId,
        })),
      });
    }
  }

  /**
   * Closes the attempt only if nobody did it before (the condition makes a second call, a second instance of the service
   * or the job and a request at the same moment all write once). Returns the number of rows changed: 1 or 0.
   */
  async closeAttempt(
    tx: Prisma.TransactionClient,
    attemptId: string,
    submittedAt: Date,
    submissionKind: string,
    score: number,
  ): Promise<number> {
    const result = await tx.quizAttempt.updateMany({
      where: { id: attemptId, submittedAt: null },
      data: { submittedAt, submissionKind, score },
    });
    return result.count;
  }

  submittedAttempts(
    tx: Prisma.TransactionClient,
    assessmentId: string,
    learnerId: string,
  ) {
    return tx.quizAttempt.findMany({
      where: { assessmentId, learnerId, submittedAt: { not: null } },
      select: { id: true, score: true, attemptNumber: true, submittedAt: true },
    });
  }

  /** Attempts past their deadline that nobody submitted: of one Learner (and Course), or of everybody for the job. */
  findExpired(
    now: Date,
    scope: { learnerId?: string; courseId?: string; assessmentId?: string },
    limit = 200,
  ) {
    return this.prisma.quizAttempt.findMany({
      where: {
        submittedAt: null,
        deadlineAt: { lte: now },
        ...(scope.learnerId ? { learnerId: scope.learnerId } : {}),
        ...(scope.assessmentId ? { assessmentId: scope.assessmentId } : {}),
        ...(scope.courseId ? { assessment: { courseId: scope.courseId } } : {}),
      },
      orderBy: { deadlineAt: 'asc' },
      take: limit,
      select: { id: true, assessmentId: true, learnerId: true },
    });
  }

  emitSignal(tx: Prisma.TransactionClient, signal: CompletionSignal) {
    return emitCompletionSignal(tx, signal);
  }
}
