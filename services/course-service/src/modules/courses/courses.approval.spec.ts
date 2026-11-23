import type { CurrentUser } from '@learnup/ts-common';
import type { IReadableStorageProvider } from '@learnup/ts-storage';
import type { TenantClient } from '@infra/clients/tenant/tenant.client';
import type { LearningClient } from '@infra/clients/learning/learning.client';
import type { AssessmentClient } from '@/infrastructure/clients/assessment/assessment.client';
import type { NotificationClient } from '@/infrastructure/clients/notification/notification.client';
import type { CoursesRepository } from './courses.repository';
import { CoursesService } from './courses.service';

describe('UC21.3 Organizer decisions', () => {
  const courseId = '019a0000-0000-7000-8000-000000000003';
  const user = {
    userId: '019a0000-0000-7000-8000-000000000001',
    organizationId: '019a0000-0000-7000-8000-000000000002',
    role: 'ORGANIZER',
  } as CurrentUser;
  const repository = { decideCourse: jest.fn() };
  const service = new CoursesService(
    repository as unknown as CoursesRepository,
    {} as TenantClient,
    {} as LearningClient,
    {} as AssessmentClient,
    {} as NotificationClient,
    {} as IReadableStorageProvider,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    repository.decideCourse.mockResolvedValue({
      status: 'SUCCESS',
      course: { id: courseId, status: 'Published' },
    });
  });

  it('approves for an Organizer in the owning Organization', async () => {
    await expect(service.approveCourse(user, courseId))
      .resolves.toMatchObject({ status: 'Published' });
    expect(repository.decideCourse).toHaveBeenCalledWith({
      courseId, organizationId: user.organizationId,
      organizerId: user.userId, decision: 'APPROVE',
    });
  });

  it.each(['INSTRUCTOR', 'LEARNER'])('forbids %s approval', async role => {
    await expect(service.approveCourse({ ...user, role } as CurrentUser, courseId))
      .rejects.toMatchObject({ status: 403 });
    expect(repository.decideCourse).not.toHaveBeenCalled();
  });

  it('forbids Organizer with no Organization', async () => {
    await expect(service.approveCourse({ ...user, organizationId: undefined } as CurrentUser, courseId))
      .rejects.toMatchObject({ status: 403 });
    expect(repository.decideCourse).not.toHaveBeenCalled();
  });

  it('returns 404 when the Course is not visible in the Organization', async () => {
    repository.decideCourse.mockResolvedValue({ status: 'NOT_FOUND' });
    await expect(service.approveCourse(user, courseId))
      .rejects.toMatchObject({ status: 404 });
  });

  it('returns 409 on a concurrent or already-decided Course', async () => {
    repository.decideCourse.mockResolvedValue({ status: 'CONFLICT' });
    await expect(service.approveCourse(user, courseId))
      .rejects.toMatchObject({ status: 409 });
  });

  it('trims the rejection reason and passes it to the repository', async () => {
    repository.decideCourse.mockResolvedValue({
      status: 'SUCCESS', course: { id: courseId, status: 'Rejected' },
    });
    await expect(service.rejectCourse(user, courseId, { reason: '  Revise rubric  ' }))
      .resolves.toMatchObject({ status: 'Rejected' });
    expect(repository.decideCourse).toHaveBeenCalledWith({
      courseId, organizationId: user.organizationId,
      organizerId: user.userId, decision: 'REJECT', reason: 'Revise rubric',
    });
  });

  it.each(['', '   '])('rejects a blank reason', async reason => {
    await expect(service.rejectCourse(user, courseId, { reason }))
      .rejects.toMatchObject({ status: 400 });
    expect(repository.decideCourse).not.toHaveBeenCalled();
  });

  it('rejects reasons longer than the database field', async () => {
    await expect(service.rejectCourse(user, courseId, { reason: 'a'.repeat(1001) }))
      .rejects.toMatchObject({ status: 400 });
    expect(repository.decideCourse).not.toHaveBeenCalled();
  });
});
