import type { CurrentUser } from '@learnup/ts-common';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EnrollmentClient } from '../../infrastructure/clients/learning/enrollment.client';
import {
  assertCanWrite,
  attemptStateOf,
  isReadOnly,
  lockExpired,
  requireAccess,
  requireLearner,
} from '../learner-submissions/learner-access';
import type {
  IAttemptInProgress,
  IAttemptResult,
  IAttemptView,
  ILearnerQuiz,
  ISavedAnswer,
} from './interfaces/quiz-attempt.interface';
import { allowsSeveralOptions } from './quiz-grading';
import {
  MINUTE_MS,
  SUBMISSION_MANUAL,
  SUBMISSION_TIMED_OUT,
} from './quiz-attempts.constants';
import {
  type AttemptRow,
  type QuizRow,
  QuizAttemptsRepository,
} from './quiz-attempts.repository';
import { QuizAttemptSettler } from './quiz-attempt-settler';

const toNumber = (value: { toString(): string } | null | undefined) =>
  value === null || value === undefined ? null : Number(value.toString());

const secondsLeft = (deadline: Date, now: Date) =>
  Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));

/** The ids of the options chosen, by question. */
function chosenBy(attempt: AttemptRow): Map<string, string[]> {
  const chosen = new Map<string, string[]>();
  for (const answer of attempt.answers) {
    const list = chosen.get(answer.questionId) ?? [];
    list.push(answer.optionId);
    chosen.set(answer.questionId, list);
  }
  return chosen;
}

@Injectable()
export class QuizAttemptsService {
  /** The clock; a test replaces it to travel in time. */
  clock: () => Date = () => new Date();

  constructor(
    private readonly repository: QuizAttemptsRepository,
    private readonly settler: QuizAttemptSettler,
    private readonly enrollments: EnrollmentClient,
  ) {}

  /** UC29.1 step 1: the Quiz as the Learner sees it before starting: rules, tries left, lock, the attempt to continue. */
  async getQuiz(user: CurrentUser, quizId: string): Promise<ILearnerQuiz> {
    const organizationId = requireLearner(user);
    const quiz = await this.requireQuiz(organizationId, quizId);
    const access = await requireAccess(this.enrollments, user, quiz.courseId);
    const now = this.clock();
    await this.settler.settleExpired(now, {
      assessmentId: quiz.id,
      learnerId: user.userId,
    });
    const [state, attempts] = await Promise.all([
      this.repository.findState(quiz.id, user.userId),
      this.repository.findAttempts(quiz.id, user.userId),
    ]);
    const submitted = attempts.filter((a) => a.submittedAt !== null);
    const scores = submitted
      .map((a) => toNumber(a.score))
      .filter((s): s is number => s !== null);
    // BR-198: the recorded score is the best attempt.
    const recordedScore = scores.length ? Math.max(...scores) : null;
    const passingScore = Number(quiz.passingScore.toString());
    return {
      id: quiz.id,
      courseId: quiz.courseId,
      title: quiz.title,
      passingScore,
      timeLimitMinutes: quiz.timeLimitMinutes,
      questionCount: quiz.questions.length,
      isRequired: quiz.isRequired,
      readOnly: isReadOnly(access),
      attempts: attemptStateOf(quiz, state, now),
      inProgressAttemptId:
        attempts.find((a) => a.submittedAt === null)?.id ?? null,
      recordedScore,
      passed: recordedScore === null ? null : recordedScore >= passingScore,
      submittedAttemptCount: submitted.length,
    };
  }

