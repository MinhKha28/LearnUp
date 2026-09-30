import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Script seed: tạo dữ liệu nền để các UC chạy được khi chưa có màn hình Admin.
// - 1 dòng platform_settings (BR-268) với giá trị mặc định lấy từ schema.
// - 3 Subscription Plan mẫu (sẽ thay bằng UC43.1 ở Inter 3).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const GB = 1024n * 1024n * 1024n;

async function main(): Promise<void> {
  const settingsCount = await prisma.platformSetting.count();
  if (settingsCount === 0) {
    await prisma.platformSetting.create({ data: {} });
    console.log('Đã tạo platform_settings mặc định');
  }

  const planCount = await prisma.subscriptionPlan.count();
  if (planCount === 0) {
    await prisma.subscriptionPlan.createMany({
      data: [
        {
          name: 'Basic',
          price: 3_000_000n,
          durationDays: 90,
          maxLearners: 30,
          maxInstructors: 3,
          maxCourseChains: 5,
          maxStorageBytes: 10n * GB,
        },
        {
          name: 'Standard',
          price: 12_000_000n,
          durationDays: 365,
          maxLearners: 100,
          maxInstructors: 10,
          maxCourseChains: 20,
          maxStorageBytes: 50n * GB,
        },
        {
          name: 'Premium',
          price: 30_000_000n,
          durationDays: 365,
          maxLearners: 500,
          maxInstructors: 30,
          maxCourseChains: 100,
          maxStorageBytes: 200n * GB,
        },
      ],
    });
    console.log('Đã tạo 3 Subscription Plan mẫu');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
