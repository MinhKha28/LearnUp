import { HEADER_NAMES, type CurrentUser } from '@learnup/ts-common';
import { isUUID } from 'class-validator';
import {
  AssessmentUnavailableError,
  type AssessmentActivity,
  type AssessmentClient,
} from './assessment.client';

export function createAssessmentClient(
  get: (key: string) => string | undefined,
): AssessmentClient {
  const mode = get('ASSESSMENT_CLIENT_MODE')?.trim();
  if (mode === 'fake') {
    if (get('NODE_ENV') === 'production')
      throw new Error(
        'ASSESSMENT_CLIENT_MODE=fake không được dùng khi NODE_ENV=production.',
      );
    const raw = get('ASSESSMENT_FAKE_RESULT_COURSE_IDS')?.trim();
    const ids = raw ? raw.split(',').map((id) => id.trim()) : [];
    if (ids.some((id) => !isUUID(id, 'all')))
      throw new Error(
        'ASSESSMENT_FAKE_RESULT_COURSE_IDS phải là danh sách UUID phân tách bằng dấu phẩy.',
      );
    const courses = new Set(ids.map((id) => id.toLowerCase()));
    return {
      getActivity: (_user, courseId) => {
        const value = courses.has(courseId.toLowerCase());
        return Promise.resolve({
          hasQuizAttempt: value,
          hasSubmission: value,
          hasPeerReviewGiven: value,
        });
      },
    };
  }
  if (mode !== 'http')
    throw new Error('ASSESSMENT_CLIENT_MODE phải là fake hoặc http.');
  let url: URL;
  try {
    url = new URL(get('ASSESSMENT_SERVICE_URL')?.trim() ?? '');
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
    throw new Error('Thiếu INTERNAL_SERVICE_KEY cho assessment client.');
  const timeout = Number(get('ASSESSMENT_SERVICE_TIMEOUT_MS') ?? 3000);
  if (!Number.isSafeInteger(timeout) || timeout < 1)
    throw new Error('ASSESSMENT_SERVICE_TIMEOUT_MS phải là số nguyên dương.');
  return new HttpAssessmentClient(
    url.toString().replace(/\/+$/, ''),
    key,
    timeout,
  );
}

export class HttpAssessmentClient implements AssessmentClient {
  constructor(
    private readonly baseUrl: string,
    private readonly key: string,
    private readonly timeoutMs: number,
  ) {}

  async getActivity(
    user: CurrentUser,
    courseId: string,
  ): Promise<AssessmentActivity> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/internal/learners/${encodeURIComponent(user.userId)}/courses/${encodeURIComponent(courseId)}/assessment-activity`,
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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as {
        data?: Partial<AssessmentActivity>;
      } | null;
      const data = body?.data;
      if (
        !data ||
        typeof data.hasQuizAttempt !== 'boolean' ||
        typeof data.hasSubmission !== 'boolean' ||
        typeof data.hasPeerReviewGiven !== 'boolean'
      )
        throw new Error('Assessment trả sai hợp đồng.');
      return data as AssessmentActivity;
    } catch {
      throw new AssessmentUnavailableError(
        'Không thể kiểm tra hoạt động đánh giá.',
      );
    }
  }
}
