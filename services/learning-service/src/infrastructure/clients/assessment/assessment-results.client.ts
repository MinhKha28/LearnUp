import { HEADER_NAMES, type CurrentUser } from '@learnup/ts-common';
import { isUUID } from 'class-validator';

export const ASSESSMENT_RESULTS_CLIENT = Symbol('ASSESSMENT_RESULTS_CLIENT');

/** UC28.1: what the Learner did on one Quiz or Assignment of a Course, as assessment-service reports it. */
export interface AssessmentResultItem {
  assessmentId: string;
  kind: 'QUIZ' | 'ASSIGNMENT';
  title: string;
  isRequired: boolean;
  /** BR-296: the component is disabled; its score stays but it no longer counts for the Certificate. */
  disabled: boolean;
  passingScore: number;
  status: 'InProgress' | 'AwaitingResult' | 'Completed';
  recordedScore: number | null;
  passed: boolean | null;
  attemptCount: number;
  lastActivityAt: string;
  quiz: {
    bestAttemptNumber: number | null;
    attempts: {
      attemptNumber: number;
      score: number;
      submittedAt: string;
      submissionKind: string | null;
    }[];
  } | null;
  assignment: { latestSubmissionNumber: number; gradingStatus: string } | null;
}

export interface AssessmentResults {
  courseId: string;
  items: AssessmentResultItem[];
}

export interface AssessmentResultsClient {
  getResults(user: CurrentUser, courseId: string): Promise<AssessmentResults>;
}

/** assessment-service did not answer, answered an error, or answered something that is not the contract. */
export class AssessmentResultsUnavailableError extends Error {
  constructor(
    readonly reason: 'UNREACHABLE' | 'HTTP_ERROR' | 'INVALID_RESPONSE',
    readonly httpStatus?: number,
  ) {
    super(reason);
  }
}

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const score = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const count = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0;
const iso = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v) &&
  !Number.isNaN(Date.parse(v));

function invalid(): never {
  throw new AssessmentResultsUnavailableError('INVALID_RESPONSE');
}

function validateItem(raw: unknown): AssessmentResultItem {
  if (!object(raw)) return invalid();
  const {
    assessmentId,
    kind,
    title,
    isRequired,
    disabled,
    passingScore,
    status,
    recordedScore,
    passed,
    attemptCount,
    lastActivityAt,
    quiz,
    assignment,
  } = raw;
  if (
    !isUUID(assessmentId, 'all') ||
    (kind !== 'QUIZ' && kind !== 'ASSIGNMENT') ||
    !text(title) ||
    typeof isRequired !== 'boolean' ||
    typeof disabled !== 'boolean' ||
    !score(passingScore) ||
    !['InProgress', 'AwaitingResult', 'Completed'].includes(String(status)) ||
    !(recordedScore === null || score(recordedScore)) ||
    !(passed === null || typeof passed === 'boolean') ||
    !count(attemptCount) ||
    !iso(lastActivityAt)
  )
    return invalid();
  // a score and its verdict come together: one without the other is not a result
  if ((recordedScore === null) !== (passed === null)) return invalid();
  if (recordedScore !== null && passed !== recordedScore >= passingScore)
    return invalid();
  if (status === 'Completed' && recordedScore === null) return invalid();

  let quizPart: AssessmentResultItem['quiz'] = null;
  let assignmentPart: AssessmentResultItem['assignment'] = null;
  if (kind === 'QUIZ') {
    if (assignment !== null || !object(quiz)) return invalid();
    const attempts = quiz.attempts;
    if (
      !Array.isArray(attempts) ||
      !(quiz.bestAttemptNumber === null || count(quiz.bestAttemptNumber))
    )
      return invalid();
    quizPart = {
      bestAttemptNumber: quiz.bestAttemptNumber,
      attempts: attempts.map((a: unknown) => {
        if (
          !object(a) ||
          !count(a.attemptNumber) ||
          !score(a.score) ||
          !iso(a.submittedAt) ||
          !(a.submissionKind === null || text(a.submissionKind))
        )
          return invalid();
        return {
          attemptNumber: a.attemptNumber,
          score: a.score,
          submittedAt: a.submittedAt,
          submissionKind: a.submissionKind,
        };
      }),
    };
  } else {
    if (quiz !== null || !object(assignment)) return invalid();
    if (
      !count(assignment.latestSubmissionNumber) ||
      !text(assignment.gradingStatus)
    )
      return invalid();
    assignmentPart = {
      latestSubmissionNumber: assignment.latestSubmissionNumber,
      gradingStatus: assignment.gradingStatus,
    };
  }
  return {
    assessmentId: assessmentId as string,
    kind,
    title,
    isRequired,
    disabled,
    passingScore,
    status: status as AssessmentResultItem['status'],
    recordedScore,
    passed,
    attemptCount,
    lastActivityAt,
    quiz: quizPart,
    assignment: assignmentPart,
  };
}

/** The `data` of the answer, checked against the contract and against the Course that was asked for. */
export function validateAssessmentResults(
  value: unknown,
  courseId: string,
): AssessmentResults {
  if (
    !object(value) ||
    value.courseId !== courseId ||
    !Array.isArray(value.items)
  )
    return invalid();
  const items = value.items.map(validateItem);
  if (new Set(items.map((i) => i.assessmentId)).size !== items.length)
    return invalid();
  return { courseId, items };
}

