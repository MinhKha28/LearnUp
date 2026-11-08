import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from 'generated/prisma/client';
import { bestAttemptOf, gradeAttempt } from './quiz-grading';
import { HOUR_MS, SUBMISSION_TIMED_OUT } from './quiz-attempts.constants';
import {
  type AttemptRow,
  type QuizRow,
  QuizAttemptsRepository,
} from './quiz-attempts.repository';

export interface IClosedAttempt {
  attemptId: string;
  score: number;
  correct: number;
  total: number;
  submittedAt: Date;
  submissionKind: string;
  consecutiveCount: number;
  lockedUntil: Date | null;
}

/**
 * Ends Quiz attempts: grades them (BR-197), counts them for the lock (BR-218), records the best one (BR-198) and tells
 * Learning Service (QUIZ_SUBMITTED) in the same transaction. Used by the Learner pressing submit, and by the three ways
 * an attempt that ran out of time is submitted for the Learner (BR-200): the reading of the attempt, the lists that need
 * its score, and the job that runs by itself.
 */
@Injectable()
export class QuizAttemptSettler {
  private readonly logger = new Logger(QuizAttemptSettler.name);

  constructor(private readonly repository: QuizAttemptsRepository) {}

  /**
   * Closes the attempt. The caller holds the lock of the Learner and Quiz and has checked that the attempt is open.
   * Returns null when somebody closed it first (the conditional update changed no row), so nothing is counted twice.
   */
  async close(
    tx: Prisma.TransactionClient,
    quiz: QuizRow,
    attempt: AttemptRow,
    submittedAt: Date,
    submissionKind: string,
    now: Date,
  ): Promise<IClosedAttempt | null> {
    const answers = new Map<string, string[]>();
    for (const answer of attempt.answers) {
      const list = answers.get(answer.questionId) ?? [];
      list.push(answer.optionId);
      answers.set(answer.questionId, list);
    }
    const graded = gradeAttempt(
      quiz.questions.map((question) => ({
        id: question.id,
        correctOptionIds: question.options
          .filter((option) => option.isCorrect)
          .map((option) => option.id),
      })),
      answers,
    );
    const changed = await this.repository.closeAttempt(
      tx,
      attempt.id,
      submittedAt,
      submissionKind,
      graded.score,
    );
    if (changed === 0) return null;

    const state = await this.repository.ensureState(
      tx,
      attempt.organizationId,
      attempt.assessmentId,
      attempt.learnerId,
      attempt.startedAt,
    );
    // BR-201: the attempt was counted when it started; the lock begins when the n-th one is submitted, even by time-out.
    const lockedUntil =
      state.consecutiveCount >= quiz.maxConsecutiveAttempts
        ? new Date(submittedAt.getTime() + quiz.lockoutHours * HOUR_MS)
        : null;
    const submitted = (
      await this.repository.submittedAttempts(
        tx,
        attempt.assessmentId,
        attempt.learnerId,
      )
    ).map((row) => ({
      id: row.id,
      attemptNumber: row.attemptNumber,
      submittedAt: row.submittedAt,
      score: row.score === null ? null : Number(row.score.toString()),
    }));
    const updated = await this.repository.updateState(tx, state.id, {
      lockedUntil,
      recordedAttemptId: bestAttemptOf(submitted),
    });
    await this.repository.emitSignal(tx, {
      stateId: updated.id,
      organizationId: attempt.organizationId,
      assessmentId: attempt.assessmentId,
      courseId: quiz.courseId,
      learnerId: attempt.learnerId,
      kind: 'QUIZ',
      reason: 'QUIZ_SUBMITTED',
      status: 'Submitted',
      extra: {
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        score: graded.score,
        submissionKind,
        consecutiveCount: state.consecutiveCount,
        lockedUntil: lockedUntil?.toISOString() ?? null,
      },
      now,
    });
    return {
      attemptId: attempt.id,
      score: graded.score,
      correct: graded.correct,
      total: graded.total,
      submittedAt,
      submissionKind,
      consecutiveCount: state.consecutiveCount,
      lockedUntil,
    };
  }

  /**
   * Submits, at the deadline, the attempts past it that nobody submitted. It is what the job runs every tick and what a
   * screen runs for one Learner (and Course) before it shows scores. Running it again changes nothing: each attempt is
   * claimed with `WHERE submitted_at IS NULL` under the lock of its Learner and Quiz. The time of the submission is the
   * deadline itself, so it makes no difference which of the three ways settles it, or when.
   */
  async settleExpired(
    now: Date,
    scope: {
      learnerId?: string;
      courseId?: string;
      assessmentId?: string;
    } = {},
  ): Promise<number> {
    let settled = 0;
    for (const found of await this.repository.findExpired(now, scope)) {
      try {
        settled += await this.settleOne(
          found.id,
          found.assessmentId,
          found.learnerId,
          now,
        );
      } catch (error) {
        this.logger.error(
          `Settling attempt ${found.id} failed: ${String(error)}`,
        );
      }
    }
    return settled;
  }

  private settleOne(
    attemptId: string,
    assessmentId: string,
    learnerId: string,
    now: Date,
  ): Promise<number> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, assessmentId, learnerId);
      const attempt = await this.repository.findAttempt(attemptId, tx);
      if (!attempt || attempt.submittedAt || attempt.deadlineAt > now) return 0;
      const quiz = await this.repository.findQuizOfAttempt(attemptId, tx);
      if (!quiz) return 0;
      const closed = await this.close(
        tx,
        quiz,
        attempt,
        attempt.deadlineAt,
        SUBMISSION_TIMED_OUT,
        now,
      );
      return closed ? 1 : 0;
    });
  }
}
