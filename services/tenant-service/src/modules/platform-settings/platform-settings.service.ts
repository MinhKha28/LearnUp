import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lấy dòng tham số nền tảng duy nhất (BR-268). Chưa seed thì báo lỗi rõ ràng. */
  async get() {
    const settings = await this.prisma.platformSetting.findFirst();
    if (!settings) {
      throw new InternalServerErrorException(
        'platform_settings chưa có dữ liệu. Hãy chạy: npm run prisma:seed',
      );
    }
    return settings;
  }
}
