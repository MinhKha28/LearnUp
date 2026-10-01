/**
 * Dữ liệu demo Inter 1 cho learning-service. CHỈ DÙNG CHO DEV.
 *
 * Chạy: npm run db:seed
 * Chỉ seed bảng platform_settings (bảng một dòng). Các bảng khác được ghi qua nghiệp vụ
 * (UC25.3 tạo Enrollment, bản sao cây lấy từ course-service).
 * Chạy lại an toàn: ghi bằng upsert theo ID cố định.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// ---------------------------------------------------------------------------
// ID cố định
// ---------------------------------------------------------------------------
const PLATFORM_SETTINGS_ID = '0199a000-0000-7000-8000-1f0000000002';

const VIDEO_COMPLETION_PERCENT = 90;

// ---------------------------------------------------------------------------
// Thực thi
// ---------------------------------------------------------------------------
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV=production. Seed data is for development only.');
    process.exit(1);
  }

  const prisma = createPrismaClient();
  try {
    const now = new Date();
    await prisma.platformSetting.upsert({
      where: { id: PLATFORM_SETTINGS_ID },
      create: {
        id: PLATFORM_SETTINGS_ID,
        videoCompletionPercent: VIDEO_COMPLETION_PERCENT,
        sourceAsOf: now,
      },
      update: {
        videoCompletionPercent: VIDEO_COMPLETION_PERCENT,
        sourceAsOf: now,
      },
    });
    console.log('learning-service: seed completed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
