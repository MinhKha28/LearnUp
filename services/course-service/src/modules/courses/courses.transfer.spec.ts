import type { CurrentUser } from '@learnup/ts-common';
import type { CoursesRepository } from './courses.repository';
import type { TenantClient } from '@infra/clients/tenant/tenant.client';
import type { LearningClient } from '@infra/clients/learning/learning.client';
import type { AssessmentClient } from '@/infrastructure/clients/assessment/assessment.client';
import type { NotificationClient } from '@/infrastructure/clients/notification/notification.client';
import type { IStorageProvider } from '@learnup/ts-storage';
import { CoursesService } from './courses.service';

describe('UC23 Course ownership transfer', () => {
  const courseId = '019a0000-0000-7000-8000-000000000003';
  const chainId = '019a0000-0000-7000-8000-000000000004';
  const oldInstructor = '019a0000-0000-7000-8000-000000000005';
  const newInstructor = '019a0000-0000-7000-8000-000000000006';
  const organizer = {
    userId: '019a0000-0000-7000-8000-000000000007',
    organizationId: '019a0000-0000-7000-8000-000000000002',
    role: 'ORGANIZER',
  } as CurrentUser;
  const payload = {
    expectedInstructorId: oldInstructor,
    toInstructorId: newInstructor,
    reason: 'Reassignment',
  };
  const course = {
    id: courseId,
    chainId,
    name: 'Safety Training',
    versionNumber: 2,
    status: 'Published',
    chain: { instructorId: oldInstructor },
  };
  const result = {
    courseId, chainId,
    fromInstructorId: oldInstructor,
    toInstructorId: newInstructor,
    transferredAt: new Date('2026-11-10T12:00:00.000Z'),
  };

  const repository = {
    findCourseForOwnershipTransfer: jest.fn(),
    transferCourseOwnership: jest.fn(),
    findTransferVersions: jest.fn(),
  };
  const tenant = {
    validateTransferReceiver: jest.fn(),
    getInstructors: jest.fn(),
  };
  const service = new CoursesService(
    repository as unknown as CoursesRepository,
    tenant as unknown as TenantClient,
    {} as LearningClient,
    {} as AssessmentClient,
    {} as NotificationClient,
    {} as IStorageProvider,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    repository.findCourseForOwnershipTransfer.mockResolvedValue(course);
    repository.transferCourseOwnership.mockResolvedValue({ status: 'TRANSFERRED', data: result });
    repository.findTransferVersions.mockResolvedValue([{
      id: courseId, versionNumber: 2, name: course.name, status: 'Published',
      createdAt: new Date(), publishedAt: new Date(),
    }]);
    tenant.validateTransferReceiver.mockResolvedValue({ id: newInstructor, fullName: 'B' });
    tenant.getInstructors.mockResolvedValue([{ id: oldInstructor, fullName: 'A' }]);
  });

  it('only an Organizer may transfer', async () => {
    await expect(service.transferCourseOwnership(
      { ...organizer, role: 'INSTRUCTOR' } as CurrentUser, courseId, payload,
    )).rejects.toMatchObject({ status: 403 });
    expect(repository.transferCourseOwnership).not.toHaveBeenCalled();
  });

  it('transfers the whole Chain, not a single Course version', async () => {
    await expect(service.transferCourseOwnership(organizer, courseId, payload))
      .resolves.toEqual(result);
    expect(tenant.validateTransferReceiver).toHaveBeenCalledWith(organizer, newInstructor);
    expect(repository.transferCourseOwnership).toHaveBeenCalledWith({
      courseId,
      chainId,
      organizationId: organizer.organizationId,
      fromInstructorId: oldInstructor,
      toInstructorId: newInstructor,
      actorUserId: organizer.userId,
      reason: payload.reason,
      courseName: course.name,
    });
  });

  it('returns 404 for another Organization or missing Course', async () => {
    repository.findCourseForOwnershipTransfer.mockResolvedValue(null);
    await expect(service.transferCourseOwnership(organizer, courseId, payload))
      .rejects.toMatchObject({ status: 404 });
    expect(tenant.validateTransferReceiver).not.toHaveBeenCalled();
  });

  it('rejects stale ownership even before calling Tenant', async () => {
    repository.findCourseForOwnershipTransfer.mockResolvedValue({
      ...course, chain: { instructorId: newInstructor },
    });
    await expect(service.transferCourseOwnership(organizer, courseId, payload))
      .rejects.toMatchObject({ status: 409 });
    expect(tenant.validateTransferReceiver).not.toHaveBeenCalled();
  });

  it('rejects a concurrent transfer without reporting success', async () => {
    repository.transferCourseOwnership.mockResolvedValue({ status: 'CONFLICT' });
    await expect(service.transferCourseOwnership(organizer, courseId, payload))
      .rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ code: 'COURSE_CHANGED' }),
      });
  });

  it('does not invent a name when Tenant has no matching Instructor', async () => {
    tenant.getInstructors.mockResolvedValue([]);
    const response = await service.getTransferContext(organizer, courseId);
    expect(response.currentInstructor).toEqual({
      id: oldInstructor,
      fullName: null,
      resolved: false,
    });
  });

  it('returns the current Instructor and every Course version', async () => {
    const response = await service.getTransferContext(organizer, courseId);
    expect(response.currentInstructor).toEqual({ id: oldInstructor, fullName: 'A', resolved: true });
    expect(repository.findTransferVersions).toHaveBeenCalledWith(chainId, organizer.organizationId);
    expect(response.versions).toHaveLength(1);
  });
});
