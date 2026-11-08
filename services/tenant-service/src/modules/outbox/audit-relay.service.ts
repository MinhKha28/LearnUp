import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { HEADER_NAMES } from '@learnup/ts-common';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditRecord } from './interfaces/audit-record.interface';
import { IOutboxRetryState } from './interfaces/outbox-retry-state.interface';
import { OUTBOX_MAX_ATTEMPTS, nextRetryState } from './outbox-retry.policy';
import { OutboxRepository } from './outbox.repository';
import { AUDIT_RECORDED_EVENT } from './outbox.service';

export const AUDIT_RELAY_BATCH_SIZE = 20;
export const DEFAULT_AUDIT_TIMEOUT_MS = 5000;

/**
 * UC12.5: gửi bản ghi nhật ký (BR-270) từ outbox sang audit-service, cùng mẫu với EmailRelayService:
 * mỗi bản ghi một transaction (khóa dòng, gửi, ghi kết quả rồi commit), thử lại theo outbox-retry.policy.
 * Gửi ít nhất một lần: commit lỗi sau khi audit đã nhận thì bản ghi có thể được gửi lại
 * (correlationId = id của outbox event để nhận ra bản trùng).
 *
 * Thiếu AUDIT_SERVICE_URL (kể cả development): bản ghi giữ ở pending, không ghi nội dung ra log;
 * lỗi cấu hình chỉ báo một lần.
 */
@Injectable()
export class AuditRelayService implements OnModuleDestroy {
  private readonly logger = new Logger(AuditRelayService.name);
  private currentRound: Promise<void> | null = null;
  private stopping = false;
  private missingUrlReported = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Interval(1000)
  async relayPendingAudits(): Promise<void> {
    if (this.currentRound || this.stopping) return;
    this.currentRound = this.runRound();
    try {
      await this.currentRound;
    } finally {
      this.currentRound = null;
    }
  }

  /** Như EmailRelayService: không mở lượt mới, chờ lượt đang chạy xong (có giới hạn) trước khi Prisma ngắt kết nối. */
  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    const round = this.currentRound;
    if (!round) return;
    let timer: NodeJS.Timeout | undefined;
    const limit = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, this.timeoutMs() + 5000);
    });
    await Promise.race([round, limit]);
    clearTimeout(timer);
  }

  private async runRound(): Promise<void> {
    const baseUrl = this.auditBaseUrl();
    if (!baseUrl) {
      if (!this.missingUrlReported) {
        this.logger.error(
          'AUDIT_SERVICE_URL is not configured; audit records stay pending until it is set.',
        );
        this.missingUrlReported = true;
      }
      return;
    }
    this.missingUrlReported = false;

    const attempted: string[] = [];
    while (attempted.length < AUDIT_RELAY_BATCH_SIZE && !this.stopping) {
      const eventId = await this.relayNext(baseUrl, attempted);
      if (!eventId) break;
      attempted.push(eventId);
    }
  }

  /** Trả về id event đã thử, hoặc null khi hết bản ghi đến hạn hay không đọc được database. Log chỉ có id và mã lỗi. */
  private async relayNext(
    baseUrl: string,
    attempted: string[],
  ): Promise<string | null> {
    const timeoutMs = this.timeoutMs();
    const outcome: { id?: string; failure?: IOutboxRetryState } = {};
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const event = await this.outboxRepository.claimNextUnpublished(
            AUDIT_RECORDED_EVENT,
            attempted,
            tx,
          );
          if (!event) return;
          outcome.id = event.id;

          const record = event.payload as unknown as AuditRecord;
          const errorCode = await this.deliver(
            baseUrl,
            event.id,
            record,
            timeoutMs,
          );
          if (errorCode) {
            outcome.failure = nextRetryState(
              event.attempts,
              errorCode,
              new Date(),
            );
            await this.outboxRepository.recordFailure(
              event.id,
              outcome.failure,
              tx,
            );
            return;
          }
          // Bản ghi nhật ký không chứa bí mật (mã, liên kết) nên giữ nguyên payload.
          await this.outboxRepository.markPublished(
            event.id,
            event.payload as Prisma.InputJsonValue,
            tx,
          );
        },
        { maxWait: timeoutMs, timeout: timeoutMs + 5000 },
      );
    } catch {
      if (!outcome.id) {
        this.logger.warn('Outbox unavailable (DATABASE_ERROR).');
        return null;
      }
      this.logger.warn(
        `Audit ${outcome.id}: result not saved (DATABASE_ERROR); it stays pending and may be sent again.`,
      );
      return outcome.id;
    }

    this.logFailure(outcome.id, outcome.failure);
    return outcome.id ?? null;
  }

  private logFailure(id: string | undefined, failure?: IOutboxRetryState) {
    if (!id || !failure) return;
    if (failure.failedAt) {
      this.logger.error(
        `Audit ${id} failed permanently (${failure.lastErrorCode}) after ${failure.attempts} attempts.`,
      );
      return;
    }
    this.logger.warn(
      `Audit ${id} failed (${failure.lastErrorCode}), attempt ${failure.attempts}/${OUTBOX_MAX_ATTEMPTS}, next attempt at ${failure.nextAttemptAt?.toISOString()}.`,
    );
  }

  /**
   * Trả về null khi audit-service đã nhận, hoặc một mã lỗi cố định.
   * Không gửi header người dùng: audit-service từ chối ghi khi request mang user context (403).
   */
  private async deliver(
    baseUrl: string,
    eventId: string,
    record: AuditRecord,
    timeoutMs: number,
  ): Promise<string | null> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/v1/audit/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [HEADER_NAMES.INTERNAL_KEY]: this.config.getOrThrow<string>(
            'INTERNAL_SERVICE_KEY',
          ),
        },
        body: JSON.stringify({
          organizationId: record.organizationId,
          actorUserId: record.actorUserId,
          actorRole: record.actorRole,
          actionType: record.actionType,
          targetResourceType: record.targetResourceType,
          targetResourceId: record.targetResourceId,
          details: JSON.stringify({
            ...record.details,
            occurredAt: record.occurredAt,
          }),
          correlationId: eventId,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const name = (error as Error | undefined)?.name;
      return name === 'TimeoutError' || name === 'AbortError'
        ? 'TIMEOUT'
        : 'NETWORK';
    }
    return response.ok ? null : `HTTP_${response.status}`;
  }

  private auditBaseUrl(): string | undefined {
    return this.config.get<string>('AUDIT_SERVICE_URL')?.trim() || undefined;
  }

  private timeoutMs(): number {
    const value = Number(this.config.get<string>('AUDIT_SERVICE_TIMEOUT_MS'));
    return Number.isInteger(value) && value > 0
      ? value
      : DEFAULT_AUDIT_TIMEOUT_MS;
  }
}
