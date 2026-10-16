/**
 * Test hạn gốc BR-300 (D33) trên PostgreSQL thật. Chỉ đọc, không ghi dữ liệu.
 *
 * Chạy: npm run test:integration
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import {
  BaseDueAtRepository,
  InvalidBaseDueAtInputError,
} from '../../src/modules/enrollments/base-due-at.repository';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const repository = new BaseDueAtRepository(prisma as unknown as PrismaService);

const compute = (assignedAt: string, days: number, timezone: string) =>
  repository.computeBaseDueAt(new Date(assignedAt), days, timezone);

after(async () => {
  await prisma.$disconnect();
});

void describe('BaseDueAtRepository.computeBaseDueAt (BR-300, D33)', () => {
  void test('phân công 22:00 ngày 01/10 giờ VN, N = 10 → hết ngày 11/10 giờ VN (2026-10-11T17:00:00Z)', async () => {
    const result = await compute(
      '2026-10-01T15:00:00Z',
      10,
      'Asia/Ho_Chi_Minh',
    );
    assert.equal(result.toISOString(), '2026-10-11T17:00:00.000Z');
  });

  void test('phân công 00:30 ngày 01/10 giờ VN (2026-09-30T17:30:00Z), N = 10 → cùng hạn', async () => {
    const result = await compute(
      '2026-09-30T17:30:00Z',
      10,
      'Asia/Ho_Chi_Minh',
    );
    assert.equal(result.toISOString(), '2026-10-11T17:00:00.000Z');
  });

  void test('America/New_York qua ngày đổi giờ 01/11: phân công 2026-10-25T14:00:00Z, N = 10 → 2026-11-05T05:00:00Z', async () => {
    const result = await compute(
      '2026-10-25T14:00:00Z',
      10,
      'America/New_York',
    );
    assert.equal(result.toISOString(), '2026-11-05T05:00:00.000Z');
  });

  void test('chạy trong transaction được truyền vào', async () => {
    const result = await prisma.$transaction((tx) =>
      repository.computeBaseDueAt(
        new Date('2026-10-01T15:00:00Z'),
        10,
        'Asia/Ho_Chi_Minh',
        tx,
      ),
    );
    assert.equal(result.toISOString(), '2026-10-11T17:00:00.000Z');
  });

  for (const timezone of ['Asia/Ha_Noi', 'Not/AZone', 'ICT', '']) {
    void test(`múi giờ "${timezone}" không có trong PostgreSQL → lỗi`, async () => {
      await assert.rejects(
        compute('2026-10-01T15:00:00Z', 10, timezone),
        InvalidBaseDueAtInputError,
      );
    });
  }

  for (const days of [0, 366, -1, 1.5, Number.NaN]) {
    void test(`N = ${days} → lỗi`, async () => {
      await assert.rejects(
        compute('2026-10-01T15:00:00Z', days, 'Asia/Ho_Chi_Minh'),
        InvalidBaseDueAtInputError,
      );
    });
  }

  void test('N = 1 và N = 365 là biên hợp lệ', async () => {
    assert.equal(
      (
        await compute('2026-10-01T15:00:00Z', 1, 'Asia/Ho_Chi_Minh')
      ).toISOString(),
      '2026-10-02T17:00:00.000Z',
    );
    assert.equal(
      (
        await compute('2026-10-01T15:00:00Z', 365, 'Asia/Ho_Chi_Minh')
      ).toISOString(),
      '2027-10-01T17:00:00.000Z',
    );
  });

  void test('assignedAt không hợp lệ → lỗi', async () => {
    await assert.rejects(
      compute('not a date', 10, 'Asia/Ho_Chi_Minh'),
      InvalidBaseDueAtInputError,
    );
  });
});
