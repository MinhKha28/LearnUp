import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class ProfileRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findActiveUser(userId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { organization: true },
    });
  }

  updateFullName(
    userId: string,
    fullName: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { fullName },
    });
  }

  updateAvatarKey(
    userId: string,
    avatarFileKey: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { avatarFileKey },
    });
  }
}
