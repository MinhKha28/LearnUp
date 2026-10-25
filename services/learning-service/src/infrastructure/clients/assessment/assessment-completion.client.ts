import { isUUID } from 'class-validator';
import { randomUUID } from 'node:crypto';

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
      status: 'NotApplicable' | 'Pending' | 'Satisfied' | 'Missed';
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
    )
      return fail();
    ids.add(q.assessmentId);
    const passed =
      q.attemptId !== null &&
      q.recordedScore !== null &&
      Number(q.recordedScore) >= Number(q.passingScore);
    if (q.passed !== passed) return fail();
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
    )
      return fail();
    ids.add(a.assessmentId);
    const p = a.peerReview;
    if (
      !only(p, ['status', 'requiredCount', 'completedCount']) ||
      !['NotApplicable', 'Pending', 'Satisfied', 'Missed'].includes(
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
    const passed =
      a.submissionId !== null &&
      a.finalizedAt !== null &&
      a.finalScore !== null &&
      Number(a.finalScore) >= Number(a.passingScore);
    if (a.passed !== passed) return fail();
    eligible &&=
      passed && ['NotApplicable', 'Satisfied'].includes(String(p.status));
  }
  if (value.requiredComponentCount !== ids.size || value.eligible !== eligible)
    return fail();
  return value as unknown as CompletionSnapshot;
}

/** Fixtures are keyed by all three IDs; every result goes through the HTTP validator too. */
export class FakeAssessmentCompletionClient implements AssessmentCompletionClient {
  constructor(private readonly timeoutMs = 3000) {}
  readonly fixtures = new Map<
    string,
    { value: unknown; delayMs?: number; unavailable?: boolean }
  >();
  async getCompletionSnapshot(
    organizationId: string,
    learnerId: string,
    courseId: string,
  ): Promise<CompletionSnapshot> {
    const fixture = this.fixtures.get(
      [organizationId, learnerId, courseId].join('/'),
    );
    if (fixture?.delayMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(fixture.delayMs!, this.timeoutMs)),
      );
      if (fixture.delayMs >= this.timeoutMs)
        throw new CompletionClientError('ASSESSMENT_UNAVAILABLE');
    }
    if (fixture?.unavailable)
      throw new CompletionClientError('ASSESSMENT_UNAVAILABLE');
    if (!fixture)
      return validateCompletionSnapshot(
        {
          schemaVersion: 1,
          snapshotId: randomUUID(),
          asOf: new Date().toISOString(),
          revision: 'fake-default',
          organizationId,
          learnerId,
          courseId,
          eligible: false,
          requiredComponentCount: 1,
          quizzes: [
            {
              assessmentId: randomUUID(),
              attemptId: null,
              recordedScore: null,
              passingScore: '100',
              passed: false,
            },
          ],
          assignments: [],
        },
        organizationId,
        learnerId,
        courseId,
      );
    return validateCompletionSnapshot(
      fixture.value,
      organizationId,
      learnerId,
      courseId,
    );
  }
}

export function createCompletionClient(
  get: (key: string) => string | undefined,
): AssessmentCompletionClient {
  const mode = get('ASSESSMENT_COMPLETION_CLIENT_MODE') ?? 'http';
  if (mode === 'fake') {
    if (get('NODE_ENV') === 'production')
      throw new Error(
        'ASSESSMENT_COMPLETION_CLIENT_MODE=fake is forbidden in production',
      );
    return new FakeAssessmentCompletionClient(completionTimeout(get));
  }
  if (mode !== 'http')
    throw new Error('ASSESSMENT_COMPLETION_CLIENT_MODE must be fake or http');
  const rawUrl =
    get('ASSESSMENT_SERVICE_URL') ?? 'http://assessment-service:8086';
  const url = new URL(rawUrl);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid assessment completion URL');
  const timeout = completionTimeout(get);
  const key = get('INTERNAL_SERVICE_KEY');
  if (!key)
    throw new Error('Missing INTERNAL_SERVICE_KEY for completion client');
  return {
    async getCompletionSnapshot(organizationId, learnerId, courseId) {
      let value: unknown;
      try {
        const response = await fetch(
          `${url.toString().replace(/\/+$/, '')}/api/v1/internal/learners/${encodeURIComponent(learnerId)}/courses/${encodeURIComponent(courseId)}/completion-snapshot`,
          {
            headers: {
              'x-internal-key': key,
              'x-organization-id': organizationId,
            },
            signal: AbortSignal.timeout(timeout),
          },
        );
        if (!response.ok) throw new Error();
        const body: unknown = await response.json();
        value = object(body) ? body.data : undefined;
      } catch {
        throw new CompletionClientError('ASSESSMENT_UNAVAILABLE');
      }
      return validateCompletionSnapshot(
        value,
        organizationId,
        learnerId,
        courseId,
      );
    },
  };
}
export function completionTimeout(
  get: (key: string) => string | undefined,
): number {
  const timeout = Number(get('ASSESSMENT_COMPLETION_TIMEOUT_MS') ?? 3000);
  if (!Number.isSafeInteger(timeout) || timeout < 1)
    throw new Error('Invalid ASSESSMENT_COMPLETION_TIMEOUT_MS');
  return timeout;
}
