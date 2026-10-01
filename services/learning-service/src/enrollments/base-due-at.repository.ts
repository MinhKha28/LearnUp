import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../common/repository/base.repository';
import { PrismaService } from '../prisma/prisma.service';

/** Tham số tính hạn gốc không hợp lệ; không đoán giá trị thay thế. */
export class InvalidBaseDueAtInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

@Injectable()
export class BaseDueAtRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Hạn gốc BR-300 theo D33: 00:00 giờ Organization của ngày (ngày phân công theo giờ Organization + N + 1),
   * tức hết ngày "ngày phân công + N". Tính trong PostgreSQL để đổi múi giờ (kể cả giờ mùa hè) chính xác.
   */
  async computeBaseDueAt(
    assignedAt: Date,
    days: number,
    timezone: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Date> {
    if (Number.isNaN(assignedAt.getTime())) {
      throw new InvalidBaseDueAtInputError(
        'assignedAt không phải thời điểm hợp lệ.',
      );
    }
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new InvalidBaseDueAtInputError(
        `Số ngày hoàn thành phải là số nguyên 1–365, nhận ${days}.`,
      );
    }

    const db = this.db(tx);
    // Kiểm tên riêng: AT TIME ZONE còn nhận viết tắt và chuỗi POSIX, không chỉ tên IANA
    const known = await db.$queryRaw<{ known: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = ${timezone}) AS known`;
    if (!known[0]?.known) {
      throw new InvalidBaseDueAtInputError(
        `Múi giờ "${timezone}" không có trong danh sách múi giờ của PostgreSQL.`,
      );
    }

    const rows = await db.$queryRaw<{ base_due_at: Date }[]>`
      SELECT (((${assignedAt}::timestamptz AT TIME ZONE ${timezone})::date + ${days}::int + 1)::timestamp
               AT TIME ZONE ${timezone}) AS base_due_at`;
    return rows[0].base_due_at;
  }
}
