import { createHash } from 'node:crypto';

/**
 * The completion snapshot learning-service asks for (CT-1): what a Learner has done in the Quizzes and Assignments that
 * a Course requires, in the shape its `validateCompletionSnapshot` accepts. Anything the validator rejects (an unknown
 * field, a score that is not a two-digit decimal, a `passed` or `eligible` that does not match the rule) means no
 * Learner of the Course is marked Completed, so the rules below follow the validator word for word.
 */

export type PeerReviewStatus =
  'NotApplicable' | 'Pending' | 'Satisfied' | 'Missed';

export interface CompletionSnapshot {
  schemaVersion: 1;
  snapshotId: string;
  asOf: string;
  revision: string;
  organizationId: string;
  learnerId: string;
  courseId: string;
  eligible: boolean;
  requiredComponentCount: number;
  quizzes: {
    assessmentId: string;
    attemptId: string | null;
    recordedScore: string | null;
    passingScore: string;
    passed: boolean;
  }[];
  assignments: {
    assessmentId: string;
    submissionId: string | null;
    finalScore: string | null;
    passingScore: string;
    finalizedAt: string | null;
    passed: boolean;
    peerReview: {
      status: PeerReviewStatus;
      requiredCount: number;
      completedCount: number;
    };
  }[];
}

/** A Decimal(5,2) from the database, as the text Prisma gives (`"85"`, `"85.5"`). */
type DecimalText = { toString(): string };

export interface QuizFacts {
  assessmentId: string;
  passingScore: DecimalText;
  /** Attempts that were submitted; an attempt still open or without a score is not a result. */
  attempts: { id: string; attemptNumber: number; score: DecimalText | null }[];
}

export interface AssignmentFacts {
  assessmentId: string;
  passingScore: DecimalText;
  /** The newest submission that was not replaced (BR-170), or null when the Learner never submitted. */
  latest: {
    id: string;
    gradingStatus: string;
    finalScore: DecimalText | null;
    finalizedAt: Date | null;
  } | null;
  /** The reviews this Learner has to give or gave for the Assignment, as a peer (never the Instructor's own). */
  reviews: { status: string; reviewDueAt: Date | null }[];
}

export const FINALIZED = 'Finalized';
const REVIEW_COMPLETED = 'Completed';
const REVIEW_MISSED = 'Missed';
const REVIEW_PENDING = 'Pending';

/** Fixed namespace of the snapshot ids (UUID v5), so the same content always gets the same id. */
const SNAPSHOT_NAMESPACE = 'f3d8e5a0-6b1c-5d2e-9a47-8c0e1b2d3f45';

/** A score of the database as the validator wants it: two decimals, never a leading zero, `0.00` to `100.00`. */
export const scoreText = (value: DecimalText): string =>
  Number(value.toString()).toFixed(2);

/** Hundredths as an integer, so two scores compare without the float error of `85.1 >= 85.10`. */
const hundredths = (value: DecimalText): number =>
  Math.round(Number(value.toString()) * 100);

