import type { PrismaService } from '@infra/prisma/prisma.service';
import { transferCourseChain } from '../internal-courses/course-chain-ownership';
import { CoursesRepository } from './courses.repository';

jest.mock('../internal-courses/course-chain-ownership', () => ({
  transferCourseChain: jest.fn(),
}));

describe('UC23 transfer Course Chain transaction', () => {
  const input = {
    courseId: '019a0000-0000-7000-8000-000000000003',
    chainId: '019a0000-0000-7000-8000-000000000004',
    organizationId: '019a0000-0000-7000-8000-000000000002',
    fromInstructorId: '019a0000-0000-7000-8000-000000000005',
    toInstructorId: '019a0000-0000-7000-8000-000000000006',
    actorUserId: '019a0000-0000-7000-8000-000000000007',
    courseName: 'Safety Training',
  };
  const tx = { outboxEvent: { create: jest.fn() } };
  const prisma = {
    $transaction: jest.fn(async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const repository = new CoursesRepository(prisma as unknown as PrismaService);
  const transfer = jest.mocked(transferCourseChain);

  beforeEach(() => {
    jest.clearAllMocks();
    transfer.mockResolvedValue('TRANSFERRED');
    tx.outboxEvent.create.mockResolvedValue({ id: 'event-id' });
  });

  it('locks and transfers one Chain and commits a matching Outbox event', async () => {
    const result = await repository.transferCourseOwnership(input);
    expect(result.status).toBe('TRANSFERRED');
    expect(transfer).toHaveBeenCalledWith(tx, {
      organizationId: input.organizationId,
      chainId: input.chainId,
      fromInstructorId: input.fromInstructorId,
      toInstructorId: input.toInstructorId,
    });
    expect(tx.outboxEvent.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        aggregateType: 'Course',
        aggregateId: input.chainId,
        eventType: 'CourseOwnershipTransferred',
        organizationId: input.organizationId,
        payload: expect.objectContaining({
          chainId: input.chainId,
          actorUserId: input.actorUserId,
          toInstructorId: input.toInstructorId,
        }),
      }),
    });
    expect(tx.outboxEvent.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        aggregateType: 'CourseAudit',
        aggregateId: input.chainId,
        eventType: 'AuditRecorded',
        organizationId: input.organizationId,
        payload: expect.objectContaining({
          actorUserId: input.actorUserId,
          actorRole: 'ORGANIZER',
          actionType: 'COURSE_OWNERSHIP_TRANSFERRED',
          targetResourceId: input.chainId,
          toInstructorId: input.toInstructorId,
          occurredAt: expect.any(String),
        }),
      }),
    });
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(2);
  });

  it.each(['NOT_OWNER', 'ALREADY_OWNER'])(
    'returns conflict and does not emit an event when transfer says %s',
    async (status) => {
      transfer.mockResolvedValue(status as 'NOT_OWNER' | 'ALREADY_OWNER');
      await expect(repository.transferCourseOwnership(input))
        .resolves.toEqual({ status: 'CONFLICT' });
      expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    },
  );

  it('returns NOT_FOUND without an event', async () => {
    transfer.mockResolvedValue('NOT_FOUND');
    await expect(repository.transferCourseOwnership(input))
      .resolves.toEqual({ status: 'NOT_FOUND' });
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('rejects when inserting the Audit event fails (atomic rollback)', async () => {
    tx.outboxEvent.create
      .mockResolvedValueOnce({ id: 'notification-event' })
      .mockRejectedValueOnce(new Error('audit outbox unavailable'));
    await expect(repository.transferCourseOwnership(input))
      .rejects.toThrow('audit outbox unavailable');
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(2);
  });

  it('propagates Outbox errors so the Prisma transaction rolls back', async () => {
    tx.outboxEvent.create.mockRejectedValueOnce(new Error('outbox unavailable'));
    await expect(repository.transferCourseOwnership(input))
      .rejects.toThrow('outbox unavailable');
  });
});
