/**
 * Test công thức thời lượng ước tính (BR-51, D9, D12) trên course_db thật.
 * Mỗi ca tự tạo dữ liệu trong một transaction và luôn rollback, kể cả khi assert sai.
 *
 * Chạy: npm run test:catalog:db
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { CatalogRepository } from 'src/catalog/catalog.repository';
import type { PrismaService } from 'src/prisma/prisma.service';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to run: NODE_ENV=production. This test writes to the database.',
  );
}

const TEST_ORG = '0199a000-0000-7000-8000-0a00000000f1';
const READING_SPEED = 200;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

class RollbackSignal extends Error {}

/** Chạy fn trong transaction rồi luôn rollback. */
async function withRollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await fn(tx);
        throw new RollbackSignal();
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    if (!(error instanceof RollbackSignal)) {
      throw error;
    }
  }
}

function repositoryFor(tx: Tx): CatalogRepository {
  return new CatalogRepository(tx as unknown as PrismaService);
}

/** platform_settings chỉ còn một dòng với tốc độ đọc đã biết (trong transaction). */
async function useReadingSpeed(tx: Tx, wordsPerMinute: number): Promise<void> {
  await tx.platformSetting.deleteMany();
  await tx.platformSetting.create({
    data: {
      id: randomUUID(),
      sourceAsOf: new Date(),
      readingSpeedWordsPerMinute: wordsPerMinute,
    },
  });
}

/** Chạy fn và gom các lần gọi logger.error của Nest trong lúc đó. */
async function captureLoggerErrors<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; errors: unknown[][] }> {
  const errors: unknown[][] = [];
  Logger.overrideLogger({
    log: () => undefined,
    warn: () => undefined,
    error: (...args: unknown[]) => {
      errors.push(args);
    },
  });
  try {
    return { result: await fn(), errors };
  } finally {
    Logger.overrideLogger(new ConsoleLogger());
  }
}

interface FixtureMaterial {
  type: 'Video' | 'Reading';
  isRequired: boolean;
  seconds?: number;
  words?: number;
  materialDisabled?: boolean;
  lessonDisabled?: boolean;
}

/** Tạo một Course Published Public; mỗi học liệu nằm trong một Lesson riêng. */
async function createCourse(
  tx: Tx,
  materials: FixtureMaterial[],
  assignmentMinutes = 0,
): Promise<string> {
  const chainId = randomUUID();
  const courseId = randomUUID();
  const moduleId = randomUUID();
  await tx.courseChain.create({
    data: { id: chainId, organizationId: TEST_ORG, instructorId: randomUUID() },
  });
  await tx.course.create({
    data: {
      id: courseId,
      organizationId: TEST_ORG,
      chainId,
      versionNumber: 1,
      name: 'Course kiểm thử',
      shortDescription: 'Mô tả',
      trainingObjectives: 'Mục tiêu',
      learningOutcomes: ['Kết quả'],
      expectedCompletionDays: 7,
      courseType: 'Public',
      status: 'Published',
      publishedAt: new Date(),
      assignmentMinutes,
    },
  });
  await tx.courseModule.create({
    data: {
      id: moduleId,
      organizationId: TEST_ORG,
      courseId,
      title: 'Module',
      position: 1,
    },
  });

  for (const [index, material] of materials.entries()) {
    const lessonId = randomUUID();
    const fileId = randomUUID();
    const isVideo = material.type === 'Video';
    await tx.lesson.create({
      data: {
        id: lessonId,
        organizationId: TEST_ORG,
        moduleId,
        title: `Lesson ${index + 1}`,
        content: '',
        position: index + 1,
        disabledAt: material.lessonDisabled ? new Date() : null,
      },
    });
    await tx.mediaFile.create({
      data: {
        id: fileId,
        organizationId: TEST_ORG,
        purpose: isVideo ? 'MaterialVideo' : 'MaterialReading',
        status: 'Ready',
        storageKey: `test/${fileId}`,
        originalFilename: isVideo ? 'video.mp4' : 'tai-lieu.pdf',
        mimeType: isVideo ? 'video/mp4' : 'application/pdf',
        sizeBytes: BigInt(1024),
        durationSeconds: isVideo ? (material.seconds ?? null) : null,
        wordCount: isVideo ? null : (material.words ?? null),
        readyAt: new Date(),
      },
    });
    await tx.material.create({
      data: {
        id: randomUUID(),
        organizationId: TEST_ORG,
        lessonId,
        materialType: material.type,
        title: `Học liệu ${index + 1}`,
        isRequired: material.isRequired,
        fileId,
        position: 1,
        disabledAt: material.materialDisabled ? new Date() : null,
      },
    });
  }
  return courseId;
}

