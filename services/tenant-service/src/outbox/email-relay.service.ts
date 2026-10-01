import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { HEADER_NAMES } from '@learnup/ts-common';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_REQUESTED_EVENT } from './outbox.service';
import { EmailMessage } from './interfaces/email-message.interface';
import { NotificationEmailResponse } from './interfaces/notification-email-response.interface';

/**
 * Relay: cứ 5 giây đọc các email chưa gửi trong outbox_events và giao cho
 * notification-service (POST /api/notifications/email/send).
 * - Chưa cấu hình NOTIFICATION_SERVICE_URL: chỉ in email ra console (chế độ dev),
 *   copy liên kết trong log để test.
 * - Gửi xong: gán published_at và XÓA nội dung thư khỏi payload
 *   (thư chứa liên kết bí mật, thiết kế tenant_db mục 3.10).
 * Sau này khi có Kafka, chỉ cần thay phần "deliver".
 */
@Injectable()
export class EmailRelayService {
  private readonly logger = new Logger(EmailRelayService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Interval(5000)
  async relayPendingEmails(): Promise<void> {
    if (this.running) return; // lần chạy trước chưa xong thì bỏ qua lần này
    this.running = true;
    try {
      const events = await this.prisma.outboxEvent.findMany({
        where: { eventType: EMAIL_REQUESTED_EVENT, publishedAt: null },
        orderBy: { id: 'asc' },
        take: 20,
      });

      for (const event of events) {
        const email = event.payload as unknown as EmailMessage;
        try {
          await this.deliver(email);
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              publishedAt: new Date(),
              payload: {
                to: email.to,
                templateCode: email.templateCode,
                redacted: true,
              },
            },
          });
        } catch (error) {
          // Để nguyên published_at = null, lần sau thử lại.
          this.logger.warn(
            `Gửi email ${event.id} thất bại: ${(error as Error).message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async deliver(email: EmailMessage): Promise<void> {
    const baseUrl = this.config.get<string>('NOTIFICATION_SERVICE_URL');
    if (!baseUrl) {
      this.logger.log(
        `\n[DEV EMAIL] To: ${email.to}\nSubject: ${email.subject}\n${email.body}\n`,
      );
      return;
    }

    const response = await fetch(`${baseUrl}/api/notifications/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // notification-service hiện chưa kiểm tra header này; gửi sẵn để sau này bật không phải sửa.
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
    });
    if (!response.ok) {
      throw new Error(`notification-service trả về HTTP ${response.status}`);
    }

    // Lỗi SMTP vẫn trả 201 nên phải đọc thêm data.status.
    const result = (await response.json()) as NotificationEmailResponse;
    if (result.data?.status === 'FAILED') {
      throw new Error(
        `SMTP gửi thất bại: ${result.data.errorMessage ?? 'không rõ lý do'}`,
      );
    }
  }
}
