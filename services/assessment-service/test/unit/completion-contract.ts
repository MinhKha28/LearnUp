/**
 * The rules of `validateCompletionSnapshot` of learning-service
 * (services/learning-service/src/infrastructure/clients/assessment/assessment-completion.client.ts), kept here because
 * the two services share no library. A snapshot that breaks any of them is rejected as INVALID_SNAPSHOT and no Learner
 * of the Course is marked Completed. Returns the list of rules broken; empty means learning accepts it.
 * If learning changes its validator, change this file and the tests that use it in the same PR.
 */
import { isUUID } from 'class-validator';

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

export function brokenRules(
  value: unknown,
  organizationId: string,
  learnerId: string,
  courseId: string,
): string[] {
  const broken: string[] = [];
  const need = (ok: boolean, rule: string) => {
    if (!ok) broken.push(rule);
  };
  if (!object(value)) return ['not an object'];
  need(
    only(value, [
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
    ]),
    'no unknown field at the top',
  );
  need(value.schemaVersion === 1, 'schemaVersion is 1');
  need(uuid(value.snapshotId), 'snapshotId is a UUID');
  need(date(value.asOf), 'asOf is a date ending in Z');
  need(
    typeof value.revision === 'string' && value.revision.length > 0,
    'revision is a non-empty string',
  );
  need(value.organizationId === organizationId, 'organizationId matches');
  need(value.learnerId === learnerId, 'learnerId matches');
  need(value.courseId === courseId, 'courseId matches');
  need(typeof value.eligible === 'boolean', 'eligible is a boolean');
  need(
    count(value.requiredComponentCount),
    'requiredComponentCount is a count',
  );
  if (!Array.isArray(value.quizzes) || !Array.isArray(value.assignments)) {
    broken.push('quizzes and assignments are arrays');
    return broken;
  }
  const ids = new Set<string>();
  let eligible = true;
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
    ) {
      broken.push('a Quiz has the right shape and a unique assessmentId');
      continue;
    }
    ids.add(q.assessmentId);
    const passed =
      q.attemptId !== null &&
      q.recordedScore !== null &&
      Number(q.recordedScore) >= Number(q.passingScore);
    need(q.passed === passed, 'Quiz passed matches the rule');
    eligible &&= passed;
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
    ) {
      broken.push(
        'an Assignment has the right shape and a unique assessmentId',
      );
      continue;
    }
    ids.add(a.assessmentId);
    const p = a.peerReview;
    const peerOk =
      only(p, ['status', 'requiredCount', 'completedCount']) &&
      ['NotApplicable', 'Pending', 'Satisfied', 'Missed'].includes(
        String(p.status),
      ) &&
      count(p.requiredCount) &&
      count(p.completedCount) &&
      p.completedCount <= p.requiredCount &&
      !(
        p.status === 'NotApplicable' &&
        (p.requiredCount !== 0 || p.completedCount !== 0)
      ) &&
      !(p.status === 'Satisfied' && p.completedCount !== p.requiredCount);
    need(peerOk, 'peerReview follows its rules');
    const passed =
      a.submissionId !== null &&
      a.finalizedAt !== null &&
      a.finalScore !== null &&
      Number(a.finalScore) >= Number(a.passingScore);
    need(a.passed === passed, 'Assignment passed matches the rule');
    eligible &&=
      passed && ['NotApplicable', 'Satisfied'].includes(String(p.status));
  }
  need(
    value.requiredComponentCount === ids.size,
    'requiredComponentCount equals the number of components',
  );
  need(value.eligible === eligible, 'eligible matches the rule of learning');
  return broken;
}
