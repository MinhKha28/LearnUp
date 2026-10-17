import { InternalCoursesService } from './internal-courses.service';
import type { PrismaService } from '@infra/prisma/prisma.service';

jest.mock('@learnup/ts-common', () => ({
  createApiError: (code: string, message: string) => ({ code, message }),
}));

jest.mock('@infra/prisma/prisma.service', () => ({ PrismaService: class {} }), {
  virtual: true,
});

const org = '25039000-0000-4000-8000-000000000001';
const row = {
  id: '25039001-0000-4000-8000-000000000001',
  organization_id: org,
  chain_id: '25039002-0000-4000-8000-000000000001',
  expected_completion_days: 30,
  course_type: 'Public',
  status: 'Published',
  locked_at: new Date('2026-10-01T00:00:00Z'),
};

describe('I1 lock fast path', () => {
  const query = jest.fn();
  const transaction = jest.fn();
  const service = new InternalCoursesService({
    $queryRaw: query,
    $transaction: transaction,
  } as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it.each([true, false])(
    'returns the same locked response, selfEnroll=%s',
    async (selfEnroll) => {
      query.mockResolvedValue([row]);
      await expect(service.lock(org, row.id, selfEnroll)).resolves.toEqual({
        courseId: row.id,
        organizationId: org,
        chainId: row.chain_id,
        expectedCompletionDays: 30,
        courseType: 'Public',
        lockedAt: row.locked_at,
      });
      expect(transaction).not.toHaveBeenCalled();
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0][0].join('')).not.toContain('FOR UPDATE');
    },
  );

  it.each([
    ['Archived', 'Public', true],
    ['Draft', 'Public', false],
    ['Published', 'Private', true],
  ])(
    'rejects locked %s/%s, selfEnroll=%s',
    async (status, courseType, selfEnroll) => {
      query.mockResolvedValue([{ ...row, status, course_type: courseType }]);
      await expect(
        service.lock(org, row.id, selfEnroll as boolean),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'COURSE_NOT_AVAILABLE' },
      });
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it('allows assignment of a locked Private course', async () => {
    query.mockResolvedValue([{ ...row, course_type: 'Private' }]);
    await expect(service.lock(org, row.id, false)).resolves.toMatchObject({
      courseType: 'Private',
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('preserves not-found errors', async () => {
    query.mockResolvedValue([]);
    await expect(service.lock(org, row.id, true)).rejects.toMatchObject({
      status: 404,
      response: { code: 'COURSE_NOT_FOUND' },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid organization before querying', async () => {
    await expect(service.lock(undefined, row.id, true)).rejects.toMatchObject({
      status: 404,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, 404, 'COURSE_NOT_FOUND'],
    [{ ...row, status: 'Archived' }, 409, 'COURSE_NOT_AVAILABLE'],
    [{ ...row, course_type: 'Private' }, 409, 'COURSE_NOT_AVAILABLE'],
  ])(
    'rechecks eligibility under the first-lock transaction',
    async (lockedRow, status, code) => {
      query.mockResolvedValue([{ ...row, locked_at: null }]);
      const lockedQuery = jest
        .fn()
        .mockResolvedValue(lockedRow ? [lockedRow] : []);
      transaction.mockImplementation((fn) => fn({ $queryRaw: lockedQuery }));
      await expect(service.lock(org, row.id, true)).rejects.toMatchObject({
        status,
        response: { code },
      });
      expect(lockedQuery).toHaveBeenCalledTimes(1);
      expect(lockedQuery.mock.calls[0][0].join('')).toContain('FOR UPDATE');
    },
  );
});

describe('UC19 assignment minutes (BR-51, BR-172, BR-173)', () => {
  const query = jest.fn();
  const service = new InternalCoursesService({
    $queryRaw: query,
  } as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('stores the total and answers with it', async () => {
    const asOf = new Date('2026-10-17T00:00:00Z');
    query.mockResolvedValue([
      { id: row.id, assignment_minutes: 150, as_of: asOf },
    ]);
    await expect(service.setAssignmentMinutes(org, row.id, 150)).resolves.toEqual({
      courseId: row.id,
      assignmentMinutes: 150,
      assignmentMinutesAsOf: asOf,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('is 404 for a Course of another Organization or an unknown one', async () => {
    query.mockResolvedValue([]);
    await expect(
      service.setAssignmentMinutes(org, row.id, 10),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('is 404 without a valid Organization, and nothing is written', async () => {
    for (const bad of [undefined, 'not-a-uuid']) {
      await expect(
        service.setAssignmentMinutes(bad, row.id, 10),
      ).rejects.toMatchObject({ status: 404 });
    }
    expect(query).not.toHaveBeenCalled();
  });
});
