import { describe, expect, it, jest } from '@jest/globals';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import type { IReadableStorageProvider } from '@learnup/ts-storage';
import { of } from 'rxjs';

import type { AssessmentClient } from '@infra/clients/assessment/assessment.client';
import type { LearningClient } from '@infra/clients/learning/learning.client';
import type { NotificationClient } from '@infra/clients/notification/notification.client';
import { TenantClient } from '@infra/clients/tenant/tenant.client';
import type { CoursesRepository } from './courses.repository';
import { CoursesService } from './courses.service';

describe('Organizer Course list', () => {
  it('matches the names returned by Tenant and shows a fallback for a missing Instructor', async () => {
    const organizer: CurrentUser = {
      userId: 'organizer-id',
      organizationId: 'organization-id',
      role: 'ORGANIZER',
      isAuthenticated: true,
    };
    const instructor = { id: 'instructor-id', fullName: 'Demo Instructor' };
    const missingInstructorId = 'missing-instructor-id';
    const post = jest.fn(() => of({ data: { data: [instructor] } }));
    const tenantClient = new TenantClient(
      { post } as unknown as HttpService,
      new ConfigService({
        TENANT_SERVICE_URL: 'https://tenant.example',
        INTERNAL_SERVICE_KEY: 'test-internal-key',
      }),
    );
    const repository = {
      findOrganizationCourses: jest.fn(async () => [
        [
          { id: 'course-a', chain: { instructorId: instructor.id } },
          { id: 'course-b', chain: { instructorId: missingInstructorId } },
        ],
        2,
      ]),
    };
    const learningClient = {
      getCourseLearnerCounts: jest.fn(async () => []),
    };
    const service = new CoursesService(
      repository as unknown as CoursesRepository,
      tenantClient,
      learningClient as unknown as LearningClient,
      {} as AssessmentClient,
      {} as NotificationClient,
      {} as IReadableStorageProvider,
    );

    const page = await service.findOrganizationCourses(organizer, {
      current: 1,
      pageSize: 10,
    });

    expect(post.mock.calls).toEqual([
      [
        'https://tenant.example/api/v1/users/batch',
        { userIds: [instructor.id, missingInstructorId] },
        expect.anything(),
      ],
    ]);
    expect(page.result.map((course) => course.instructor)).toEqual([
      instructor,
      { id: missingInstructorId, fullName: 'Unknown Instructor' },
    ]);
  });
});
