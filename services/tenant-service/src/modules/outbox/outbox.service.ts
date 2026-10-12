import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { EmailMessage } from './interfaces/email-message.interface';
import { OutboxRepository } from './outbox.repository';

export const EMAIL_REQUESTED_EVENT = 'EmailRequested';

/** (giữ nguyên khối chú thích Transactional Outbox cũ) */
@Injectable()
export class OutboxService {
  constructor(private readonly outboxRepository: OutboxRepository) {}

  async enqueueEmail(
    tx: Prisma.TransactionClient,
    params: {
      aggregateType: string;
      aggregateId: string;
      organizationId: string | null;
      email: EmailMessage;
    },
  ): Promise<void> {
    await this.outboxRepository.create(
      {
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        eventType: EMAIL_REQUESTED_EVENT,
        organizationId: params.organizationId,
        payload: { ...params.email },
        occurredAt: new Date(),
      },
      tx,
    );
  }
}
