import type { CompletionSnapshot } from '../../infrastructure/clients/assessment/assessment-completion.client';

/** Learning's completion facts, shared by the worker and the read-only progress view. */
export function assessmentConditions(snapshot: CompletionSnapshot) {
  return [
    ...snapshot.quizzes.map((q) => ({
      kind: 'quiz' as const,
      assessmentId: q.assessmentId,
      assessment: q.passed,
      passed:
        q.attemptId !== null &&
        q.recordedScore !== null &&
        Number(q.recordedScore) >= Number(q.passingScore),
      peerReview: null,
    })),
    ...snapshot.assignments.map((a) => ({
      kind: 'assignment' as const,
      assessmentId: a.assessmentId,
      assessment: a.passed,
      passed:
        a.submissionId !== null &&
        a.finalizedAt !== null &&
        a.finalScore !== null &&
        Number(a.finalScore) >= Number(a.passingScore),
      peerReview: {
        ...a.peerReview,
        done: ['Waived', 'NotApplicable', 'Satisfied'].includes(
          a.peerReview.status,
        ),
      },
    })),
  ].map((item) => ({
    ...item,
    learning: item.passed && (item.peerReview?.done ?? true),
  }));
}
