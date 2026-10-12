import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PlatformSettingsRepository } from './platform-settings.repository';

@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly platformSettingsRepository: PlatformSettingsRepository,
  ) {}

  /** Lấy dòng tham số nền tảng duy nhất (BR-268). Chưa seed thì báo lỗi rõ ràng. */
  async get() {
    const settings = await this.platformSettingsRepository.findCurrent();
    if (!settings) {
      throw new InternalServerErrorException(
        'platform_settings chưa có dữ liệu. Hãy chạy: npm run prisma:seed',
      );
    }
    return settings;
  }
}
