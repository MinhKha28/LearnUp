import type { CurrentUser } from '@learnup/ts-common';
import type { TenantClient } from '@infra/clients/tenant/tenant.client';
import type { LearningClient } from '@infra/clients/learning/learning.client';
import type { AssessmentClient } from '@/infrastructure/clients/assessment/assessment.client';
import type { NotificationClient } from '@/infrastructure/clients/notification/notification.client';
import type { IStorageProvider } from '@learnup/ts-storage';
import type { CoursesRepository } from './courses.repository';
import { COURSE_STATUS } from './course-values';
import { CoursesService } from './courses.service';

describe('UC20.1 withdraw Course submission', () => {
  const courseId = '019a0000-0000-7000-8000-000000000003';
  const instructor = {
    userId: '019a0000-0000-7000-8000-000000000001',
    organizationId: '019a0000-0000-7000-8000-000000000002',
    role: 'INSTRUCTOR',
  } as CurrentUser;
  const expectedUpdatedAt = new Date('2026-11-08T05:00:00.000Z');
  const submitted = {
    id: courseId,
    status: COURSE_STATUS.SUBMITTED,
    updatedAt: expectedUpdatedAt,
    deletedAt: null,
  };
  const draft = {
    id: courseId,
    name: 'Safety Training',
    versionNumber: 1,
    status: COURSE_STATUS.DRAFT,
    submittedAt: null,
  };
  const repository = {
    findDetail: jest.fn(),
    withdrawCourseSubmission: jest.fn(),
  };
  const service = new CoursesService(
    repository as unknown as CoursesRepository,
    {} as TenantClient,
    {} as LearningClient,
    {} as AssessmentClient,
    {} as NotificationClient,
    {} as IStorageProvider,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    repository.findDetail.mockResolvedValue({ ...submitted });
    repository.withdrawCourseSubmission.mockResolvedValue({
      status: 'WITHDRAWN',
      course: draft,
    });
  });

  it('changes Submitted to Draft and clears submittedAt', async () => {
    await expect(
      service.withdrawCourseSubmission(instructor, courseId),
    ).resolves.toEqual(draft);
    expect(repository.findDetail).toHaveBeenCalledWith(
      courseId,
      instructor.organizationId,
      instructor.userId,
    );
    expect(repository.withdrawCourseSubmission).toHaveBeenCalledWith({
      courseId,
      organizationId: instructor.organizationId,
      instructorId: instructor.userId,
      expectedUpdatedAt,
    });
  });

  it.each([
    COURSE_STATUS.DRAFT,
    COURSE_STATUS.REJECTED,
    COURSE_STATUS.PUBLISHED,
  ])('rejects non-Submitted status %s', async (status) => {
    repository.findDetail.mockResolvedValue({ ...submitted, status });
    await expect(
      service.withdrawCourseSubmission(instructor, courseId),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'INVALID_COURSE_STATUS' }),
    });
    expect(repository.withdrawCourseSubmission).not.toHaveBeenCalled();
  });

  it.each(['LEARNER', 'ORGANIZER', 'ADMIN'])(
    'rejects role %s with 403',
    async (role) => {
      await expect(
        service.withdrawCourseSubmission(
          { ...instructor, role } as CurrentUser,
          courseId,
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect(repository.findDetail).not.toHaveBeenCalled();
    },
  );

  it('rejects missing organization context', async () => {
    await expect(
      service.withdrawCourseSubmission(
        { ...instructor, organizationId: null } as CurrentUser,
        courseId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(repository.findDetail).not.toHaveBeenCalled();
  });

  it('does not disclose a Course of another Instructor or Organization', async () => {
    repository.findDetail.mockResolvedValue(null);
    await expect(
      service.withdrawCourseSubmission(instructor, courseId),
    ).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({ code: 'COURSE_NOT_FOUND' }),
    });
    expect(repository.withdrawCourseSubmission).not.toHaveBeenCalled();
  });

  it('does not withdraw a Course in Trash', async () => {
    repository.findDetail.mockResolvedValue({
      ...submitted,
      deletedAt: new Date('2026-11-09T00:00:00.000Z'),
    });
    await expect(
      service.withdrawCourseSubmission(instructor, courseId),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'COURSE_IN_TRASH' }),
    });
    expect(repository.withdrawCourseSubmission).not.toHaveBeenCalled();
  });

  it('returns COURSE_CHANGED when the conditional update loses', async () => {
    repository.withdrawCourseSubmission.mockResolvedValue({
      status: 'CONFLICT',
    });
    await expect(
      service.withdrawCourseSubmission(instructor, courseId),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'COURSE_CHANGED' }),
    });
  });
});
