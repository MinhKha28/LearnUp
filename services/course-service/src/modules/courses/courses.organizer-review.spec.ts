import type { CurrentUser } from '@learnup/ts-common';
import type { IReadableStorageProvider } from '@learnup/ts-storage';

import { CoursesService } from './courses.service';
import type { CoursesRepository } from './courses.repository';
import type { TenantClient } from '@infra/clients/tenant/tenant.client';
import type { LearningClient } from '@infra/clients/learning/learning.client';
import type { AssessmentClient } from '@/infrastructure/clients/assessment/assessment.client';
import type { NotificationClient } from '@/infrastructure/clients/notification/notification.client';

describe('UC21.2 - Organizer Course Review', () => {
  const courseId = '019a0000-0000-7000-8000-000000000001';

  const organizationId = '019a0000-0000-7000-8000-000000000002';

  const organizer = {
    userId: '019a0000-0000-7000-8000-000000000003',
    organizationId,
    role: 'ORGANIZER',
  } as CurrentUser;

  const repository = {
    findCourseForOrganizerReview: jest.fn(),
    findOrganizerReviewMaterial: jest.fn(),
    findOrganizerReviewAccess: jest.fn(),
  };

  const storage = {
    getSignedUrl: jest.fn(),
  };

  const service = new CoursesService(
    repository as unknown as CoursesRepository,
    {} as TenantClient,
    {} as LearningClient,
    {} as AssessmentClient,
    {} as NotificationClient,
    storage as unknown as IReadableStorageProvider,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('allows Organizer to review a Submitted Course', async () => {
    repository.findCourseForOrganizerReview.mockResolvedValue({
      id: courseId,
      name: 'Safety Course',
      shortDescription: 'Safety training',
      trainingObjectives: 'Identify risks',
      learningOutcomes: ['Identify hazards'],
      versionNumber: 1,
      courseType: 'Private',
      expectedCompletionDays: 14,
      status: 'Submitted',
      lockedAt: null,
      submittedAt: new Date(),
      chain: { instructorId: organizer.userId },
      modules: [],
    });

    const result = await service.getOrganizerCourseReview(organizer, courseId);

    expect(result.status).toBe('Submitted');

    expect(repository.findCourseForOrganizerReview).toHaveBeenCalledWith(
      organizationId,
      courseId,
    );
  });

  it('rejects Learner and Instructor', async () => {
    for (const role of ['LEARNER', 'INSTRUCTOR']) {
      await expect(
        service.getOrganizerCourseReview(
          { ...organizer, role } as CurrentUser,
          courseId,
        ),
      ).rejects.toMatchObject({ status: 403 });
    }

    expect(repository.findCourseForOrganizerReview).not.toHaveBeenCalled();
  });

  it('does not expose a Course from another Organization', async () => {
    repository.findCourseForOrganizerReview.mockResolvedValue(null);

    await expect(
      service.getOrganizerCourseReview(organizer, courseId),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects a Course that is no longer Submitted', async () => {
    repository.findCourseForOrganizerReview.mockResolvedValue({
      status: 'Draft',
    });

    await expect(
      service.getOrganizerCourseReview(organizer, courseId),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a Material outside the Course', async () => {
    repository.findOrganizerReviewMaterial.mockResolvedValue(null);

    await expect(
      service.getOrganizerMaterialPreview(
        organizer,
        courseId,
        '019a0000-0000-7000-8000-000000000004',
      ),
    ).rejects.toMatchObject({ status: 404 });

    expect(storage.getSignedUrl).not.toHaveBeenCalled();
  });
});
