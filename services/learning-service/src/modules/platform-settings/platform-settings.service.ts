import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const DEFAULT_VIDEO_COMPLETION_PERCENT = 90;

@Injectable()
export class PlatformSettingsService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO platform_settings
        (id, video_completion_percent, source_as_of, updated_at)
      VALUES (${randomUUID()}::uuid, ${DEFAULT_VIDEO_COMPLETION_PERCENT}, TIMESTAMPTZ '1970-01-01T00:00:00Z', now())
      ON CONFLICT DO NOTHING
    `;
  }
}
