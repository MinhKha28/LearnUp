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
});
