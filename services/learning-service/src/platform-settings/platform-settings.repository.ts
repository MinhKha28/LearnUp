import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../common/repository/base.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformSettingsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Tỉ lệ xem video để hoàn thành học liệu (BR-148), chép vào Enrollment lúc tạo (BR-269).
   * Bảng trống thì trả null; không dùng số mặc định.
   */
  async getVideoCompletionPercent(
    tx?: Prisma.TransactionClient,
  ): Promise<number | null> {
    const settings = await this.db(tx).platformSetting.findFirst({
      select: { videoCompletionPercent: true },
    });
    return settings?.videoCompletionPercent ?? null;
  }
}