  /**
   * UC29.1 steps 2-4: start an attempt. The attempt counts from this moment (BR-201): it is one of the n in a row, it is
   * the first activity of the Learner on the Quiz, and the deadline is fixed now. A Learner has one attempt at a time:
   * asking again while one is running gives that attempt back instead of opening another.
   */
  async start(user: CurrentUser, quizId: string): Promise<IAttemptView> {
    const organizationId = requireLearner(user);
    const quiz = await this.requireQuiz(organizationId, quizId);
    const access = await requireAccess(this.enrollments, user, quiz.courseId);
    // Settled in a transaction of its own and before the checks below: a refusal (locked, Completed, disabled) rolls back
    // the transaction it is thrown in, and the submission of the attempt that ran out of time must not roll back with it.
    await this.settler.settleExpired(this.clock(), {
      assessmentId: quiz.id,
      learnerId: user.userId,
    });

    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, quiz.id, user.userId);
      const now = this.clock();
      const fresh = await this.repository.findQuiz(organizationId, quiz.id, tx);
      if (!fresh) throw this.quizNotFound();
      let attempts = await this.repository.findAttempts(
        quiz.id,
        user.userId,
        tx,
      );
      // An attempt past its deadline that nobody submitted yet is submitted first, at its deadline (BR-200), under this
      // same lock: it may be the n-th one and lock the Quiz, and it must not stay open next to the new attempt.
      const stale = attempts.filter(
        (a) =>
          a.submittedAt === null && a.deadlineAt.getTime() <= now.getTime(),
      );
      for (const old of stale) {
        await this.settler.close(
          tx,
          fresh,
          old,
          old.deadlineAt,
          SUBMISSION_TIMED_OUT,
          now,
        );
      }
      if (stale.length > 0) {
        attempts = await this.repository.findAttempts(quiz.id, user.userId, tx);
      }
      const running = attempts.find(
        (a) => a.submittedAt === null && a.deadlineAt.getTime() > now.getTime(),
      );
      // BR-211: an attempt that began before the Enrollment was Completed may be continued.
      if (running) {
        return { ...this.inProgressView(fresh, running, now), resumed: true };
      }

      if (fresh.disabledAt) {
        throw new ConflictException({
          code: 'ASSESSMENT_DISABLED',
          message: 'This Quiz is disabled.',
        });
      }
      assertCanWrite(
        access,
        'The Course is completed, so no new attempt can be started.',
      );
      const state = await this.repository.findState(quiz.id, user.userId, tx);
      if (state?.lockedUntil && state.lockedUntil.getTime() > now.getTime()) {
        throw new ConflictException({
          code: 'ASSESSMENT_LOCKED',
          message: `You have done ${fresh.maxConsecutiveAttempts} attempts in a row. You can start again at ${state.lockedUntil.toISOString()}.`,
          lockedUntil: state.lockedUntil.toISOString(),
        });
      }
      if (fresh.questions.length === 0) {
        throw new UnprocessableEntityException({
          code: 'QUIZ_HAS_NO_QUESTIONS',
          message: 'This Quiz has no question yet.',
        });
      }
      if (!fresh.timeLimitMinutes) {
        throw new UnprocessableEntityException({
          code: 'QUIZ_HAS_NO_TIME_LIMIT',
          message: 'This Quiz has no time limit set.',
        });
      }

