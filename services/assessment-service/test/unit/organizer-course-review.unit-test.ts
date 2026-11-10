import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';

import { AssessmentsService } from '../../src/modules/assessments/assessments.service';
import type { AssessmentsRepository } from '../../src/modules/assessments/assessments.repository';
import type { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import type { RubricsService } from '../../src/modules/rubrics/rubrics.service';
import type { AssignmentMediaService } from '../../src/modules/assessments/assignment-media.service';

const organizationId = '019a0000-0000-7000-8000-000000000002';

const courseId = '019a0000-0000-7000-8000-000000000001';

const organizer = {
  userId: '019a0000-0000-7000-8000-000000000003',
  organizationId,
  role: 'ORGANIZER',
} as CurrentUser;

const build = () => {
  let verified = false;
  let queried = false;

  const repository = {
    findCourseAssessmentsForOrganizer: async () => {
      queried = true;
      return [];
    },
  };

  const courses = {
    verifyOrganizerReviewAccess: async () => {
      verified = true;
    },
  };

  const service = new AssessmentsService(
    repository as unknown as AssessmentsRepository,
    courses as unknown as CourseServiceClient,
    {} as RubricsService,
    {} as AssignmentMediaService,
  );

  return {
    service,
    get verified() {
      return verified;
    },
    get queried() {
      return queried;
    },
  };
};

describe('UC21.2 - Organizer Assessment Review', () => {
  test('allows Organizer to retrieve an empty list', async () => {
    const fixture = build();

    const result = await fixture.service.getOrganizerAssessmentReview(
      organizer,
      courseId,
    );

    assert.deepEqual(result, {
      courseId,
      items: [],
    });

    assert.equal(fixture.verified, true);
    assert.equal(fixture.queried, true);
  });

  test('rejects Learner before querying data', async () => {
    const fixture = build();

    await assert.rejects(
      () =>
        fixture.service.getOrganizerAssessmentReview(
          {
            ...organizer,
            role: 'LEARNER',
          } as CurrentUser,
          courseId,
        ),
      (error: any) => error.getStatus() === 403,
    );

    assert.equal(fixture.verified, false);
    assert.equal(fixture.queried, false);
  });

  test('does not query Assessment if Course verification fails', async () => {
    let queried = false;

    const repository = {
      findCourseAssessmentsForOrganizer: async () => {
        queried = true;
        return [];
      },
    };

    const courses = {
      verifyOrganizerReviewAccess: async () => {
        throw new Error('Course not available');
      },
    };

    const service = new AssessmentsService(
      repository as unknown as AssessmentsRepository,
      courses as unknown as CourseServiceClient,
      {} as RubricsService,
      {} as AssignmentMediaService,
    );

    await assert.rejects(
      () => service.getOrganizerAssessmentReview(organizer, courseId),
      /Course not available/,
    );

    assert.equal(queried, false);
  });

  test('maps Quiz answer keys and Assignment Peer Review settings', async () => {
    const base = {
      courseId,
      moduleId: null,
      position: 1,
      disabledAt: null,
      passingScore: 70,
      isRequired: true,
      timeLimitMinutes: 15,
      maxConsecutiveAttempts: 3,
      lockoutHours: 0,
      expectedDurationMinutes: null,
      prompt: null,
      promptFileName: null,
      peerReviewEnabled: false,
      peerReviewersPerSubmission: null,
      peerReviewCycleDays: null,
      peerReviewDeadlineDays: null,
      peerReviewScoreGap: null,
      questions: [],
      rubricCriteria: [],
    };
    const rows = [
      {
        ...base,
        id: '019a0000-0000-7000-8000-000000000010',
        kind: 'QUIZ',
        title: 'Knowledge check',
        questions: [{
          id: '019a0000-0000-7000-8000-000000000011',
          position: 1,
          questionType: 'SingleChoice',
          content: 'Wear a helmet?',
          options: [{
            id: '019a0000-0000-7000-8000-000000000012',
            position: 1,
            content: 'Yes',
            isCorrect: true,
          }],
        }],
      },
      {
        ...base,
        id: '019a0000-0000-7000-8000-000000000020',
        kind: 'ASSIGNMENT',
        title: 'Safety exercise',
        prompt: 'Submit a safety report.',
        promptFileName: 'instructions.pdf',
        peerReviewEnabled: true,
        peerReviewersPerSubmission: 2,
        peerReviewCycleDays: 7,
        peerReviewDeadlineDays: 3,
        peerReviewScoreGap: 12.5,
        rubricCriteria: [{
          id: '019a0000-0000-7000-8000-000000000021',
          position: 1,
          name: 'Accuracy',
          description: 'Correct findings',
          maxPoints: 100,
        }],
      },
    ];

    const service = new AssessmentsService(
      {
        findCourseAssessmentsForOrganizer: async () => rows,
      } as unknown as AssessmentsRepository,
      {
        verifyOrganizerReviewAccess: async () => undefined,
      } as unknown as CourseServiceClient,
      {} as RubricsService,
      {} as AssignmentMediaService,
    );

    const result = await service.getOrganizerAssessmentReview(organizer, courseId);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].questions[0].options[0].isCorrect, true);
    assert.equal(result.items[1].promptFileName, 'instructions.pdf');
    assert.equal(result.items[1].peerReviewersPerSubmission, 2);
    assert.equal(result.items[1].peerReviewCycleDays, 7);
    assert.equal(result.items[1].peerReviewDeadlineDays, 3);
    assert.equal(result.items[1].peerReviewScoreGap, 12.5);
    assert.equal(result.items[1].rubric[0].maxPoints, 100);
  });

  test('rejects Learner attachment downloads without querying Course or storage', async () => {
    let queried = false;
    let verified = false;
    let storageRead = false;
    const service = new AssessmentsService(
      {
        findOrganizerAssignmentPrompt: async () => {
          queried = true;
          return { promptFileKey: 'secret' };
        },
      } as unknown as AssessmentsRepository,
      {
        verifyOrganizerReviewAccess: async () => {
          verified = true;
        },
      } as unknown as CourseServiceClient,
      {} as RubricsService,
      {
        readPromptFile: async () => {
          storageRead = true;
          return Buffer.from('secret');
        },
      } as unknown as AssignmentMediaService,
    );

    await assert.rejects(
      () => service.downloadOrganizerAssignmentPrompt(
        { ...organizer, role: 'LEARNER' } as CurrentUser,
        courseId,
        '019a0000-0000-7000-8000-000000000020',
      ),
      (error: any) => error.getStatus() === 403,
    );
    assert.equal(verified, false);
    assert.equal(queried, false);
    assert.equal(storageRead, false);
  });


  test('denies Instructor access to Organizer assessment review', async () => {
    const fixture = build();

    await assert.rejects(
      () => fixture.service.getOrganizerAssessmentReview(
        { ...organizer, role: 'INSTRUCTOR' } as CurrentUser,
        courseId,
      ),
      (error: any) => error.getStatus() === 403,
    );

    assert.equal(fixture.verified, false);
    assert.equal(fixture.queried, false);
  });

  test('denies Instructor attachment download before Course verification or storage', async () => {
    let verified = false;
    let queried = false;
    let storageRead = false;
    const service = new AssessmentsService(
      {
        findOrganizerAssignmentPrompt: async () => {
          queried = true;
          return { promptFileKey: 'secret' };
        },
      } as unknown as AssessmentsRepository,
      {
        verifyOrganizerReviewAccess: async () => {
          verified = true;
        },
      } as unknown as CourseServiceClient,
      {} as RubricsService,
      {
        readPromptFile: async () => {
          storageRead = true;
          return Buffer.from('secret');
        },
      } as unknown as AssignmentMediaService,
    );

    await assert.rejects(
      () => service.downloadOrganizerAssignmentPrompt(
        { ...organizer, role: 'INSTRUCTOR' } as CurrentUser,
        courseId,
        '019a0000-0000-7000-8000-000000000020',
      ),
      (error: any) => error.getStatus() === 403,
    );

    assert.equal(verified, false);
    assert.equal(queried, false);
    assert.equal(storageRead, false);
  });

  test('does not query assignment or storage when Course verification denies download', async () => {
    let queried = false;
    let storageRead = false;
    const service = new AssessmentsService(
      {
        findOrganizerAssignmentPrompt: async () => {
          queried = true;
          return { promptFileKey: 'secret' };
        },
      } as unknown as AssessmentsRepository,
      {
        verifyOrganizerReviewAccess: async () => {
          throw new Error('Course not available');
        },
      } as unknown as CourseServiceClient,
      {} as RubricsService,
      {
        readPromptFile: async () => {
          storageRead = true;
          return Buffer.from('secret');
        },
      } as unknown as AssignmentMediaService,
    );

    await assert.rejects(
      () => service.downloadOrganizerAssignmentPrompt(
        organizer,
        courseId,
        '019a0000-0000-7000-8000-000000000020',
      ),
      /Course not available/,
    );

    assert.equal(queried, false);
    assert.equal(storageRead, false);
  });

  test('downloads an Organizer attachment only after Course verification', async () => {
    const calls: string[] = [];
    const content = Buffer.from('sample-pdf');
    const service = new AssessmentsService(
      {
        findOrganizerAssignmentPrompt: async () => {
          calls.push('query');
          return {
            promptFileKey: 'prompt-key',
            promptFileName: 'instructions.pdf',
            promptFileMime: 'application/pdf',
          };
        },
      } as unknown as AssessmentsRepository,
      {
        verifyOrganizerReviewAccess: async () => {
          calls.push('verify');
        },
      } as unknown as CourseServiceClient,
      {} as RubricsService,
      {
        readPromptFile: async (key: string) => {
          calls.push('storage:' + key);
          return content;
        },
      } as unknown as AssignmentMediaService,
    );

    const result = await service.downloadOrganizerAssignmentPrompt(
      organizer,
      courseId,
      '019a0000-0000-7000-8000-000000000020',
    );

    assert.deepEqual(calls, ['verify', 'query', 'storage:prompt-key']);
    assert.equal(result.fileName, 'instructions.pdf');
    assert.equal(result.mimeType, 'application/pdf');
    assert.deepEqual(result.content, content);
  });

  test('returns PROMPT_FILE_NOT_FOUND without reading storage', async () => {
    let storageRead = false;
    let verified = false;
    const service = new AssessmentsService(
      {
        findOrganizerAssignmentPrompt: async () => ({
          promptFileKey: null,
        }),
      } as unknown as AssessmentsRepository,
      {
        verifyOrganizerReviewAccess: async () => {
          verified = true;
        },
      } as unknown as CourseServiceClient,
      {} as RubricsService,
      {
        readPromptFile: async () => {
          storageRead = true;
          return Buffer.from('secret');
        },
      } as unknown as AssignmentMediaService,
    );

    await assert.rejects(
      () => service.downloadOrganizerAssignmentPrompt(
        organizer,
        courseId,
        '019a0000-0000-7000-8000-000000000020',
      ),
      (error: any) =>
        error.getStatus() === 404 &&
        error.getResponse().code === 'PROMPT_FILE_NOT_FOUND',
    );

    assert.equal(verified, true);
    assert.equal(storageRead, false);
  });

});
