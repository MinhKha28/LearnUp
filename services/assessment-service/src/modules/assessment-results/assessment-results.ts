import type {
  IAssessmentResult,
  IAssessmentResultQuizAttempt,
} from './interfaces/assessment-results.interface';

export interface ResultAssessment {
  id: string;
  kind: string;
  title: string;
  isRequired: boolean;
  disabledAt: Date | null;
  passingScore: number;
}

export interface ResultAttempt {
  assessmentId: string;
  attemptNumber: number;
  startedAt: Date;
  submittedAt: Date | null;
  submissionKind: string | null;
  score: number | null;
}

export interface ResultSubmission {
  assessmentId: string;
  submissionNumber: number;
  submittedAt: Date;
  gradingStatus: string;
  finalScore: number | null;
  /** Set when a newer submission replaced this one (BR-170). */
  supersededAt: Date | null;
}

const FINALIZED = 'Finalized';

/**
 * UC28.1: one row for each Quiz or Assignment the Learner has done something on. A component with no attempt and no
 * submission is left out ("đã thực hiện"). The score rules are the ones of the rest of the service: the best submitted
 * attempt for a Quiz (BR-198, the earlier attempt on a tie), the final score of the latest submission that was not
 * replaced for an Assignment, which counts only once it is Finalized (BR-212). The most recent activity comes first.
 */
export function buildAssessmentResults(
  assessments: ResultAssessment[],
  attempts: ResultAttempt[],
  submissions: ResultSubmission[],
): IAssessmentResult[] {
  const results: (IAssessmentResult & { sortKey: number })[] = [];
  for (const assessment of assessments) {
    if (assessment.kind === 'ASSIGNMENT') {
      const mine = submissions
        .filter((s) => s.assessmentId === assessment.id)
        .sort((a, b) => b.submissionNumber - a.submissionNumber);
      // the latest one that was not replaced; with no such row (it cannot happen) the newest stands
      const latest = mine.find((s) => s.supersededAt === null) ?? mine[0];
      if (!latest) continue;
      const finalized =
        latest.gradingStatus === FINALIZED && latest.finalScore !== null;
      const recordedScore = finalized ? latest.finalScore : null;
      results.push({
        assessmentId: assessment.id,
        kind: 'ASSIGNMENT',
        title: assessment.title,
        isRequired: true,
        disabled: assessment.disabledAt !== null,
        passingScore: assessment.passingScore,
        status: finalized ? 'Completed' : 'AwaitingResult',
        recordedScore,
        passed:
          recordedScore === null
            ? null
            : recordedScore >= assessment.passingScore,
        attemptCount: mine.length,
        lastActivityAt: latest.submittedAt.toISOString(),
        quiz: null,
        assignment: {
          latestSubmissionNumber: latest.submissionNumber,
          gradingStatus: latest.gradingStatus,
        },
        sortKey: latest.submittedAt.getTime(),
      });
      continue;
    }

    const mine = attempts
      .filter((a) => a.assessmentId === assessment.id)
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
    if (mine.length === 0) continue;
    const submitted = mine.filter(
      (a): a is ResultAttempt & { submittedAt: Date; score: number } =>
        a.submittedAt !== null && a.score !== null,
    );
    let best: (typeof submitted)[number] | null = null;
    for (const attempt of submitted) {
      if (best === null || attempt.score > best.score) best = attempt;
    }
    const running = mine.some((a) => a.submittedAt === null);
    const last = mine[mine.length - 1];
    const lastAt = last.submittedAt ?? last.startedAt;
    const recordedScore = best?.score ?? null;
    const history: IAssessmentResultQuizAttempt[] = submitted.map((a) => ({
      attemptNumber: a.attemptNumber,
      score: a.score,
      submittedAt: a.submittedAt.toISOString(),
      submissionKind: a.submissionKind,
    }));
    results.push({
      assessmentId: assessment.id,
      kind: 'QUIZ',
      title: assessment.title,
      isRequired: assessment.isRequired,
      disabled: assessment.disabledAt !== null,
      passingScore: assessment.passingScore,
      status: running ? 'InProgress' : 'Completed',
      recordedScore,
      passed:
        recordedScore === null
          ? null
          : recordedScore >= assessment.passingScore,
      attemptCount: submitted.length,
      lastActivityAt: lastAt.toISOString(),
      quiz: {
        bestAttemptNumber: best?.attemptNumber ?? null,
        attempts: history,
      },
      assignment: null,
      sortKey: lastAt.getTime(),
    });
  }
  return results
    .sort((a, b) => b.sortKey - a.sortKey || a.title.localeCompare(b.title))
    .map(({ sortKey, ...item }) => {
      void sortKey; // only for the order
      return item;
    });
}
