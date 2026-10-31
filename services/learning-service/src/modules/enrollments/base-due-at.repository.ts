import { createApiError } from '@learnup/ts-common';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

const endOfCalendarDay = (date: Prisma.Sql, timezone: string) =>
  Prisma.sql`((${date} + 1)::timestamp AT TIME ZONE ${timezone})`;

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

  /** UC24.3: preserve Tenant's zone identity and resolve only PostgreSQL's spelling. */
  async resolveTimezoneName(timezone: string): Promise<string> {
    const [row] = await this.db().$queryRaw<{ name: string }[]>`
      SELECT name FROM pg_timezone_names WHERE lower(name) = lower(${timezone})
        AND name NOT LIKE 'posix/%' AND name NOT LIKE 'right/%' LIMIT 1`;
    if (!row) {
      throw new InvalidBaseDueAtInputError(
        `Múi giờ "${timezone}" không có trong danh sách múi giờ của PostgreSQL.`,
      );
    }
    return row.name;
  }

  async validateTimezone(
    timezone: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const known = await this.db(tx).$queryRaw<{ known: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = ${timezone}) AS known`;
    if (!known[0]?.known) {
      throw new InvalidBaseDueAtInputError(
        `Múi giờ "${timezone}" không có trong danh sách múi giờ của PostgreSQL.`,
      );
    }
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
    timezoneValidated = false,
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
    if (!timezoneValidated) await this.validateTimezone(timezone, tx);

    const rows = await db.$queryRaw<{ base_due_at: Date }[]>`
      SELECT ${endOfCalendarDay(Prisma.sql`((${assignedAt}::timestamptz AT TIME ZONE ${timezone})::date + ${days}::int)`, timezone)} AS base_due_at`;
    return rows[0].base_due_at;
  }

  async computeDueAtForDate(
    date: string,
    timezone: string,
    tx: Prisma.TransactionClient,
  ): Promise<Date> {
    const [row] = await tx.$queryRaw<{ dueAtMilliseconds: number }[]>`
      SELECT (EXTRACT(EPOCH FROM ${endOfCalendarDay(Prisma.sql`${date}::date`, timezone)}) * 1000)::double precision AS "dueAtMilliseconds"`;
    /** Giới hạn năm bốn chữ số để tương thích ISO 8601 qua JS Date/Prisma. */
    if (row.dueAtMilliseconds >= Date.UTC(10000, 0, 1))
      throw new UnprocessableEntityException(
        createApiError(
          'VALIDATION_ERROR',
          'Hạn hoàn thành vượt phạm vi thời điểm hỗ trợ.',
        ),
      );
    return new Date(row.dueAtMilliseconds);
  }
}
