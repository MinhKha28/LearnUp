import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { PlatformSettingsService } from '../../src/modules/platform-settings/platform-settings.service';
import { databaseUrl } from './enroll-it-fixture';
import { test } from './test-runner';

test('platform settings bootstrap starts at epoch and preserves a later value', async () => {
  const prisma = new PrismaService(
    new ConfigService({ DATABASE_URL: databaseUrl() }),
  );
  const service = new PlatformSettingsService(prisma);

  try {
    const original = await prisma.platformSetting.findFirst();
    try {
      await prisma.platformSetting.deleteMany();
      await service.onApplicationBootstrap();

      const initial = await prisma.platformSetting.findFirstOrThrow();
      assert.equal(initial.videoCompletionPercent, 90);
      assert.equal(initial.sourceAsOf.toISOString(), '1970-01-01T00:00:00.000Z');

      const updated = await prisma.platformSetting.update({
        where: { id: initial.id },
        data: {
          videoCompletionPercent: 85,
          sourceAsOf: new Date('2026-01-01T00:00:00Z'),
        },
      });

      await service.onApplicationBootstrap();

      assert.deepEqual(await prisma.platformSetting.findMany(), [updated]);
    } finally {
      await prisma.platformSetting.deleteMany();
      if (original) await prisma.platformSetting.create({ data: original });
    }
  } finally {
    await prisma.$disconnect();
  }
});
