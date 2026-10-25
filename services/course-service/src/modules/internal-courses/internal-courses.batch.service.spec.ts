import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InternalCoursesService } from './internal-courses.service';
import type { PrismaService } from '@infra/prisma/prisma.service';

jest.mock('@learnup/ts-common', () => ({
  createApiError: (code: string, message: string) => ({ code, message }),
}));
jest.mock('@infra/prisma/prisma.service', () => ({ PrismaService: class {} }), {
  virtual: true,
});

describe('I3 batch organization validation', () => {
  const findMany = jest.fn();
  const service = new InternalCoursesService({
    course: { findMany },
  } as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it.each([undefined, '', 'not-a-uuid'])(
    'rejects invalid organization %s before querying',
    async (organizationId) => {
      await expect(service.findBatch(organizationId, [])).rejects.toMatchObject(
        {
          status: 400,
          response: { code: 'ORGANIZATION_REQUIRED' },
        },
      );
      expect(findMany).not.toHaveBeenCalled();
    },
  );
});
