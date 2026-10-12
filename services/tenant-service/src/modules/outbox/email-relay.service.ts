import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { HEADER_NAMES } from '@learnup/ts-common';
import { OutboxRepository } from './outbox.repository';
import { EMAIL_REQUESTED_EVENT } from './outbox.service';
import { EmailMessage } from './interfaces/email-message.interface';
import { NotificationEmailResponse } from './interfaces/notification-email-response.interface';

@Injectable()
export class EmailRelayService {
  private readonly logger = new Logger(EmailRelayService.name);
  private running = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly config: ConfigService,
  ) {}

  @Interval(5000)
  async relayPendingEmails(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.outboxRepository.findUnpublished(
        EMAIL_REQUESTED_EVENT,
        20,
      );

      for (const event of events) {
        const email = event.payload as unknown as EmailMessage;
        try {
          await this.deliver(email);
          await this.outboxRepository.markPublished(event.id, {
            to: email.to,
            templateCode: email.templateCode,
            redacted: true,
          });
        } catch (error) {
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

    const result = (await response.json()) as NotificationEmailResponse;
    if (result.data?.status === 'FAILED') {
      throw new Error(
        `SMTP gửi thất bại: ${result.data.errorMessage ?? 'không rõ lý do'}`,
      );
    }
  }
}
