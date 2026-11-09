import type { PrismaService } from '@infra/prisma/prisma.service';
import { COURSE_STATUS } from './course-values';
import { CoursesRepository } from './courses.repository';

describe('UC20 submitCourseForApproval DB transaction', () => {
  const data = {
    courseId: '019a0000-0000-7000-8000-000000000003',
    organizationId: '019a0000-0000-7000-8000-000000000002',
    instructorId: '019a0000-0000-7000-8000-000000000001',
    expectedUpdatedAt: new Date('2026-11-08T05:00:00.000Z'),
  };
  const submittedAt = new Date();
  const tx = {
    course: {
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    outboxEvent: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx)),
  };
  const repository = new CoursesRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.course.updateMany.mockResolvedValue({ count: 1 });
    tx.course.findUniqueOrThrow.mockResolvedValue({
      id: data.courseId,
      name: 'Safety Training',
      versionNumber: 1,
      status: COURSE_STATUS.SUBMITTED,
      submittedAt,
    });
    tx.outboxEvent.create.mockResolvedValue({});
  });

  it('writes status and event in the same transaction callback', async () => {
    const result = await repository.submitCourseForApproval(data);
    expect(result.status).toBe('SUBMITTED');
    expect(tx.course.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: data.organizationId,
          status: { in: [COURSE_STATUS.DRAFT, COURSE_STATUS.REJECTED] },
          chain: { instructorId: data.instructorId },
        }),
        data: expect.objectContaining({ status: COURSE_STATUS.SUBMITTED }),
      }),
    );
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateType: 'Course',
        aggregateId: data.courseId,
        organizationId: data.organizationId,
        eventType: 'CourseSubmitted',
        payload: expect.objectContaining({
          courseId: data.courseId,
          organizationId: data.organizationId,
          instructorId: data.instructorId,
        }),
      }),
    });
  });

  it('does not create an event if the optimistic update loses', async () => {
    tx.course.updateMany.mockResolvedValue({ count: 0 });
    await expect(repository.submitCourseForApproval(data))
      .resolves.toEqual({ status: 'CONFLICT' });
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('propagates Outbox insertion errors so Prisma can roll back the transaction', async () => {
    tx.outboxEvent.create.mockRejectedValue(new Error('Outbox insert failed'));
    await expect(repository.submitCourseForApproval(data))
      .rejects.toThrow('Outbox insert failed');
  });
});
