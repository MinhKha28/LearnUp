import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { AccountStatusEvent } from './interfaces/account-status-event.interface';
import { AuditRecord } from './interfaces/audit-record.interface';
import { EmailMessage } from './interfaces/email-message.interface';
import { OutboxRepository } from './outbox.repository';

export const EMAIL_REQUESTED_EVENT = 'EmailRequested';
export const AUDIT_RECORDED_EVENT = 'AuditRecorded';
// UC13.5: event trạng thái tài khoản cho bản sao thưa learner_accounts (assessment, learning).
// Tenant chưa có relay Kafka nên các dòng này nằm chờ (published_at NULL) tới khi có relay.
export const USER_DEACTIVATED_EVENT = 'UserDeactivated';
export const USER_REACTIVATED_EVENT = 'UserReactivated';

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

  /**
   * UC13.5: UserDeactivated / UserReactivated, cùng transaction với việc đổi users.status
   * (kiến trúc 2.1, 2.3). Gọi SAU khi đã khóa dòng users để occurredAt của hai thao tác nối tiếp
   * trên cùng tài khoản luôn tăng dần.
   */
  async enqueueAccountStatusEvent(
    tx: Prisma.TransactionClient,
    params: {
      eventType: typeof USER_DEACTIVATED_EVENT | typeof USER_REACTIVATED_EVENT;
      userId: string;
      organizationId: string;
      role: string;
      status: string;
    },
  ): Promise<void> {
    const occurredAt = new Date();
    const payload: AccountStatusEvent = {
      userId: params.userId,
      organizationId: params.organizationId,
      role: params.role,
      status: params.status,
      occurredAt: occurredAt.toISOString(),
    };
    await this.outboxRepository.create(
      {
        aggregateType: 'User',
        aggregateId: params.userId,
        eventType: params.eventType,
        organizationId: params.organizationId,
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