      const current = await this.repository.ensureState(
        tx,
        organizationId,
        quiz.id,
        user.userId,
        now,
      );
      // BR-218: when the lock has run out, counting starts again from this attempt.
      const baseCount = lockExpired(current, now)
        ? 0
        : current.consecutiveCount;
      const attempt = await this.repository.createAttempt(tx, {
        organizationId,
        assessmentId: quiz.id,
        learnerId: user.userId,
        attemptNumber: await this.repository.nextAttemptNumber(
          tx,
          quiz.id,
          user.userId,
        ),
        startedAt: now,
        deadlineAt: new Date(
          now.getTime() + fresh.timeLimitMinutes * MINUTE_MS,
        ),
      });
      const updated = await this.repository.updateState(tx, current.id, {
        consecutiveCount: baseCount + 1,
        lockedUntil: null,
      });
      await this.repository.emitSignal(tx, {
        stateId: updated.id,
        organizationId,
        assessmentId: quiz.id,
        courseId: quiz.courseId,
        learnerId: user.userId,
        kind: 'QUIZ',
        reason: 'QUIZ_STARTED',
        status: 'Started',
        extra: {
          attemptId: attempt.id,
          attemptNumber: attempt.attemptNumber,
          consecutiveCount: baseCount + 1,
          deadlineAt: attempt.deadlineAt.toISOString(),
        },
        now,
      });
      return this.inProgressView(fresh, { ...attempt, answers: [] }, now);
    });
  }

  /** The attempt as it stands: the questions and the answers saved so far, or the result when it is over. */
  async getAttempt(
    user: CurrentUser,
    attemptId: string,
  ): Promise<IAttemptView> {
    const { quiz, attempt } = await this.loadOwn(user, attemptId);
    return this.viewOf(user, quiz, attempt);
  }

  /**
   * UC29.1 step 3: the choice is saved the moment the Learner makes it, so it survives a closed tab or a lost
   * connection (BR-200), and the time-out grades what was saved. Once the deadline has passed nothing is accepted.
   */
  async saveAnswer(
    user: CurrentUser,
    attemptId: string,
    questionId: string,
    optionIds: string[],
  ): Promise<ISavedAnswer> {
    const { quiz, attempt } = await this.loadOwn(user, attemptId);
    const question = quiz.questions.find((q) => q.id === questionId);
    if (!question) {
      throw new NotFoundException({
        code: 'QUESTION_NOT_FOUND',
        message: 'This question is not in the Quiz.',
      });
    }
    const valid = new Set(question.options.map((o) => o.id));
    if (optionIds.some((id) => !valid.has(id))) {
      throw new UnprocessableEntityException({
        code: 'OPTION_NOT_IN_QUESTION',
        message: 'An option does not belong to this question.',
      });
    }
    if (optionIds.length > 1 && !allowsSeveralOptions(question.questionType)) {
      throw new UnprocessableEntityException({
        code: 'TOO_MANY_OPTIONS',
        message: 'This question takes one answer only.',
      });
    }

    const outcome = await this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, quiz.id, user.userId);
      const now = this.clock();
      const current = await this.repository.findAttempt(attempt.id, tx);
      if (!current || current.submittedAt) return { refused: 'SUBMITTED' };
      if (current.deadlineAt.getTime() <= now.getTime()) {
        return { refused: 'EXPIRED' };
      }
      await this.repository.replaceAnswer(
        tx,
        attempt.organizationId,
        attempt.id,
        question.id,
        optionIds,
      );
      return {
        saved: {
          questionId: question.id,
          selectedOptionIds: optionIds,
          remainingSeconds: secondsLeft(current.deadlineAt, now),
        } satisfies ISavedAnswer,
      };
    });
    if ('saved' in outcome && outcome.saved) return outcome.saved;
    if (outcome.refused === 'EXPIRED') {
      // The time ran out: the system submits the attempt now, with the answers saved, so the Learner finds the result.
      await this.settler.settleExpired(this.clock(), {
        assessmentId: quiz.id,
        learnerId: user.userId,
      });
      throw new ConflictException({
        code: 'ATTEMPT_EXPIRED',
        message:
          'The time is over. The attempt was submitted with the answers saved.',
      });
    }
    throw new ConflictException({
      code: 'ATTEMPT_SUBMITTED',
      message: 'This attempt has been submitted.',
    });
  }

  /** UC29.1 steps 5-6: submit, grade and answer with the result at once. Submitting twice returns the same result. */
  async submit(user: CurrentUser, attemptId: string): Promise<IAttemptResult> {
    const { quiz, attempt } = await this.loadOwn(user, attemptId);
    const closedNow = await this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, quiz.id, user.userId);
      const now = this.clock();
      const current = await this.repository.findAttempt(attempt.id, tx);
      const fresh = await this.repository.findQuiz(
        attempt.organizationId,
        quiz.id,
        tx,
      );
      if (!current || !fresh || current.submittedAt) return false;
      const onTime = current.deadlineAt.getTime() > now.getTime();
      // BR-200: past the deadline the attempt is submitted at the deadline, with what was saved.
      const closed = await this.settler.close(
        tx,
        fresh,
        current,
        onTime ? now : current.deadlineAt,
        onTime ? SUBMISSION_MANUAL : SUBMISSION_TIMED_OUT,
        now,
      );
      return closed !== null;
    });
    const reread = await this.repository.findAttempt(attempt.id);
    const view = reread && (await this.viewOf(user, quiz, reread));
    if (!view || view.status !== 'Submitted') {
      throw new ConflictException({
        code: 'ATTEMPT_NOT_CLOSED',
        message: 'The attempt could not be submitted.',
      });
    }
    return closedNow ? view : { ...view, alreadySubmitted: true };
  }

  // ----------------------------------------------------------------- views

  private async viewOf(
    user: CurrentUser,
    quiz: QuizRow,
    attempt: AttemptRow,
  ): Promise<IAttemptView> {
    let row = attempt;
    const now = this.clock();
    if (row.submittedAt === null && row.deadlineAt.getTime() <= now.getTime()) {
      await this.settler.settleExpired(now, {
        assessmentId: quiz.id,
        learnerId: user.userId,
      });
      row = (await this.repository.findAttempt(row.id)) ?? row;
    }
    if (row.submittedAt === null) return this.inProgressView(quiz, row, now);
    return this.resultView(user, quiz, row);
  }

  private inProgressView(
    quiz: QuizRow,
    attempt: AttemptRow,
    now: Date,
  ): IAttemptInProgress {
    const chosen = chosenBy(attempt);
    return {
      status: 'InProgress',
      attemptId: attempt.id,
      assessmentId: quiz.id,
      attemptNumber: attempt.attemptNumber,
      title: quiz.title,
      startedAt: attempt.startedAt.toISOString(),
      deadlineAt: attempt.deadlineAt.toISOString(),
      serverNow: now.toISOString(),
      remainingSeconds: secondsLeft(attempt.deadlineAt, now),
      questions: quiz.questions.map((question) => ({
        id: question.id,
        position: question.position,
        type: question.questionType,
        content: question.content,
        // the answer key (`isCorrect`) is never copied into what a Learner receives
        options: question.options.map((option) => ({
          id: option.id,
          position: option.position,
          content: option.content,
        })),
        selectedOptionIds: chosen.get(question.id) ?? [],
      })),
    };
  }

  private async resultView(
    user: CurrentUser,
    quiz: QuizRow,
    attempt: AttemptRow,
  ): Promise<IAttemptResult> {
    const score = toNumber(attempt.score) ?? 0;
    const passingScore = Number(quiz.passingScore.toString());
    const [state, all] = await Promise.all([
      this.repository.findState(quiz.id, user.userId),
      this.repository.findAttempts(quiz.id, user.userId),
    ]);
    const scores = all
      .filter((a) => a.submittedAt !== null)
      .map((a) => toNumber(a.score))
      .filter((s): s is number => s !== null);
    const recordedScore = scores.length ? Math.max(...scores) : null;
    const chosen = chosenBy(attempt);
    const correctCount = quiz.questions.filter((question) => {
      const key = question.options.filter((o) => o.isCorrect).map((o) => o.id);
      const picked = new Set(chosen.get(question.id) ?? []);
      return (
        picked.size > 0 &&
        picked.size === key.length &&
        key.every((id) => picked.has(id))
      );
    }).length;
    return {
      status: 'Submitted',
      attemptId: attempt.id,
      assessmentId: quiz.id,
      attemptNumber: attempt.attemptNumber,
      title: quiz.title,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt!.toISOString(),
      submissionKind: attempt.submissionKind ?? SUBMISSION_MANUAL,
      score,
      passed: score >= passingScore,
      correctCount,
      totalQuestions: quiz.questions.length,
      passingScore,
      recordedScore,
      recordedPassed:
        recordedScore === null ? null : recordedScore >= passingScore,
      attempts: attemptStateOf(quiz, state, this.clock()),
    };
  }

  // ----------------------------------------------------------------- loading

  private quizNotFound() {
    return new NotFoundException({
      code: 'QUIZ_NOT_FOUND',
      message: 'Quiz not found.',
    });
  }

  private async requireQuiz(organizationId: string, quizId: string) {
    const quiz = await this.repository.findQuiz(organizationId, quizId);
    if (!quiz) throw this.quizNotFound();
    return quiz;
  }

  /** An attempt of this Learner, in this Organization; the Course access is checked here too (BR-210, BR-211). */
  private async loadOwn(user: CurrentUser, attemptId: string) {
    const organizationId = requireLearner(user);
    const attempt = await this.repository.findAttempt(attemptId);
    if (
      !attempt ||
      attempt.learnerId !== user.userId ||
      attempt.organizationId !== organizationId
    ) {
      throw new NotFoundException({
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found.',
      });
    }
    const quiz = await this.requireQuiz(organizationId, attempt.assessmentId);
    // Halted and Withdrawn close the screen; Completed only stops new work, a running attempt is finished (BR-211).
    await requireAccess(this.enrollments, user, quiz.courseId);
    return { quiz, attempt };
  }
}