/** UUID v5 (name-based, SHA-1): enough here, and no extra package for a dozen lines. */
export function uuidV5(name: string, namespace = SNAPSHOT_NAMESPACE): string {
  const space = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(space)
    .update(name, 'utf8')
    .digest()
    .subarray(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/** BR-198: the recorded score of a Quiz is the best submitted attempt; on a tie the earlier attempt. */
export function recordedAttempt(attempts: QuizFacts['attempts']) {
  let best: { id: string; score: DecimalText; attemptNumber: number } | null =
    null;
  for (const attempt of attempts) {
    if (attempt.score === null) continue;
    const candidate = {
      id: attempt.id,
      score: attempt.score,
      attemptNumber: attempt.attemptNumber,
    };
    if (
      best === null ||
      hundredths(candidate.score) > hundredths(best.score) ||
      (hundredths(candidate.score) === hundredths(best.score) &&
        candidate.attemptNumber < best.attemptNumber)
    )
      best = candidate;
  }
  return best;
}

/**
 * The peer review state of one Assignment for one Learner. Only the reviews the Learner owes as a peer count. Order:
 * nothing assigned is NotApplicable; any review missed is Missed; all done is Satisfied; the rest is Pending.
 * A Pending review past its deadline is Missed already, without waiting for the schedule that marks it.
 * Waived is not returned yet: learning does not accept it until L22 (it would be rejected as INVALID_SNAPSHOT).
 */
export function peerReviewOf(
  reviews: AssignmentFacts['reviews'],
  now: Date,
): CompletionSnapshot['assignments'][number]['peerReview'] {
  const requiredCount = reviews.length;
  if (requiredCount === 0)
    return { status: 'NotApplicable', requiredCount: 0, completedCount: 0 };
  const completedCount = reviews.filter(
    (review) => review.status === REVIEW_COMPLETED,
  ).length;
  const missed = reviews.some(
    (review) =>
      review.status === REVIEW_MISSED ||
      (review.status === REVIEW_PENDING &&
        review.reviewDueAt !== null &&
        review.reviewDueAt.getTime() < now.getTime()),
  );
  const status: PeerReviewStatus = missed
    ? 'Missed'
    : completedCount === requiredCount
      ? 'Satisfied'
      : 'Pending';
  return { status, requiredCount, completedCount };
}

export function buildCompletionSnapshot(input: {
  organizationId: string;
  learnerId: string;
  courseId: string;
  quizzes: QuizFacts[];
  assignments: AssignmentFacts[];
  now: Date;
}): CompletionSnapshot {
  const quizzes = input.quizzes.map((quiz) => {
    const best = recordedAttempt(quiz.attempts);
    const passed =
      best !== null && hundredths(best.score) >= hundredths(quiz.passingScore);
    return {
      assessmentId: quiz.assessmentId,
      attemptId: best?.id ?? null,
      recordedScore: best ? scoreText(best.score) : null,
      passingScore: scoreText(quiz.passingScore),
      passed,
    };
  });

  const assignments = input.assignments.map((assignment) => {
    // Only a finalized grade is a result (BR-212); an unfinished one shows the submission but no score yet.
    const latest = assignment.latest;
    const graded =
      latest !== null &&
      latest.gradingStatus === FINALIZED &&
      latest.finalScore !== null &&
      latest.finalizedAt !== null
        ? { score: latest.finalScore, at: latest.finalizedAt }
        : null;
    const passed =
      graded !== null &&
      hundredths(graded.score) >= hundredths(assignment.passingScore);
    return {
      assessmentId: assignment.assessmentId,
      submissionId: latest?.id ?? null,
      finalScore: graded ? scoreText(graded.score) : null,
      passingScore: scoreText(assignment.passingScore),
      finalizedAt: graded ? graded.at.toISOString() : null,
      passed,
      peerReview: peerReviewOf(assignment.reviews, input.now),
    };
  });

  const eligible =
    quizzes.every((quiz) => quiz.passed) &&
    assignments.every(
      (assignment) =>
        assignment.passed &&
        (assignment.peerReview.status === 'NotApplicable' ||
          assignment.peerReview.status === 'Satisfied'),
    );

  // The revision changes when, and only when, what the Learner did changes; `asOf` and `snapshotId` do not feed it.
  const content = { quizzes, assignments };
  const revision = createHash('sha256')
    .update(JSON.stringify(content))
    .digest('hex');
  return {
    schemaVersion: 1,
    snapshotId: uuidV5(
      [input.organizationId, input.learnerId, input.courseId, revision].join(
        '/',
      ),
    ),
    asOf: input.now.toISOString(),
    revision,
    organizationId: input.organizationId,
    learnerId: input.learnerId,
    courseId: input.courseId,
    eligible,
    requiredComponentCount: quizzes.length + assignments.length,
    quizzes,
    assignments,
  };
}
