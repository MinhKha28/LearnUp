import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class UserDirectoryRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findInOrganization(
    organizationId: string,
    userIds: string[],
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).user.findMany({
      where: { organizationId, id: { in: userIds } },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        deletedAt: true,
      },
    });
  }
}
