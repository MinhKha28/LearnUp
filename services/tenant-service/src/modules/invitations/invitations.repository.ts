import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { UserStatus } from '../../common/constants/tenant.constants';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class InvitationsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /** UC04 (BR-21): người được mời đặt mật khẩu xong thì tài khoản chuyển Active. */
  activateUser(
    userId: string,
    activatedAt: Date,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { status: UserStatus.Active, activatedAt },
    });
  }
}
