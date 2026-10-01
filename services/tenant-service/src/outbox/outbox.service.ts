import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { EmailMessage } from './interfaces/email-message.interface';

export const EMAIL_REQUESTED_EVENT = 'EmailRequested';

/**
 * Transactional Outbox (tài liệu kiến trúc mục 2.1):
 * muốn gửi email/event thì GHI một dòng vào outbox_events trong CÙNG transaction
 * với dữ liệu nghiệp vụ. Transaction rollback thì email cũng không được gửi.
 * Việc gửi thật do EmailRelayService làm sau đó.
 */
@Injectable()
export class OutboxService {
  async enqueueEmail(
    tx: Prisma.TransactionClient,
    params: {
      aggregateType: string;
      aggregateId: string;
      organizationId: string | null;
      email: EmailMessage;
    },
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        eventType: EMAIL_REQUESTED_EVENT,
        organizationId: params.organizationId,
        payload: { ...params.email },
        occurredAt: new Date(),
      },
    });
  }
}
