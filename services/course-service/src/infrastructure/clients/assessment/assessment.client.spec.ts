import { of, throwError } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { AssessmentClient } from './assessment.client';

describe('UC20 AssessmentClient', () => {
  const user = {
    userId: '019a0000-0000-7000-8000-000000000001',
    organizationId: '019a0000-0000-7000-8000-000000000002',
    role: 'INSTRUCTOR',
  } as CurrentUser;
  const courseId = '019a0000-0000-7000-8000-000000000003';
  const get = jest.fn();
  const getOrThrow = jest.fn();
  const client = new AssessmentClient(
    { get } as unknown as HttpService,
    { getOrThrow } as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    getOrThrow.mockImplementation((key: string) => {
      if (key === 'ASSESSMENT_SERVICE_URL') return 'http://assessment:8086/';
      if (key === 'INTERNAL_SERVICE_KEY') return 'test-key';
      throw new Error('Unexpected config key');
    });
  });

  it('retrieves Quiz summaries with the current Instructor context', async () => {
    const items = [{ id: 'quiz-id', questionCount: 2 }];
    get.mockReturnValue(of({ data: { data: { items, meta: { total: 1 } } } }));

    await expect(client.getCourseQuizzes(user, courseId)).resolves.toEqual(items);
    expect(get).toHaveBeenCalledWith(
      'http://assessment:8086/api/v1/assessments/quizzes',
      expect.objectContaining({
        params: { courseId },
        headers: expect.objectContaining({
          'x-organization-id': user.organizationId,
          'x-user-role': 'INSTRUCTOR',
          'x-internal-key': 'test-key',
        }),
      }),
    );
  });

  it('maps missing Assessment URL to 503 ASSESSMENT_UNAVAILABLE', async () => {
    getOrThrow.mockImplementation(() => { throw new Error('Missing configuration'); });

    await expect(client.getCourseQuizzes(user, courseId)).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({ code: 'ASSESSMENT_UNAVAILABLE' }),
    });
    expect(get).not.toHaveBeenCalled();
  });

  it('maps unavailable Assessment Service to 503', async () => {
    get.mockReturnValue(throwError(() => new Error('Connection refused')));

    await expect(client.getCourseQuizzes(user, courseId)).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({ code: 'ASSESSMENT_UNAVAILABLE' }),
    });
  });

  it('rejects invalid Quiz responses', async () => {
    get.mockReturnValue(of({
      data: { data: { items: [{ id: 'quiz', questionCount: -1 }], meta: { total: 2 } } },
    }));

    await expect(client.getCourseQuizzes(user, courseId)).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({ code: 'INVALID_ASSESSMENT_RESPONSE' }),
    });
  });
});