/** Tạo một Course, tính thời lượng và trả về số phút của Course đó. */
async function estimate(
  tx: Tx,
  materials: FixtureMaterial[],
  assignmentMinutes = 0,
): Promise<number | undefined> {
  await useReadingSpeed(tx, READING_SPEED);
  const courseId = await createCourse(tx, materials, assignmentMinutes);
  const durations = await repositoryFor(tx).estimateDurationMinutes(TEST_ORG, [
    courseId,
  ]);
  return durations.get(courseId);
}

/** Số dòng mỗi bảng có thể bị test ghi vào, để kiểm không còn dòng thừa sau khi chạy. */
async function countRows(): Promise<Record<string, number>> {
  return {
    platformSettings: await prisma.platformSetting.count(),
    courseChains: await prisma.courseChain.count(),
    courses: await prisma.course.count(),
    modules: await prisma.courseModule.count(),
    lessons: await prisma.lesson.count(),
    materials: await prisma.material.count(),
    mediaFiles: await prisma.mediaFile.count(),
  };
}

let rowsBefore: Record<string, number>;

before(async () => {
  rowsBefore = await countRows();
});

after(async () => {
  await prisma.$disconnect();
});

void describe('estimateDurationMinutes', () => {
  void test('video 61 giây làm tròn lên 2 phút', () =>
    withRollback(async (tx) => {
      assert.equal(
        await estimate(tx, [{ type: 'Video', isRequired: true, seconds: 61 }]),
        2,
      );
    }));

  void test('video 59 giây làm tròn lên 1 phút', () =>
    withRollback(async (tx) => {
      assert.equal(
        await estimate(tx, [{ type: 'Video', isRequired: true, seconds: 59 }]),
        1,
      );
    }));

  void test('video 60 giây đúng 1 phút', () =>
    withRollback(async (tx) => {
      assert.equal(
        await estimate(tx, [{ type: 'Video', isRequired: true, seconds: 60 }]),
        1,
      );
    }));

  void test('reading 0 từ (không trích được chữ, BR-293) là 0 phút', () =>
    withRollback(async (tx) => {
      assert.equal(
        await estimate(tx, [{ type: 'Reading', isRequired: true, words: 0 }]),
        0,
      );
    }));

  void test('reading 201 từ với tốc độ 200 từ/phút làm tròn lên 2 phút', () =>
    withRollback(async (tx) => {
      assert.equal(
        await estimate(tx, [{ type: 'Reading', isRequired: true, words: 201 }]),
        2,
      );
    }));

  void test('học liệu không bắt buộc không được tính', () =>
    withRollback(async (tx) => {
      // 120 giây bắt buộc = 2; video 600 giây và reading 1000 từ không bắt buộc bị bỏ
      assert.equal(
        await estimate(tx, [
          { type: 'Video', isRequired: true, seconds: 120 },
          { type: 'Video', isRequired: false, seconds: 600 },
          { type: 'Reading', isRequired: false, words: 1000 },
        ]),
        2,
      );
    }));

  void test('học liệu bị vô hiệu hóa và học liệu thuộc Lesson bị vô hiệu hóa không được tính', () =>
    withRollback(async (tx) => {
      // Chỉ còn video 180 giây = 3 phút
      assert.equal(
        await estimate(tx, [
          { type: 'Video', isRequired: true, seconds: 180 },
          {
            type: 'Video',
            isRequired: true,
            seconds: 600,
            materialDisabled: true,
          },
          {
            type: 'Reading',
            isRequired: true,
            words: 1000,
            lessonDisabled: true,
          },
        ]),
        3,
      );
    }));

  void test('cộng assignment_minutes vào tổng học liệu bắt buộc', () =>
    withRollback(async (tx) => {
      // ⌈90/60⌉ = 2, ⌈450/200⌉ = 3, cộng 15 phút Assignment = 20
      assert.equal(
        await estimate(
          tx,
          [
            { type: 'Video', isRequired: true, seconds: 90 },
            { type: 'Reading', isRequired: true, words: 450 },
          ],
          15,
        ),
        20,
      );
    }));

  void test('Course không có học liệu nào chỉ còn assignment_minutes', () =>
    withRollback(async (tx) => {
      assert.equal(await estimate(tx, [], 25), 25);
    }));

  void test('Course chỉ có học liệu không bắt buộc vẫn ra assignment_minutes, không mất dòng', () =>
    withRollback(async (tx) => {
      assert.equal(
        await estimate(
          tx,
          [{ type: 'Video', isRequired: false, seconds: 600 }],
          4,
        ),
        4,
      );
    }));

  void test('tính nhiều Course trong một lần gọi; Course của tổ chức khác không có trong kết quả', () =>
    withRollback(async (tx) => {
      await useReadingSpeed(tx, READING_SPEED);
      const first = await createCourse(tx, [
        { type: 'Video', isRequired: true, seconds: 61 },
      ]);
      const second = await createCourse(tx, [], 9);
      const durations = await repositoryFor(tx).estimateDurationMinutes(
        TEST_ORG,
        [first, second, '0199a000-0000-7000-8000-0e0000000002'],
      );
      assert.deepEqual(
        Object.fromEntries(durations),
        Object.fromEntries([
          [first, 2],
          [second, 9],
        ]),
      );
    }));

  void test('platform_settings trống: không có giá trị (service trả null) và ghi logger.error', () =>
    withRollback(async (tx) => {
      const courseId = await createCourse(
        tx,
        [{ type: 'Video', isRequired: true, seconds: 61 }],
        5,
      );
      await tx.platformSetting.deleteMany();
      const { result: durations, errors } = await captureLoggerErrors(() =>
        repositoryFor(tx).estimateDurationMinutes(TEST_ORG, [courseId]),
      );
      assert.equal(durations.has(courseId), false);
      assert.equal(errors.length, 1);
      assert.match(String(errors[0][0]), /platform_settings/);
    }));

  void test('tốc độ đọc = 0: xử lý như thiếu platform_settings, không ném lỗi, có logger.error', () =>
    withRollback(async (tx) => {
      await useReadingSpeed(tx, 0);
      const courseId = await createCourse(
        tx,
        [
          { type: 'Video', isRequired: true, seconds: 61 },
          { type: 'Reading', isRequired: true, words: 500 },
        ],
        5,
      );
      const { result: durations, errors } = await captureLoggerErrors(() =>
        repositoryFor(tx).estimateDurationMinutes(TEST_ORG, [courseId]),
      );
      assert.equal(durations.has(courseId), false);
      assert.equal(errors.length, 1);
      assert.match(
        String(errors[0][0]),
        /reading_speed_words_per_minute.*không hợp lệ \(0\)/,
      );
    }));

  void test('sau các ca test, số dòng mọi bảng giữ nguyên như trước khi chạy', async () => {
    assert.deepEqual(await countRows(), rowsBefore);
    assert.equal(
      await prisma.course.count({ where: { organizationId: TEST_ORG } }),
      0,
    );
  });
});
