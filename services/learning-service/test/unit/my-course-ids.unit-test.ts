import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import { EnrollmentsRepository } from '../../src/modules/enrollments/enrollments.repository';
import { EnrollmentsService } from '../../src/modules/enrollments/enrollments.service';

const ORG_A = '0199a000-0000-7000-8000-0a0000000001';
const ORG_B = '0199a000-0000-7000-8000-0a0000000002';
const LEARNER_1 = '0199a000-0000-7000-8000-0b0000000001';
const LEARNER_2 = '0199a000-0000-7000-8000-0b0000000002';

interface Row {
  id: string;
  learnerId: string;
  organizationId: string;
  courseId: string;
  status: string;
}

const ROWS: Row[] = [
  {
    id: 'e-3',
    learnerId: LEARNER_1,
    organizationId: ORG_A,
    courseId: 'c-3',
    status: 'InProgress',
  },
  {
    id: 'e-1',
    learnerId: LEARNER_1,
    organizationId: ORG_A,
    courseId: 'c-1',
    status: 'NotStarted',
  },
  {
    id: 'e-2',
    learnerId: LEARNER_1,
    organizationId: ORG_A,
    courseId: 'c-2',
    status: 'Withdrawn',
  },
  {
    id: 'e-4',
    learnerId: LEARNER_1,
    organizationId: ORG_A,
    courseId: 'c-4',
    status: 'Completed',
  },
  {
    id: 'e-5',
    learnerId: LEARNER_2,
    organizationId: ORG_A,
    courseId: 'c-1',
    status: 'NotStarted',
  },
  {
    id: 'e-6',
    learnerId: LEARNER_1,
    organizationId: ORG_B,
    courseId: 'c-6',
    status: 'NotStarted',
  },
];

interface FindManyArgs {
  where: {
    learnerId: string;
    organizationId: string;
    status: { not: string };
  };
  select: Record<string, boolean>;
  orderBy: { courseId: 'asc' | 'desc' };
}

/** Prisma giả: áp where, orderBy, select của findMany lên bảng trong bộ nhớ. */
function setupRepository() {
  const calls: FindManyArgs[] = [];
  const prisma = {
    enrollment: {
      findMany: (args: FindManyArgs) => {
        calls.push(args);
        const { where, select, orderBy } = args;
        const rows = ROWS.filter(
          (row) =>
            row.learnerId === where.learnerId &&
            row.organizationId === where.organizationId &&
            row.status !== where.status.not,
        ).sort((a, b) =>
          orderBy.courseId === 'asc'
            ? a.courseId.localeCompare(b.courseId)
            : b.courseId.localeCompare(a.courseId),
        );
        return Promise.resolve(
          rows.map((row) =>
            Object.fromEntries(
              Object.keys(select)
                .filter((key) => select[key])
                .map((key) => [key, row[key as keyof Row]]),
            ),
          ),
        );
      },
    },
  };
  return {
    repository: new EnrollmentsRepository(prisma as never),
    calls,
  };
}

void describe('EnrollmentsRepository.findCourseIdsOfLearner (D20, D48)', () => {
  void test('trả { courseId, enrollmentId }, trừ Withdrawn, sắp theo courseId', async () => {
    const { repository, calls } = setupRepository();

    const result = await repository.findCourseIdsOfLearner(LEARNER_1, ORG_A);

    assert.deepEqual(result, [
      { courseId: 'c-1', enrollmentId: 'e-1', status: 'NotStarted' },
      { courseId: 'c-3', enrollmentId: 'e-3', status: 'InProgress' },
      { courseId: 'c-4', enrollmentId: 'e-4', status: 'Completed' },
    ]);
    assert.deepEqual(calls[0].where, {
      learnerId: LEARNER_1,
      organizationId: ORG_A,
      status: { not: 'Withdrawn' },
    });
    assert.deepEqual(calls[0].orderBy, { courseId: 'asc' });
  });

  void test('chỉ Enrollment của chính Learner trong tổ chức của mình', async () => {
    const { repository } = setupRepository();

    assert.deepEqual(
      await repository.findCourseIdsOfLearner(LEARNER_2, ORG_A),
      [{ courseId: 'c-1', enrollmentId: 'e-5', status: 'NotStarted' }],
    );
    assert.deepEqual(
      await repository.findCourseIdsOfLearner(LEARNER_1, ORG_B),
      [{ courseId: 'c-6', enrollmentId: 'e-6', status: 'NotStarted' }],
    );
    assert.deepEqual(
      await repository.findCourseIdsOfLearner(LEARNER_2, ORG_B),
      [],
    );
  });
});

void describe('EnrollmentsService.getMyCourseIds (D20, D48)', () => {
  void test('trả nguyên danh sách { courseId, enrollmentId } theo userId và organizationId', async () => {
    const received: [string, string][] = [];
    const refs = [
      { courseId: 'c-1', enrollmentId: 'e-1', status: 'NotStarted' },
    ];
    const enrollments = {
      findCourseIdsOfLearner: (learnerId: string, organizationId: string) => {
        received.push([learnerId, organizationId]);
        return Promise.resolve(refs);
      },
    };
    const service = new EnrollmentsService(
      {} as never,
      enrollments as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const user: CurrentUser = {
      userId: LEARNER_1,
      organizationId: ORG_A,
      role: 'LEARNER',
      isAuthenticated: true,
    };

    assert.deepEqual(await service.getMyCourseIds(user), refs);
    assert.deepEqual(received, [[LEARNER_1, ORG_A]]);
  });
});
