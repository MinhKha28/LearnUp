import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class OutboxRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /** Ghi một event; gọi kèm tx để nằm chung transaction với dữ liệu nghiệp vụ. */
  create(
    data: Prisma.OutboxEventUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).outboxEvent.create({ data });
  }

  /**
   * Khóa một event chưa gửi, cũ nhất trước (id là uuid v7 nên tăng theo thời gian).
   * SKIP LOCKED: dòng instance khác đang giữ thì bỏ qua, nên một email không bị hai instance cùng gửi.
   * excludeIds: các event đã thử trong lượt này, để một email lỗi không bị lấy lại liên tục.
   */
  async claimNextUnpublished(
    eventType: string,
    excludeIds: string[],
    tx: Prisma.TransactionClient,
  ): Promise<{ id: string; payload: Prisma.JsonValue } | null> {
    const rows = await tx.$queryRaw<
      { id: string; payload: Prisma.JsonValue }[]
    >`
      SELECT id, payload
      FROM outbox_events
      WHERE event_type = ${eventType}
        AND published_at IS NULL
        AND NOT (id = ANY(${excludeIds}::uuid[]))
      ORDER BY id
      LIMIT 1
      FOR UPDATE SKIP LOCKED`;
    return rows[0] ?? null;
  }

  /** Đánh dấu đã gửi và thay payload bằng bản đã che nội dung. */
  markPublished(
    id: string,
    redactedPayload: Prisma.InputJsonValue,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).outboxEvent.update({
      where: { id },
      data: { publishedAt: new Date(), payload: redactedPayload },
    });
  }
}
