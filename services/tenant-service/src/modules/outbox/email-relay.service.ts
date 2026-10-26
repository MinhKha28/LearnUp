import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { HEADER_NAMES } from '@learnup/ts-common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OutboxRepository } from './outbox.repository';
import { EMAIL_REQUESTED_EVENT } from './outbox.service';
import { EmailMessage } from './interfaces/email-message.interface';
import { NotificationEmailResponse } from './interfaces/notification-email-response.interface';

export const RELAY_BATCH_SIZE = 20;
export const DEFAULT_NOTIFICATION_TIMEOUT_MS = 5000;

@Injectable()
export class EmailRelayService {
  private readonly logger = new Logger(EmailRelayService.name);
  private running = false;
  private missingUrlReported = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Thiếu NOTIFICATION_SERVICE_URL ngoài development: không có nơi gửi, nên email được giữ ở trạng thái
   * chưa gửi và nội dung (mã xác thực, liên kết) không bị ghi ra log; lỗi cấu hình chỉ báo một lần.
   */
  @Interval(1000)
  async relayPendingEmails(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
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
      while (attempted.length < RELAY_BATCH_SIZE) {
        const eventId = await this.relayNext(baseUrl, attempted);
        if (!eventId) break;
        attempted.push(eventId);
      }
    } finally {
      this.running = false;
    }
  }

  /**
   * Một email một transaction: khóa dòng, gửi, đánh dấu đã gửi rồi mới commit.
   * Gửi lỗi thì rollback, email vẫn chưa gửi và được thử lại ở lượt sau.
   * Trả về id event đã thử, hoặc null khi hết email hay không đọc được database.
   */
  private async relayNext(
    baseUrl: string | undefined,
    attempted: string[],
  ): Promise<string | null> {
    const timeoutMs = this.timeoutMs();
    const claim: { id?: string } = {};
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const event = await this.outboxRepository.claimNextUnpublished(
            EMAIL_REQUESTED_EVENT,
            attempted,
            tx,
          );
          if (!event) return;
          claim.id = event.id;

          const email = event.payload as unknown as EmailMessage;
          await this.deliver(baseUrl, email, timeoutMs);
          await this.outboxRepository.markPublished(
            event.id,
            { to: email.to, templateCode: email.templateCode, redacted: true },
            tx,
          );
        },
        { maxWait: timeoutMs, timeout: timeoutMs + 5000 },
      );
    } catch (error) {
      const reason = (error as Error).message;
      if (!claim.id) {
        this.logger.warn(`Không đọc được outbox: ${reason}`);
        return null;
      }
      this.logger.warn(`Gửi email ${claim.id} thất bại: ${reason}`);
    }
    return claim.id ?? null;
  }

  private async deliver(
    baseUrl: string | undefined,
    email: EmailMessage,
    timeoutMs: number,
  ): Promise<void> {
    if (!baseUrl) {
      this.logger.warn(
        `\n[DEV EMAIL] NODE_ENV=development, NOTIFICATION_SERVICE_URL trống: chỉ in ra log, không gửi.\nTo: ${email.to}\nSubject: ${email.subject}\n${email.body}\n`,
      );
      return;
    }

    const response = await fetch(`${baseUrl}/api/notifications/email/send`, {
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
    if (!response.ok) {
      throw new Error(`notification-service trả về HTTP ${response.status}`);
    }

    const result = (await response.json()) as NotificationEmailResponse;
    if (result.data?.status === 'FAILED') {
      throw new Error(
        `SMTP gửi thất bại: ${result.data.errorMessage ?? 'không rõ lý do'}`,
      );
    }
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
