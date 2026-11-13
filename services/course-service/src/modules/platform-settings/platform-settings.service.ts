import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const DEFAULT_SETTINGS_ID = '01900000-0000-7000-8000-f00100000001';

@Injectable()
export class PlatformSettingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const inserted = await this.prisma.$executeRaw`
      INSERT INTO platform_settings (id, source_as_of, updated_at)
      SELECT ${DEFAULT_SETTINGS_ID}::uuid, TIMESTAMPTZ '1970-01-01T00:00:00Z', now()
      WHERE NOT EXISTS (SELECT 1 FROM platform_settings)
      ON CONFLICT (id) DO NOTHING
    `;

    if (inserted > 0) {
      this.logger.log('Created default Course platform settings.');
    }
  }
}
