import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { IClaimedOutboxEvent } from './interfaces/claimed-outbox-event.interface';
import { IOutboxRetryState } from './interfaces/outbox-retry-state.interface';
import { OUTBOX_EXPIRED_CODE } from './outbox-retry.policy';

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
   * Khóa một event chưa gửi đã đến hạn thử, cũ nhất trước (id là uuid v7 nên tăng theo thời gian).
   * Event đang chờ lần thử sau (next_attempt_at) hoặc đã dừng hẳn (failed_at) không được lấy,
   * nên email lỗi không chặn email mới. SKIP LOCKED: dòng instance khác đang giữ thì bỏ qua.
   * excludeIds: các event đã thử trong lượt này. Dùng chỉ mục outbox_events_pending_claim_idx.
   */
  async claimNextUnpublished(
    eventType: string,
    excludeIds: string[],
    tx: Prisma.TransactionClient,
  ): Promise<IClaimedOutboxEvent | null> {
    const rows = await tx.$queryRaw<IClaimedOutboxEvent[]>`
      SELECT id, payload, attempts
      FROM outbox_events
      WHERE event_type = ${eventType}
        AND published_at IS NULL
        AND failed_at IS NULL
        AND (next_attempt_at IS NULL OR next_attempt_at <= now())
        AND NOT (id = ANY(${excludeIds}::uuid[]))
      ORDER BY id
      LIMIT 1
      FOR UPDATE SKIP LOCKED`;
    return rows[0] ?? null;
  }

  /** Ghi lần gửi lỗi trong cùng transaction đang khóa dòng, nên hai instance không cộng trùng số lần thử. */
  recordFailure(
    id: string,
    state: IOutboxRetryState,
    tx: Prisma.TransactionClient,
  ) {
    return tx.outboxEvent.update({ where: { id }, data: state });
  }

  /** Dừng hẳn email đã quá hạn (EXPIRED) mà không tính thêm lần thử, và che nội dung như khi đã gửi. */
  markExpired(
    id: string,
    redactedPayload: Prisma.InputJsonValue,
    now: Date,
    tx: Prisma.TransactionClient,
  ) {
    return tx.outboxEvent.update({
      where: { id },
      data: {
        failedAt: now,
        nextAttemptAt: null,
        lastErrorCode: OUTBOX_EXPIRED_CODE,
        payload: redactedPayload,
      },
    });
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
