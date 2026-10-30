import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { HEADER_NAMES } from '@learnup/ts-common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OutboxRepository } from './outbox.repository';
import { EMAIL_REQUESTED_EVENT } from './outbox.service';
import type { Prisma } from '../../../generated/prisma/client';
import {
  OUTBOX_EXPIRED_CODE,
  OUTBOX_MAX_ATTEMPTS,
  isEmailExpired,
  nextRetryState,
} from './outbox-retry.policy';
import { EmailMessage } from './interfaces/email-message.interface';
import { NotificationEmailResponse } from './interfaces/notification-email-response.interface';
import { IOutboxRetryState } from './interfaces/outbox-retry-state.interface';

export const RELAY_BATCH_SIZE = 20;
export const DEFAULT_NOTIFICATION_TIMEOUT_MS = 5000;

@Injectable()
export class EmailRelayService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailRelayService.name);
  private currentRound: Promise<void> | null = null;
  private stopping = false;
  private missingUrlReported = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Interval(1000)
  async relayPendingEmails(): Promise<void> {
    if (this.currentRound || this.stopping) return;
    this.currentRound = this.runRound();
    try {
      await this.currentRound;
    } finally {
      this.currentRound = null;
    }
  }

  /**
   * Khi tắt service: không mở lượt mới, chờ lượt đang chạy xong (có giới hạn) rồi mới để Prisma ngắt kết nối.
   * OutboxModule đăng ký sau PrismaModule, nên hook này chạy trước PrismaService.onModuleDestroy.
   */
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

  /**
   * Thiếu NOTIFICATION_SERVICE_URL ngoài development: không có nơi gửi, nên email được giữ ở trạng thái
   * chưa gửi và nội dung (mã xác thực, liên kết) không bị ghi ra log; lỗi cấu hình chỉ báo một lần.
   */
  private async runRound(): Promise<void> {
    const baseUrl = this.notificationBaseUrl();
    if (!baseUrl && !this.isDevelopment()) {
      if (!this.missingUrlReported) {
        this.logger.error(
          'NOTIFICATION_SERVICE_URL is not configured; emails stay pending until it is set.',
        );
        this.missingUrlReported = true;
      }
      return;
    }
    this.missingUrlReported = false;

    const attempted: string[] = [];
    while (attempted.length < RELAY_BATCH_SIZE && !this.stopping) {
      const eventId = await this.relayNext(baseUrl, attempted);
      if (!eventId) break;
      attempted.push(eventId);
    }
  }

  /**
   * Một email một transaction: khóa dòng, gửi, rồi ghi kết quả (đã gửi, hoặc số lần thử và lần thử kế tiếp)
   * trước khi commit. Log chỉ chứa id event và mã lỗi cố định, không chứa nội dung hay thông báo lỗi gốc.
   * Trả về id event đã thử, hoặc null khi hết email đến hạn hay không đọc được database.
   */
  private async relayNext(
    baseUrl: string | undefined,
    attempted: string[],
  ): Promise<string | null> {
    const timeoutMs = this.timeoutMs();
    const outcome: {
      id?: string;
      failure?: IOutboxRetryState;
      expired?: boolean;
    } = {};
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const event = await this.outboxRepository.claimNextUnpublished(
            EMAIL_REQUESTED_EVENT,
            attempted,
            tx,
          );
          if (!event) return;
          outcome.id = event.id;

          const email = event.payload as unknown as EmailMessage;
          const now = new Date();
          if (isEmailExpired(email, now)) {
            outcome.expired = true;
            await this.outboxRepository.markExpired(
              event.id,
              this.redact(email),
              now,
              tx,
            );
            return;
          }
          const errorCode = await this.deliver(baseUrl, email, timeoutMs);
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
          await this.outboxRepository.markPublished(
            event.id,
            this.redact(email),
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
        `Email ${outcome.id}: result not saved (DATABASE_ERROR); it stays pending and may be sent again.`,
      );
      return outcome.id;
    }

    if (outcome.id && outcome.expired) {
      this.logger.warn(
        `Email ${outcome.id} skipped (${OUTBOX_EXPIRED_CODE}): its code or link has expired.`,
      );
    }
    this.logFailure(outcome.id, outcome.failure);
    return outcome.id ?? null;
  }

  /** Payload lưu lại sau khi xử lý: bỏ tiêu đề và nội dung (mã xác thực, liên kết), giữ hạn để không gửi lại thư đã hết hạn. */
  private redact(email: EmailMessage): Prisma.InputJsonValue {
    return {
      to: email.to,
      templateCode: email.templateCode,
      ...(email.expiresAt ? { expiresAt: email.expiresAt } : {}),
      redacted: true,
    };
  }

  private logFailure(id: string | undefined, failure?: IOutboxRetryState) {
    if (!id || !failure) return;
    if (failure.failedAt) {
      this.logger.error(
        `Email ${id} failed permanently (${failure.lastErrorCode}) after ${failure.attempts} attempts.`,
      );
      return;
    }
    this.logger.warn(
      `Email ${id} failed (${failure.lastErrorCode}), attempt ${failure.attempts}/${OUTBOX_MAX_ATTEMPTS}, next attempt at ${failure.nextAttemptAt?.toISOString()}.`,
    );
  }

  /** Trả về null khi gửi được, hoặc một mã lỗi cố định khi không gửi được. */
  private async deliver(
    baseUrl: string | undefined,
    email: EmailMessage,
    timeoutMs: number,
  ): Promise<string | null> {
    if (!baseUrl) {
      this.logger.warn(
        `\n[DEV EMAIL] NODE_ENV=development, NOTIFICATION_SERVICE_URL trống: chỉ in ra log, không gửi.\nTo: ${email.to}\nSubject: ${email.subject}\n${email.body}\n`,
      );
      return null;
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/notifications/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [HEADER_NAMES.INTERNAL_KEY]: this.config.getOrThrow<string>(
            'INTERNAL_SERVICE_KEY',
          ),
        },
        body: JSON.stringify({
          recipientEmail: email.to,
          subject: email.subject,
          body: email.body,
          templateCode: email.templateCode,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const name = (error as Error | undefined)?.name;
      return name === 'TimeoutError' || name === 'AbortError'
        ? 'TIMEOUT'
        : 'NETWORK';
    }
    if (!response.ok) return `HTTP_${response.status}`;

    let result: NotificationEmailResponse;
    try {
      result = (await response.json()) as NotificationEmailResponse;
    } catch {
      return 'INVALID_RESPONSE';
    }
    return result.data?.status === 'FAILED' ? 'SMTP_FAILED' : null;
  }

  private notificationBaseUrl(): string | undefined {
    return (
      this.config.get<string>('NOTIFICATION_SERVICE_URL')?.trim() || undefined
    );
  }

  /** Thiếu NODE_ENV coi như production: chỉ khai báo development mới được in thư ra log. */
  private isDevelopment(): boolean {
    return this.config.get<string>('NODE_ENV') === 'development';
  }

  private timeoutMs(): number {
    const value = Number(
      this.config.get<string>('NOTIFICATION_SERVICE_TIMEOUT_MS'),
    );
    return Number.isInteger(value) && value > 0
      ? value
      : DEFAULT_NOTIFICATION_TIMEOUT_MS;
  }
}