/** For demos without assessment-service: the Courses in `ASSESSMENT_FAKE_RESULT_COURSE_IDS` have two sample results. */
export class FakeAssessmentResultsClient implements AssessmentResultsClient {
  constructor(private readonly courseIds: Set<string>) {}

  getResults(_user: CurrentUser, courseId: string): Promise<AssessmentResults> {
    if (!this.courseIds.has(courseId.toLowerCase()))
      return Promise.resolve({ courseId, items: [] });
    const now = new Date().toISOString();
    return Promise.resolve({
      courseId,
      items: [
        {
          assessmentId: '00000000-0000-4000-8000-00000000f001',
          kind: 'QUIZ',
          title: 'Bài kiểm tra mẫu',
          isRequired: true,
          disabled: false,
          passingScore: 70,
          status: 'Completed',
          recordedScore: 85,
          passed: true,
          attemptCount: 1,
          lastActivityAt: now,
          quiz: {
            bestAttemptNumber: 1,
            attempts: [
              {
                attemptNumber: 1,
                score: 85,
                submittedAt: now,
                submissionKind: 'Manual',
              },
            ],
          },
          assignment: null,
        },
        {
          assessmentId: '00000000-0000-4000-8000-00000000f002',
          kind: 'ASSIGNMENT',
          title: 'Bài tập mẫu',
          isRequired: true,
          disabled: false,
          passingScore: 60,
          status: 'AwaitingResult',
          recordedScore: null,
          passed: null,
          attemptCount: 1,
          lastActivityAt: now,
          quiz: null,
          assignment: {
            latestSubmissionNumber: 1,
            gradingStatus: 'AwaitingInstructor',
          },
        },
      ],
    });
  }
}

export class HttpAssessmentResultsClient implements AssessmentResultsClient {
  constructor(
    private readonly baseUrl: string,
    private readonly key: string,
    private readonly timeoutMs: number,
  ) {}

  async getResults(
    user: CurrentUser,
    courseId: string,
  ): Promise<AssessmentResults> {
    let httpStatus: number | undefined;
    let body: unknown;
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/internal/learners/${encodeURIComponent(user.userId)}/courses/${encodeURIComponent(courseId)}/assessment-results`,
        {
          headers: {
            [HEADER_NAMES.INTERNAL_KEY]: this.key,
            [HEADER_NAMES.USER_ID]: user.userId,
            [HEADER_NAMES.USER_ROLE]: user.role,
            [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId!,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
      httpStatus = response.status;
      if (!response.ok)
        throw new AssessmentResultsUnavailableError('HTTP_ERROR', httpStatus);
      body = await response.json();
    } catch (error) {
      if (error instanceof AssessmentResultsUnavailableError) throw error;
      if (error instanceof SyntaxError)
        throw new AssessmentResultsUnavailableError(
          'INVALID_RESPONSE',
          httpStatus,
        );
      throw new AssessmentResultsUnavailableError('UNREACHABLE', httpStatus);
    }
    return validateAssessmentResults(
      object(body) ? body.data : undefined,
      courseId,
    );
  }
}

export function createAssessmentResultsClient(
  get: (key: string) => string | undefined,
): AssessmentResultsClient {
  const mode = get('ASSESSMENT_RESULTS_CLIENT_MODE')?.trim() || 'http';
  if (mode === 'fake') {
    if (get('NODE_ENV') === 'production')
      throw new Error(
        'ASSESSMENT_RESULTS_CLIENT_MODE=fake không được dùng khi NODE_ENV=production.',
      );
    const raw = get('ASSESSMENT_FAKE_RESULT_COURSE_IDS')?.trim();
    const ids = raw ? raw.split(',').map((id) => id.trim()) : [];
    if (ids.some((id) => !isUUID(id, 'all')))
      throw new Error(
        'ASSESSMENT_FAKE_RESULT_COURSE_IDS phải là danh sách UUID phân tách bằng dấu phẩy.',
      );
    return new FakeAssessmentResultsClient(
      new Set(ids.map((id) => id.toLowerCase())),
    );
  }
  if (mode !== 'http')
    throw new Error('ASSESSMENT_RESULTS_CLIENT_MODE phải là fake hoặc http.');
  let url: URL;
  try {
    url = new URL(
      get('ASSESSMENT_SERVICE_URL')?.trim() || 'http://assessment-service:8086',
    );
  } catch {
    throw new Error('ASSESSMENT_SERVICE_URL không hợp lệ.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      'ASSESSMENT_SERVICE_URL phải là URL HTTP(S) không chứa thông tin đăng nhập, query hoặc fragment.',
    );
  const key = get('INTERNAL_SERVICE_KEY')?.trim();
  if (!key)
    throw new Error(
      'Thiếu INTERNAL_SERVICE_KEY cho assessment results client.',
    );
  const timeout = Number(get('ASSESSMENT_RESULTS_TIMEOUT_MS') ?? 3000);
  if (!Number.isSafeInteger(timeout) || timeout < 1)
    throw new Error('ASSESSMENT_RESULTS_TIMEOUT_MS phải là số nguyên dương.');
  return new HttpAssessmentResultsClient(
    url.toString().replace(/\/+$/, ''),
    key,
    timeout,
  );
}
