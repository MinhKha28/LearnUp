import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { AuditRecord } from './interfaces/audit-record.interface';
import { EmailMessage } from './interfaces/email-message.interface';
import { OutboxRepository } from './outbox.repository';

export const EMAIL_REQUESTED_EVENT = 'EmailRequested';
export const AUDIT_RECORDED_EVENT = 'AuditRecorded';

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

  /** UC12.5: nhật ký hành động (BR-270) qua outbox, cùng transaction với dữ liệu nghiệp vụ. AuditRelayService gửi đi. */
  async enqueueAudit(
    tx: Prisma.TransactionClient,
    params: {
      aggregateType: string;
      aggregateId: string;
      record: Omit<AuditRecord, 'occurredAt'>;
    },
  ): Promise<void> {
    const occurredAt = new Date();
    const payload: AuditRecord = {
      ...params.record,
      occurredAt: occurredAt.toISOString(),
    };
    await this.outboxRepository.create(
      {
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        eventType: AUDIT_RECORDED_EVENT,
        organizationId: params.record.organizationId,
        payload: payload as unknown as Prisma.InputJsonValue,
        occurredAt,
      },
      tx,
    );
  }

  countResendEmails(email: string, since: Date): Promise<number> {
    return this.outboxRepository.countResendEmails(
      EMAIL_REQUESTED_EVENT,
      email,
      since,
    );
  }
}
