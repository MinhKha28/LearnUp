import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AccountTokensRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /** Thu hồi mọi liên kết còn dùng được của user cho cùng mục đích (BR-278). */
  revokeActive(
    userId: string,
    purpose: string,
    revokedAt: Date,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).accountToken.updateMany({
      where: { userId, purpose, consumedAt: null, revokedAt: null },
      data: { revokedAt },
    });
  }

  create(
    data: Prisma.AccountTokenUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).accountToken.create({ data });
  }

  /** Tìm theo mã băm, kèm user và tổ chức để kiểm tra và hiển thị. */
  findByHash(
    tokenHash: Uint8Array<ArrayBuffer>,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).accountToken.findUnique({
      where: { tokenHash },
      include: { user: true, organization: true },
    });
  }

  /**
   * Đánh dấu đã dùng; điều kiện trong WHERE chống 2 request dùng cùng lúc.
   * Trả số dòng đã cập nhật (0 = đã bị dùng hoặc thu hồi trước đó).
   */
  async markConsumed(
    tokenId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await this.db(tx).accountToken.updateMany({
      where: { id: tokenId, consumedAt: null, revokedAt: null },
      data: { consumedAt: new Date() },
    });
    return result.count;
  }
}
