import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class PlatformSettingsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /** Dòng tham số nền tảng duy nhất (BR-268); bảng trống thì trả null. */
  findCurrent(tx?: Prisma.TransactionClient) {
    return this.db(tx).platformSetting.findFirst();
  }
}
