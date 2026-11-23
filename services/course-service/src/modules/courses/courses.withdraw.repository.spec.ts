import type { PrismaService } from '@infra/prisma/prisma.service';
import { COURSE_STATUS } from './course-values';
import { CoursesRepository } from './courses.repository';

describe('UC20.1 withdraw Course conditional transaction', () => {
  const data = {
    courseId: '019a0000-0000-7000-8000-000000000003',
    organizationId: '019a0000-0000-7000-8000-000000000002',
    instructorId: '019a0000-0000-7000-8000-000000000001',
    expectedUpdatedAt: new Date('2026-11-08T05:00:00.000Z'),
  };
  const draft = {
    id: data.courseId,
    name: 'Safety Training',
    versionNumber: 1,
    status: COURSE_STATUS.DRAFT,
    submittedAt: null,
  };
  const tx = {
    course: {
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx)),
  };
  const repository = new CoursesRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.course.updateMany.mockResolvedValue({ count: 1 });
    tx.course.findUniqueOrThrow.mockResolvedValue(draft);
  });

  it('updates only a matching Submitted Course in the current tenant and chain', async () => {
    await expect(repository.withdrawCourseSubmission(data)).resolves.toEqual({
      status: 'WITHDRAWN',
      course: draft,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.course.updateMany).toHaveBeenCalledWith({
      where: {
        id: data.courseId,
        organizationId: data.organizationId,
        deletedAt: null,
        chain: { instructorId: data.instructorId },
        status: COURSE_STATUS.SUBMITTED,
        updatedAt: {
          gte: data.expectedUpdatedAt,
          lt: new Date(data.expectedUpdatedAt.getTime() + 1),
        },
      },
      data: {
        status: COURSE_STATUS.DRAFT,
        submittedAt: null,
      },
    });
    expect(tx.course.findUniqueOrThrow).toHaveBeenCalledTimes(1);
  });

  it('returns CONFLICT if Organizer approval or another change wins first', async () => {
    tx.course.updateMany.mockResolvedValue({ count: 0 });
    await expect(repository.withdrawCourseSubmission(data)).resolves.toEqual({
      status: 'CONFLICT',
    });
    expect(tx.course.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('propagates a database failure instead of claiming success', async () => {
    tx.course.updateMany.mockRejectedValue(new Error('database unavailable'));
    await expect(repository.withdrawCourseSubmission(data)).rejects.toThrow(
      'database unavailable',
    );
  });
});
