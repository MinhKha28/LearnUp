import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { transferCourseChain } from './course-chain-ownership';
import type { Prisma } from '../../../generated/prisma/client';

const org = '25125000-0000-4000-8000-000000000001';
const chainId = '25125001-0000-4000-8000-000000000001';
const from = '25125002-0000-4000-8000-00000000000a';
const to = '25125002-0000-4000-8000-00000000000b';

describe('UC12.5 transferCourseChain', () => {
  const queryRaw = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const executeRaw = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const tx = {
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
  } as unknown as Prisma.TransactionClient;

  beforeEach(() => jest.resetAllMocks());

  it('locks the chain row and moves it when the owner still matches', async () => {
    queryRaw.mockResolvedValue([{ instructor_id: from }]);
    await expect(
      transferCourseChain(tx, {
        organizationId: org,
        chainId,
        fromInstructorId: from.toUpperCase(),
        toInstructorId: to,
      }),
    ).resolves.toBe('TRANSFERRED');
    expect((queryRaw.mock.calls[0][0] as string[]).join('')).toContain(
      'FOR UPDATE',
    );
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['NOT_FOUND', []],
    ['ALREADY_OWNER', [{ instructor_id: to }]],
    ['NOT_OWNER', [{ instructor_id: '25125002-0000-4000-8000-00000000000c' }]],
  ])('returns %s without writing', async (expected, rows) => {
    queryRaw.mockResolvedValue(rows);
    await expect(
      transferCourseChain(tx, {
        organizationId: org,
        chainId,
        fromInstructorId: from,
        toInstructorId: to,
      }),
    ).resolves.toBe(expected);
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
