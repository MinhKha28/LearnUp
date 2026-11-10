import type { PrismaService } from '@infra/prisma/prisma.service';
import { COURSE_STATUS } from './course-values';
import { CoursesRepository } from './courses.repository';

describe('UC21.3 approval transaction', () => {
  const organizationId = '019a0000-0000-7000-8000-000000000002';
  const courseId = '019a0000-0000-7000-8000-000000000003';
  const chainId = '019a0000-0000-7000-8000-000000000004';
  const instructorId = '019a0000-0000-7000-8000-000000000005';
  const organizerId = '019a0000-0000-7000-8000-000000000006';

  const calls: string[] = [];
  const tx = {
    $queryRaw: jest.fn(),
    course: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    outboxEvent: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
      calls.push('begin');
      try {
        const result = await callback(tx);
        calls.push('commit');
        return result;
      } catch (error) {
        calls.push('rollback');
        throw error;
      }
    }),
  };
  const repository = new CoursesRepository(prisma as unknown as PrismaService);
  const input = {
    courseId, organizationId, organizerId,
    decision: 'APPROVE' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    calls.length = 0;
    tx.$queryRaw.mockResolvedValue([{ id: chainId }]);
    tx.course.findFirst
      .mockResolvedValueOnce({ id: courseId, chainId })
      .mockResolvedValueOnce({
        id: courseId, chainId, name: 'Safety Course',
        versionNumber: 2, status: COURSE_STATUS.SUBMITTED,
        chain: { instructorId },
      });
    tx.course.updateMany.mockImplementation(async (args: { data: { status: string } }) => {
      calls.push(args.data.status);
      return { count: 1 };
    });
    tx.outboxEvent.create.mockImplementation(async () => {
      calls.push('outbox');
      return {};
    });
    tx.course.findUniqueOrThrow.mockResolvedValue({
      id: courseId, name: 'Safety Course', versionNumber: 2,
      status: COURSE_STATUS.PUBLISHED,
      publishedAt: new Date(), rejectedAt: null, rejectionReason: null,
    });
  });

  it('archives a previous Published version before publishing and writing Outbox', async () => {
    const result = await repository.decideCourse(input);
    expect(result.status).toBe('SUCCESS');
    expect(calls).toEqual(['begin', 'Archived', 'Published', 'outbox', 'commit']);
    expect(tx.course.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: courseId, organizationId, deletedAt: null },
    }));
    expect(tx.course.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        chainId, id: { not: courseId }, deletedAt: null,
        status: COURSE_STATUS.PUBLISHED,
      }),
    }));
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'CoursePublished',
        aggregateId: courseId,
        organizationId,
        payload: expect.objectContaining({ instructorId, organizerId, courseId }),
      }),
    });
  });

  it('rejects only the Submitted version without archiving another version', async () => {
    tx.course.findUniqueOrThrow.mockResolvedValue({
      id: courseId, status: COURSE_STATUS.REJECTED,
    });
    const result = await repository.decideCourse({
      ...input, decision: 'REJECT', reason: 'Revise rubric',
    });
    expect(result.status).toBe('SUCCESS');
    expect(calls).toEqual(['begin', 'Rejected', 'outbox', 'commit']);
    expect(tx.course.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: COURSE_STATUS.SUBMITTED, deletedAt: null }),
      data: expect.objectContaining({
        status: COURSE_STATUS.REJECTED,
        rejectionReason: 'Revise rubric',
      }),
    }));
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'CourseRejected' }),
    });
  });

  it('returns NOT_FOUND for an absent/trashed/foreign-Organization Course', async () => {
    tx.course.findFirst.mockReset().mockResolvedValue(null);
    await expect(repository.decideCourse(input))
      .resolves.toEqual({ status: 'NOT_FOUND' });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('returns CONFLICT when the locked Course is no longer Submitted', async () => {
    tx.course.findFirst.mockReset()
      .mockResolvedValueOnce({ id: courseId, chainId })
      .mockResolvedValueOnce({ id: courseId, chainId, status: COURSE_STATUS.REJECTED });
    await expect(repository.decideCourse(input))
      .resolves.toEqual({ status: 'CONFLICT' });
    expect(tx.course.updateMany).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('rolls back archival and maps a lost conditional update to CONFLICT', async () => {
    tx.course.updateMany
      .mockImplementationOnce(async () => { calls.push('Archived'); return { count: 1 }; })
      .mockImplementationOnce(async () => { calls.push('Published'); return { count: 0 }; });
    await expect(repository.decideCourse(input))
      .resolves.toEqual({ status: 'CONFLICT' });
    expect(calls).toEqual(['begin', 'Archived', 'Published', 'rollback']);
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('propagates an Outbox failure to force rollback (not a false 409)', async () => {
    tx.outboxEvent.create.mockRejectedValue(new Error('Outbox unavailable'));
    await expect(repository.decideCourse(input))
      .rejects.toThrow('Outbox unavailable');
    expect(calls).toContain('rollback');
    expect(calls).not.toContain('commit');
  });
});
