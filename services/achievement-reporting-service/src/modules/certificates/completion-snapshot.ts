import { isUUID } from 'class-validator';

export const ASSESSMENT_COMPLETION_CLIENT = Symbol(
  'ASSESSMENT_COMPLETION_CLIENT',
);
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
      status: 'NotApplicable' | 'Pending' | 'Satisfied' | 'Missed' | 'Waived';
      requiredCount: number;
      completedCount: number;
    };
  }[];
}
export interface AssessmentCompletionClient {
  getCompletionSnapshot(
    organizationId: string,
    learnerId: string,
    courseId: string,
  ): Promise<CompletionSnapshot>;
}
export class CompletionClientError extends Error {
  constructor(readonly code: 'INVALID_SNAPSHOT' | 'ASSESSMENT_UNAVAILABLE') {
    super(code);
  }
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const only = (v: Record<string, unknown>, fields: string[]) =>
  Object.keys(v).every((key) => fields.includes(key));
const count = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0;
const date = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d\d-\d\dT.*Z$/.test(v) &&
  Number.isFinite(Date.parse(v));
const uuid = (v: unknown): v is string =>
  typeof v === 'string' && isUUID(v, 'all');
const score = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^(?:0|[1-9]\d?)(?:\.\d{1,2})?$|^100(?:\.0{1,2})?$/.test(v);
export function validateCompletionSnapshot(
  value: unknown,
  organizationId: string,
  learnerId: string,
  courseId: string,
): CompletionSnapshot {
  const fail = (): never => {
    throw new CompletionClientError('INVALID_SNAPSHOT');
  };
  if (!object(value)) return fail();
  if (
    !only(value, [
      'schemaVersion',
      'snapshotId',
      'asOf',
      'revision',
      'organizationId',
      'learnerId',
      'courseId',
      'eligible',
      'requiredComponentCount',
      'quizzes',
      'assignments',
    ]) ||
    value.schemaVersion !== 1 ||
    !uuid(value.snapshotId) ||
    !date(value.asOf) ||
    typeof value.revision !== 'string' ||
    !value.revision.length ||
    value.organizationId !== organizationId ||
    value.learnerId !== learnerId ||
    value.courseId !== courseId ||
    typeof value.eligible !== 'boolean' ||
    !count(value.requiredComponentCount) ||
    !Array.isArray(value.quizzes) ||
    !Array.isArray(value.assignments)
  )
    return fail();
  const ids = new Set<string>();
  for (const q of value.quizzes) {
    if (
      !object(q) ||
      !only(q, [
        'assessmentId',
        'attemptId',
        'recordedScore',
        'passingScore',
        'passed',
      ]) ||
      !uuid(q.assessmentId) ||
      ids.has(q.assessmentId) ||
      !(q.attemptId === null || uuid(q.attemptId)) ||
      !(q.recordedScore === null || score(q.recordedScore)) ||
      !score(q.passingScore) ||
      typeof q.passed !== 'boolean'
    )
      return fail();
    ids.add(q.assessmentId);
  }
  for (const a of value.assignments) {
    if (
      !object(a) ||
      !only(a, [
        'assessmentId',
        'submissionId',
        'finalScore',
        'passingScore',
        'finalizedAt',
        'passed',
        'peerReview',
      ]) ||
      !uuid(a.assessmentId) ||
      ids.has(a.assessmentId) ||
      !(a.submissionId === null || uuid(a.submissionId)) ||
      !(a.finalScore === null || score(a.finalScore)) ||
      !score(a.passingScore) ||
      !(a.finalizedAt === null || date(a.finalizedAt)) ||
      typeof a.passed !== 'boolean' ||
      !object(a.peerReview)
    )
      return fail();
    ids.add(a.assessmentId);
    const p = a.peerReview;
    if (
      !only(p, ['status', 'requiredCount', 'completedCount']) ||
      typeof p.status !== 'string' ||
      !['NotApplicable', 'Pending', 'Satisfied', 'Missed', 'Waived'].includes(
        String(p.status),
      ) ||
      !count(p.requiredCount) ||
      !count(p.completedCount) ||
      p.completedCount > p.requiredCount ||
      (p.status === 'NotApplicable' &&
        (p.requiredCount !== 0 || p.completedCount !== 0)) ||
      (p.status === 'Satisfied' && p.completedCount !== p.requiredCount)
    )
      return fail();
  }
  if (value.requiredComponentCount !== ids.size) return fail();
  return value as unknown as CompletionSnapshot;
}
