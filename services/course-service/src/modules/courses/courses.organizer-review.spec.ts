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
    readBytes: jest.fn(),
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

  it('returns protected PDF bytes for an inline preview without marking attachment', async () => {
    const materialId = '019a0000-0000-7000-8000-000000000005';
    const pdf = Buffer.from('%PDF-1.7 test document');
    repository.findOrganizerReviewMaterial.mockResolvedValue({
      materialType: 'Reading',
      disabledAt: null,
      lesson: { disabledAt: null },
      file: {
        organizationId,
        status: 'Ready',
        readyAt: new Date(),
        releasedAt: null,
        deliveryType: 'authenticated',
        purpose: 'LessonReading',
        mimeType: 'application/pdf',
        storageKey: 'secured/test.pdf',
        storageFormat: '',
        originalFilename: 'test.pdf',
        sizeBytes: BigInt(pdf.length),
      },
    });
    storage.getSignedUrl.mockReturnValue('https://example.invalid/signed');
    storage.readBytes.mockResolvedValue(pdf);

    await expect(service.readOrganizerReadingPreview(
      organizer, courseId, materialId,
    )).resolves.toEqual(pdf);

    expect(storage.readBytes).toHaveBeenCalledWith(
      'secured/test.pdf',
      expect.objectContaining({
        resourceType: 'raw',
        attachment: false,
        deliveryType: 'authenticated',
        maxSizeBytes: 50 * 1024 * 1024,
      }),
    );
    expect(storage.getSignedUrl).toHaveBeenCalledWith(
      'secured/test.pdf',
      expect.objectContaining({ attachment: false }),
    );
  });

  it('never fetches bytes when the reviewer cannot access the Material', async () => {
    repository.findOrganizerReviewMaterial.mockResolvedValue(null);
    await expect(service.readOrganizerReadingPreview(
      organizer, courseId, '019a0000-0000-7000-8000-000000000005',
    )).rejects.toMatchObject({ status: 404 });
    expect(storage.readBytes).not.toHaveBeenCalled();
  });


  it('does not read PDF bytes after the Material is disabled between authorization and storage access', async () => {
    const materialId = '019a0000-0000-7000-8000-000000000005';
    const material = {
      materialType: 'Reading',
      disabledAt: null,
      lesson: { disabledAt: null },
      file: {
        organizationId,
        purpose: 'LessonReading',
        status: 'Ready',
        readyAt: new Date(),
        releasedAt: null,
        mimeType: 'application/pdf',
        deliveryType: 'authenticated',
        storageKey: 'protected/reading.pdf',
        storageFormat: '',
        sizeBytes: 15n,
      },
    };
    repository.findOrganizerReviewMaterial
      .mockResolvedValueOnce(material)
      .mockResolvedValueOnce({ ...material, disabledAt: new Date() });
    storage.getSignedUrl.mockReturnValue('https://example.invalid/signed');

    await expect(service.readOrganizerReadingPreview(
      organizer, courseId, materialId,
    )).rejects.toMatchObject({ status: 409 });
    expect(storage.readBytes).not.toHaveBeenCalled();
  });

});
