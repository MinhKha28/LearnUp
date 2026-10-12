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

  /** Các event chưa gửi, cũ nhất trước (id là uuid v7 nên tăng theo thời gian). */
  findUnpublished(
    eventType: string,
    take: number,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).outboxEvent.findMany({
      where: { eventType, publishedAt: null },
      orderBy: { id: 'asc' },
      take,
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
